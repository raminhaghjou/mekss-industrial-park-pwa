import { ForbiddenException, HttpException, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
} from '@nestjs/websockets';
import { Role } from '@prisma/client';
import type { Namespace, Socket } from 'socket.io';
import { AuthenticatedUser, verifyAccessToken } from '../core/auth.guard';
import { PrismaService } from '../core/prisma.service';
import { AnprService, FrameOutcome } from './anpr.service';
import { PlateReadAuditService } from './plate-read-audit.service';

export const ANPR_ROLES: Role[] = [Role.SECURITY_GUARD, Role.PARK_MANAGER, Role.SUPER_ADMIN];
export const ANPR_MAX_FRAME_BYTES = 400 * 1024;
const MIN_FRAME_INTERVAL_MS = 1000 / 8;
const SESSION_ID = /^[A-Za-z0-9_-]{1,64}$/;

type Ack<T> = (response: T) => void;

interface FramePayload {
  seq?: number;
  sessionId?: string;
  image?: Buffer | ArrayBuffer | Uint8Array;
}

interface PendingFrame {
  seq: number;
  image: Buffer;
  ack?: Ack<FrameAck>;
}

type FrameAck = { ok: true; seq: number; dropped?: boolean } | { ok: false; seq: number; error: string; status?: number };

interface SocketState {
  user: AuthenticatedUser;
  sessionKey: string;
  busy: boolean;
  lastStart: number;
  pending: PendingFrame | null;
  timer: NodeJS.Timeout | null;
}

/**
 * Live plate scanning over Socket.IO. Each socket processes at most one frame at a time at up to
 * 8 fps; frames arriving meanwhile replace each other so only the newest is ever recognised.
 */
@WebSocketGateway({ namespace: '/anpr' })
export class AnprGateway implements OnGatewayInit, OnGatewayDisconnect {
  private readonly logger = new Logger(AnprGateway.name);

  constructor(
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
    private readonly anpr: AnprService,
    private readonly audit: PlateReadAuditService,
  ) {}

  afterInit(server: Namespace): void {
    server.use((socket, next) => {
      this.authenticate(socket)
        .then(() => next())
        .catch((error: Error) => {
          const err = new Error(error instanceof HttpException && error.getStatus() === 403 ? 'forbidden' : 'unauthorized');
          next(err);
        });
    });
  }

  handleDisconnect(socket: Socket): void {
    const state = this.state(socket);
    if (!state) return;
    if (state.timer) clearTimeout(state.timer);
    state.pending?.ack?.({ ok: true, seq: state.pending.seq, dropped: true });
    state.pending = null;
    this.anpr.dropSession(state.sessionKey);
  }

  /** Resolves (and is acked to the client) once the frame is recognised, rejected or superseded. */
  @SubscribeMessage('frame')
  onFrame(@ConnectedSocket() socket: Socket, @MessageBody() payload: FramePayload): Promise<FrameAck> {
    return new Promise<FrameAck>((resolve) => {
      const state = this.state(socket);
      const seq = Number.isFinite(payload?.seq) ? Number(payload.seq) : 0;
      if (!state) return resolve({ ok: false, seq, error: 'unauthorized', status: 401 });

      const image = toBuffer(payload?.image);
      if (!image?.length) return this.fail(socket, resolve, seq, 'empty frame', 400);
      if (image.length > ANPR_MAX_FRAME_BYTES) return this.fail(socket, resolve, seq, 'frame too large', 413);

      // Latest-frame-wins: an unprocessed older frame is dropped (and acked so the client frees its slot).
      state.pending?.ack?.({ ok: true, seq: state.pending.seq, dropped: true });
      state.pending = { seq, image, ack: resolve };
      this.schedule(socket, state);
    });
  }

  @SubscribeMessage('session:reset')
  onReset(@ConnectedSocket() socket: Socket, @MessageBody() payload?: { sessionId?: string }): { ok: boolean } {
    const state = this.state(socket);
    if (!state) return { ok: false };
    if (payload?.sessionId && SESSION_ID.test(payload.sessionId)) {
      this.anpr.dropSession(state.sessionKey);
      state.sessionKey = AnprService.sessionKey(state.user, payload.sessionId);
    }
    this.anpr.resetSession(state.sessionKey);
    return { ok: true };
  }

  @SubscribeMessage('confirm')
  async onConfirm(
    @ConnectedSocket() socket: Socket,
    @MessageBody() payload: { readId?: string; plate?: string; gatePassId?: string },
  ): Promise<{ ok: boolean; error?: string }> {
    const state = this.state(socket);
    if (!state) return { ok: false, error: 'unauthorized' };
    if (typeof payload?.readId !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(payload.readId)) return { ok: false, error: 'invalid readId' };
    try {
      await this.audit.confirm(state.user, payload.readId, {
        plate: typeof payload.plate === 'string' ? payload.plate.slice(0, 32) : undefined,
        gatePassId: typeof payload.gatePassId === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(payload.gatePassId) ? payload.gatePassId : undefined,
      });
      return { ok: true };
    } catch (error) {
      return { ok: false, error: (error as Error).message };
    }
  }

  private async authenticate(socket: Socket): Promise<void> {
    const auth = socket.handshake.auth as { token?: unknown; sessionId?: unknown } | undefined;
    const header = socket.handshake.headers?.authorization;
    const token = typeof auth?.token === 'string'
      ? auth.token.replace(/^Bearer\s+/i, '')
      : typeof header === 'string' && header.startsWith('Bearer ') ? header.slice(7) : undefined;
    const user = await verifyAccessToken(this.jwt, this.prisma, token);
    if (!ANPR_ROLES.includes(user.role)) throw new ForbiddenException('Role not allowed to use plate scanning');
    const sessionId = typeof auth?.sessionId === 'string' && SESSION_ID.test(auth.sessionId) ? auth.sessionId : socket.id.replace(/[^A-Za-z0-9_-]/g, '');
    const state: SocketState = {
      user,
      sessionKey: AnprService.sessionKey(user, sessionId),
      busy: false,
      lastStart: 0,
      pending: null,
      timer: null,
    };
    socket.data.anpr = state;
  }

  private state(socket: Socket): SocketState | undefined {
    return socket.data?.anpr as SocketState | undefined;
  }

  private schedule(socket: Socket, state: SocketState): void {
    if (state.busy || state.timer || !state.pending) return;
    const wait = state.lastStart + MIN_FRAME_INTERVAL_MS - Date.now();
    if (wait > 0) {
      state.timer = setTimeout(() => {
        state.timer = null;
        this.schedule(socket, state);
      }, wait);
      return;
    }
    const frame = state.pending;
    state.pending = null;
    state.busy = true;
    state.lastStart = Date.now();
    void this.process(socket, state, frame).finally(() => {
      state.busy = false;
      if (socket.connected) this.schedule(socket, state);
    });
  }

  private async process(socket: Socket, state: SocketState, frame: PendingFrame): Promise<void> {
    let outcome: FrameOutcome;
    try {
      outcome = await this.anpr.processFrame(state.user, state.sessionKey, frame.image, frame.seq);
    } catch (error) {
      const status = error instanceof HttpException ? error.getStatus() : 500;
      if (status >= 500) this.logger.warn(`frame ${frame.seq} failed: ${(error as Error).message}`);
      this.fail(socket, frame.ack, frame.seq, status >= 500 ? 'recognition unavailable' : (error as Error).message, status);
      return;
    }
    frame.ack?.({ ok: true, seq: frame.seq });
    socket.emit('frame:result', { ...outcome, decision: undefined });
    if (outcome.decision && outcome.engine) {
      socket.emit(outcome.state === 'locked' ? 'plate:locked' : 'plate:candidate', { seq: frame.seq, ...outcome.decision });
    }
  }

  private fail(socket: Socket, ack: Ack<FrameAck> | undefined, seq: number, error: string, status: number): void {
    ack?.({ ok: false, seq, error, status });
    socket.emit('error', { seq, error, status });
  }
}

function toBuffer(value: FramePayload['image']): Buffer | null {
  if (!value) return null;
  if (Buffer.isBuffer(value)) return value;
  if (value instanceof ArrayBuffer) return Buffer.from(value);
  if (ArrayBuffer.isView(value)) return Buffer.from(value.buffer, value.byteOffset, value.byteLength);
  return null;
}
