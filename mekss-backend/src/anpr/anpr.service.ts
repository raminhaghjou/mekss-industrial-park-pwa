import { BadRequestException, Injectable, OnModuleDestroy, ServiceUnavailableException } from '@nestjs/common';
import { PlateReadEngine, PlateReadOutcome } from '@prisma/client';
import type { AuthenticatedUser } from '../core/auth.guard';
import { ManagementService } from '../core/management.service';
import { AnprEngineService } from './anpr-engine.service';
import { EngineCandidate, EngineResult, EngineUnavailableError, InvalidImageError } from './anpr.types';
import type { MatchPlateDto } from './anpr.dto';
import { FusedPlate, PlateFusion } from './plate-fusion';
import { canonicalPlateOrRaw, displayPlate, normalizePlate } from './plate-grammar';
import { PlateMatch, PlateMatcherService } from './plate-matcher.service';
import { PlateReadAuditService } from './plate-read-audit.service';

export type ScanState = 'scanning' | 'locked' | 'candidate';

export interface PlateDecision {
  readId: string | null;
  plate: string;
  display: string;
  plateType: string | null;
  color: string;
  colorConflict: boolean;
  confidence: number;
  charConfidences: number[];
  frames: number;
  engine: string;
  requiresConfirmation: boolean;
  match: PlateMatch;
}

export interface FrameOutcome {
  seq: number;
  state: ScanState;
  engine: string | null;
  latencyMs: number;
  image: { w: number; h: number } | null;
  candidates: Array<Pick<EngineCandidate, 'bbox' | 'plate' | 'valid' | 'confidence' | 'plateType' | 'color'>>;
  fused: Pick<FusedPlate, 'plate' | 'confidence' | 'charConfidences' | 'agreeingFrames' | 'frames'> | null;
  decision?: PlateDecision;
}

interface Session {
  fusion: PlateFusion;
  lastSeen: number;
  parkId?: Promise<string | null>;
  decision?: PlateDecision;
}

const SESSION_IDLE_MS = 120_000;
const MAX_SESSIONS = 2_000;

@Injectable()
export class AnprService implements OnModuleDestroy {
  private readonly sessions = new Map<string, Session>();
  private readonly sweeper = setInterval(() => this.sweep(), 30_000);

  constructor(
    private readonly engines: AnprEngineService,
    private readonly matcher: PlateMatcherService,
    private readonly audit: PlateReadAuditService,
    private readonly management: ManagementService,
  ) {
    this.sweeper.unref?.();
  }

  onModuleDestroy(): void {
    clearInterval(this.sweeper);
  }

  static sessionKey(actor: AuthenticatedUser, sessionId: string): string {
    return `${actor.id}:${sessionId}`;
  }

  resetSession(key: string): void {
    this.sessions.get(key)?.fusion.reset();
    const session = this.sessions.get(key);
    if (session) session.decision = undefined;
  }

  dropSession(key: string): void {
    this.sessions.delete(key);
  }

  async processFrame(actor: AuthenticatedUser, key: string, image: Buffer, seq = 0): Promise<FrameOutcome> {
    const started = Date.now();
    const session = this.session(key);
    if (session.fusion.isLocked && session.decision) {
      return { seq, state: 'locked', engine: null, latencyMs: 0, image: null, candidates: [], fused: compactFused(session.fusion.current()), decision: session.decision };
    }

    const result = await this.recognize(image);
    const best = pickCandidate(result.candidates, session.fusion.current()?.plate ?? null);
    const update = session.fusion.push(best);
    const outcome: FrameOutcome = {
      seq,
      state: update.state,
      engine: result.engine,
      latencyMs: Date.now() - started,
      image: result.image,
      candidates: result.candidates.map((c) => ({ bbox: c.bbox, plate: c.plate, valid: c.valid, confidence: c.confidence, plateType: c.plateType, color: c.color })),
      fused: compactFused(update.fused),
    };

    if (update.state !== 'scanning' && update.fused) {
      const engine = result.engine === 'python' ? PlateReadEngine.PYTHON : PlateReadEngine.NODE;
      session.decision = await this.decide(actor, session, update.fused, {
        engine,
        requiresConfirmation: update.state === 'candidate',
        image,
        bbox: (best?.plate === update.fused.plate ? best : update.fused.best).bbox,
        latencyMs: outcome.latencyMs,
        sessionId: key.split(':').slice(1).join(':'),
      });
      outcome.decision = session.decision;
    }
    return outcome;
  }

  /** A single still photo (browsers without live camera): decide from one frame, confirm if unsure. */
  async processPhoto(actor: AuthenticatedUser, image: Buffer): Promise<FrameOutcome> {
    const started = Date.now();
    const result = await this.recognize(image);
    const best = pickCandidate(result.candidates, null);
    const outcome: FrameOutcome = {
      seq: 0,
      state: 'scanning',
      engine: result.engine,
      latencyMs: Date.now() - started,
      image: result.image,
      candidates: result.candidates.map((c) => ({ bbox: c.bbox, plate: c.plate, valid: c.valid, confidence: c.confidence, plateType: c.plateType, color: c.color })),
      fused: null,
    };
    if (!best?.valid) return outcome;
    const fusion = new PlateFusion();
    fusion.push(best);
    const fused = fusion.current() as FusedPlate;
    const confident = best.confidence >= 0.97;
    outcome.state = confident ? 'locked' : 'candidate';
    outcome.fused = compactFused(fused);
    outcome.decision = await this.decide(actor, { fusion, lastSeen: Date.now() }, fused, {
      engine: result.engine === 'python' ? PlateReadEngine.PYTHON : PlateReadEngine.NODE,
      requiresConfirmation: !confident,
      image,
      bbox: best.bbox,
      latencyMs: outcome.latencyMs,
      sessionId: 'photo',
    });
    return outcome;
  }

  /** Match + audit a plate recognised on the device or typed by the guard. */
  async matchPlate(actor: AuthenticatedUser, input: MatchPlateDto): Promise<PlateDecision> {
    const normalized = normalizePlate(input.plate);
    const plate = canonicalPlateOrRaw(input.plate);
    const confidence = input.confidence ?? (input.engine === 'DEVICE' ? 0 : 1);
    const match = await this.matcher.match(actor, { plate, charConfidences: input.charConfidences, alternatives: input.alternatives });
    const engine = input.engine === 'DEVICE' ? PlateReadEngine.DEVICE : PlateReadEngine.MANUAL;
    const readId = await this.audit.record({
      actor,
      parkId: await this.management.actorParkId(actor).catch(() => null),
      sessionId: input.sessionId,
      engine,
      outcome: auditOutcome(match),
      rawText: input.plate,
      plate,
      plateType: normalized.plateType,
      confidence,
      frames: input.frames,
      latencyMs: input.latencyMs,
      gatePassId: match.outcome === 'MATCHED' ? match.gatePasses[0]?.id : null,
    });
    return {
      readId,
      plate,
      display: displayPlate(plate),
      plateType: normalized.plateType,
      color: 'unknown',
      colorConflict: false,
      confidence,
      charConfidences: input.charConfidences ?? [],
      frames: input.frames ?? 1,
      engine: engine.toLowerCase(),
      requiresConfirmation: engine === PlateReadEngine.DEVICE && confidence < 0.97,
      match,
    };
  }

  private async decide(
    actor: AuthenticatedUser,
    session: Session,
    fused: FusedPlate,
    meta: { engine: PlateReadEngine; requiresConfirmation: boolean; image: Buffer; bbox: EngineCandidate['bbox']; latencyMs: number; sessionId: string },
  ): Promise<PlateDecision> {
    const match = await this.matcher.match(actor, fused);
    session.parkId ??= this.management.actorParkId(actor).catch(() => null);
    const readId = await this.audit.record({
      actor,
      parkId: await session.parkId,
      sessionId: meta.sessionId,
      engine: meta.engine,
      outcome: auditOutcome(match),
      rawText: fused.best.raw || fused.plate,
      plate: fused.plate,
      plateType: fused.plateType,
      confidence: fused.confidence,
      frames: fused.frames,
      latencyMs: meta.latencyMs,
      bbox: meta.bbox,
      gatePassId: match.outcome === 'MATCHED' ? match.gatePasses[0]?.id : null,
      image: meta.image,
    });
    return {
      readId,
      plate: fused.plate,
      display: displayPlate(fused.plate),
      plateType: fused.plateType,
      color: fused.color,
      colorConflict: fused.best.colorConflict,
      confidence: fused.confidence,
      charConfidences: fused.charConfidences,
      frames: fused.frames,
      engine: meta.engine.toLowerCase(),
      requiresConfirmation: meta.requiresConfirmation || match.outcome !== 'MATCHED',
      match,
    };
  }

  private async recognize(image: Buffer): Promise<EngineResult> {
    try {
      return await this.engines.recognize(image);
    } catch (error) {
      if (error instanceof InvalidImageError) throw new BadRequestException(error.message);
      if (error instanceof EngineUnavailableError) throw new ServiceUnavailableException('Plate recognition is temporarily unavailable');
      throw error;
    }
  }

  private session(key: string): Session {
    let session = this.sessions.get(key);
    if (!session) {
      if (this.sessions.size >= MAX_SESSIONS) this.sweep(true);
      session = { fusion: new PlateFusion(), lastSeen: Date.now() };
      this.sessions.set(key, session);
    }
    session.lastSeen = Date.now();
    return session;
  }

  private sweep(force = false): void {
    const cutoff = Date.now() - (force ? SESSION_IDLE_MS / 4 : SESSION_IDLE_MS);
    for (const [key, session] of this.sessions) if (session.lastSeen < cutoff) this.sessions.delete(key);
  }
}

/** Prefer the candidate continuing the plate being fused, then valid, then most confident. */
export function pickCandidate(candidates: EngineCandidate[], tracking: string | null): EngineCandidate | null {
  if (!candidates.length) return null;
  const ranked = [...candidates].sort((a, b) =>
    Number(b.plate === tracking) - Number(a.plate === tracking)
    || Number(b.valid) - Number(a.valid)
    || b.confidence - a.confidence);
  return ranked[0];
}

function auditOutcome(match: PlateMatch): PlateReadOutcome {
  if (match.outcome === 'MATCHED') return PlateReadOutcome.MATCHED;
  if (match.outcome === 'SUGGESTED') return PlateReadOutcome.SUGGESTED;
  return PlateReadOutcome.NOT_FOUND;
}

function compactFused(fused: FusedPlate | null): FrameOutcome['fused'] {
  if (!fused) return null;
  return {
    plate: fused.plate,
    confidence: fused.confidence,
    charConfidences: fused.charConfidences,
    agreeingFrames: fused.agreeingFrames,
    frames: fused.frames,
  };
}
