import { JwtService } from '@nestjs/jwt';
import { Role } from '@prisma/client';
import { PrismaService } from '../core/prisma.service';
import { AnprGateway } from './anpr.gateway';
import { AnprService, FrameOutcome } from './anpr.service';
import { PlateReadAuditService } from './plate-read-audit.service';

type Middleware = (socket: FakeSocket, next: (err?: Error) => void) => void;

class FakeSocket {
  id = 'sock-1';
  connected = true;
  data: Record<string, unknown> = {};
  emitted: Array<[string, unknown]> = [];
  constructor(public handshake: { auth?: Record<string, unknown>; headers?: Record<string, string> }) {}
  emit(event: string, payload: unknown) {
    this.emitted.push([event, payload]);
    return true;
  }
}

function setup(role: Role = Role.SECURITY_GUARD, valid = true) {
  const jwt = { verifyAsync: jest.fn(async () => (valid ? { sub: 'user-1', sessionVersion: 0 } : Promise.reject(new Error('bad')))) } as unknown as JwtService;
  const prisma = {
    user: { findUnique: jest.fn().mockResolvedValue({ id: 'user-1', role, phoneNumber: '0912', isActive: true, isApproved: true, sessionVersion: 0 }) },
  } as unknown as PrismaService;
  const outcome: FrameOutcome = { seq: 1, state: 'scanning', engine: 'python', latencyMs: 20, image: { w: 640, h: 200 }, candidates: [], fused: null };
  const anpr = {
    processFrame: jest.fn().mockResolvedValue(outcome),
    resetSession: jest.fn(),
    dropSession: jest.fn(),
  } as unknown as AnprService;
  const audit = { confirm: jest.fn().mockResolvedValue({}) } as unknown as PlateReadAuditService;
  const gateway = new AnprGateway(jwt, prisma, anpr, audit);
  let middleware: Middleware | undefined;
  gateway.afterInit({ use: (fn: Middleware) => { middleware = fn; } } as never);
  const connect = (socket: FakeSocket) =>
    new Promise<Error | undefined>((resolve) => middleware!(socket, (err) => resolve(err)));
  return { gateway, anpr, audit, connect };
}

describe('AnprGateway', () => {
  it('rejects a handshake without a token', async () => {
    const { connect } = setup();
    const err = await connect(new FakeSocket({ auth: {} }));
    expect(err?.message).toBe('unauthorized');
  });

  it('rejects an invalid token', async () => {
    const { connect } = setup(Role.SECURITY_GUARD, false);
    const err = await connect(new FakeSocket({ auth: { token: 'nope' } }));
    expect(err?.message).toBe('unauthorized');
  });

  it('rejects roles that may not scan plates', async () => {
    const { connect } = setup(Role.FACTORY_OWNER);
    const err = await connect(new FakeSocket({ auth: { token: 'ok' } }));
    expect(err?.message).toBe('forbidden');
  });

  it.each([Role.SECURITY_GUARD, Role.PARK_MANAGER, Role.SUPER_ADMIN])('admits %s and processes frames', async (role) => {
    const { gateway, anpr, connect } = setup(role);
    const socket = new FakeSocket({ auth: { token: 'ok', sessionId: 'gate-1' } });
    expect(await connect(socket)).toBeUndefined();
    const ack = await gateway.onFrame(socket as never, { seq: 1, image: Buffer.from([0xff, 0xd8, 0xff]) });
    expect(ack).toEqual({ ok: true, seq: 1 });
    expect(anpr.processFrame).toHaveBeenCalledWith(expect.objectContaining({ id: 'user-1' }), 'user-1:gate-1', expect.any(Buffer), 1);
    expect(socket.emitted.map(([event]) => event)).toContain('frame:result');
  });

  it('rejects oversized frames', async () => {
    const { gateway, connect } = setup();
    const socket = new FakeSocket({ auth: { token: 'ok' } });
    await connect(socket);
    const ack = await gateway.onFrame(socket as never, { seq: 2, image: Buffer.alloc(401 * 1024) });
    expect(ack).toMatchObject({ ok: false, status: 413 });
  });

  it('keeps only the newest pending frame', async () => {
    const { gateway, anpr, connect } = setup();
    let release!: () => void;
    (anpr.processFrame as jest.Mock).mockImplementationOnce(() => new Promise((resolve) => {
      release = () => resolve({ seq: 1, state: 'scanning', engine: 'python', latencyMs: 1, image: null, candidates: [], fused: null });
    }));
    const socket = new FakeSocket({ auth: { token: 'ok' } });
    await connect(socket);
    const img = Buffer.from([1, 2, 3]);
    const first = gateway.onFrame(socket as never, { seq: 1, image: img });
    const second = gateway.onFrame(socket as never, { seq: 2, image: img });
    const third = gateway.onFrame(socket as never, { seq: 3, image: img });
    await expect(second).resolves.toEqual({ ok: true, seq: 2, dropped: true });
    release();
    await expect(first).resolves.toEqual({ ok: true, seq: 1 });
    await expect(third).resolves.toEqual({ ok: true, seq: 3 });
    expect(anpr.processFrame).toHaveBeenCalledTimes(2);
  });
});
