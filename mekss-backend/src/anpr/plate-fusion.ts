import { EngineCandidate, PositionChoice } from './anpr.types';
import { normalizePlate, plateDistance } from './plate-grammar';

export interface FusionConfig {
  /** Frames that must agree (top-1) before locking with `lockConfidence`. */
  minAgreeingFrames: number;
  lockConfidence: number;
  /**
   * Only agreeing frames at least this confident count towards `minAgreeingFrames`: errors on one
   * vehicle are correlated (same glyph, same light), so agreement between weak frames is not
   * independent evidence.
   */
  minFrameConfidence: number;
  /** Fast path: fewer frames are enough when each is individually near-certain. */
  fastFrames: number;
  fastFrameConfidence: number;
  /** Weight multiplier applied to older frames on every new frame. */
  decay: number;
  /** After this many readable frames without a lock, surface the best guess for manual confirmation. */
  maxFramesBeforeCandidate: number;
}

export const DEFAULT_FUSION: FusionConfig = {
  minAgreeingFrames: 3,
  lockConfidence: 0.97,
  minFrameConfidence: 0.85,
  fastFrames: 2,
  fastFrameConfidence: 0.99,
  decay: 0.85,
  maxFramesBeforeCandidate: 10,
};

export interface FusedPlate {
  plate: string;
  confidence: number;
  charConfidences: number[];
  positions: PositionChoice[][];
  agreeingFrames: number;
  frames: number;
  plateType: EngineCandidate['plateType'];
  color: string;
  alternatives: { plate: string; p: number }[];
  best: EngineCandidate;
}

export type FusionUpdate =
  | { state: 'scanning'; fused: FusedPlate | null }
  | { state: 'locked'; fused: FusedPlate }
  | { state: 'candidate'; fused: FusedPlate };

const PLATE_LEN = 8;
const LETTER_POS = 2;
const MIN_P = 1e-3;
const alphabetSize = (pos: number) => (pos === LETTER_POS ? 22 : 10);

/**
 * Per-session temporal fusion. Each position accumulates confidence-tempered log-likelihoods
 * across frames (older frames decay), and the fused per-character probability is the normalised
 * posterior, so agreeing frames raise certainty, one blurred misread cannot flip a character,
 * and a new vehicle quickly displaces the previous one.
 */
export class PlateFusion {
  /** Per position: character → accumulated log-likelihood. */
  private scores: Array<Map<string, number>> = [];
  /** Per position: accumulated log-likelihood of a character no frame has proposed yet. */
  private unseen: number[] = [];
  /** Per plate: agreeing frames, and how many of them cleared the per-frame lock bars. */
  private hits = new Map<string, { count: number; strong: number; certain: number; best: EngineCandidate }>();
  private frames = 0;
  private locked: FusedPlate | null = null;
  private candidateEmitted = false;
  private lastTop: string | null = null;
  private disagreeStreak = 0;

  constructor(private readonly cfg: FusionConfig = DEFAULT_FUSION) {
    this.reset();
  }

  get isLocked(): boolean {
    return this.locked !== null;
  }

  reset(): void {
    this.scores = Array.from({ length: PLATE_LEN }, () => new Map());
    this.unseen = Array.from({ length: PLATE_LEN }, () => 0);
    this.hits.clear();
    this.frames = 0;
    this.locked = null;
    this.candidateEmitted = false;
    this.lastTop = null;
    this.disagreeStreak = 0;
  }

  push(candidate: EngineCandidate | null): FusionUpdate {
    if (this.locked) return { state: 'locked', fused: this.locked };
    if (!candidate?.valid || candidate.positions.length !== PLATE_LEN) {
      return { state: 'scanning', fused: this.current() };
    }

    // A clearly different, confident plate for two frames in a row means a new vehicle.
    const fused = this.current();
    if (fused && candidate.confidence > 0.8 && plateDistance(fused.plate, candidate.plate) >= 2.5) {
      this.disagreeStreak += 1;
      if (this.disagreeStreak >= 2) this.reset();
    } else {
      this.disagreeStreak = 0;
    }

    this.frames += 1;
    const weight = Math.max(0.05, candidate.confidence);
    candidate.positions.forEach((choices, pos) => {
      const map = this.scores[pos];
      for (const [k, v] of map) map.set(k, v * this.cfg.decay);
      this.unseen[pos] *= this.cfg.decay;
      const listed = choices.reduce((a, ch) => a + ch.p, 0);
      const floorLog = Math.log(Math.max(MIN_P, (1 - listed) / alphabetSize(pos)));
      const proposed = new Map(choices.map((ch) => [ch.c, Math.log(Math.max(MIN_P, ch.p))]));
      for (const c of proposed.keys()) if (!map.has(c)) map.set(c, this.unseen[pos]);
      for (const [c, v] of map) map.set(c, v + weight * (proposed.get(c) ?? floorLog));
      this.unseen[pos] += weight * floorLog;
    });
    const hit = this.hits.get(candidate.plate) ?? { count: 0, strong: 0, certain: 0, best: candidate };
    hit.count += 1;
    if (candidate.confidence >= this.cfg.minFrameConfidence) hit.strong += 1;
    if (candidate.confidence >= this.cfg.fastFrameConfidence) hit.certain += 1;
    if (candidate.confidence > hit.best.confidence) hit.best = candidate;
    this.hits.set(candidate.plate, hit);
    this.lastTop = candidate.plate;

    const next = this.current() as FusedPlate;
    const agree = this.hits.get(next.plate);
    const lock = next.confidence >= this.cfg.lockConfidence && (
      (agree?.strong ?? 0) >= this.cfg.minAgreeingFrames
      || (agree?.certain ?? 0) >= this.cfg.fastFrames);
    if (lock) {
      this.locked = next;
      return { state: 'locked', fused: next };
    }
    if (!this.candidateEmitted && this.frames >= this.cfg.maxFramesBeforeCandidate) {
      this.candidateEmitted = true;
      return { state: 'candidate', fused: next };
    }
    return { state: 'scanning', fused: next };
  }

  current(): FusedPlate | null {
    if (!this.frames) return null;
    const chars: string[] = [];
    const charConfidences: number[] = [];
    const positions: PositionChoice[][] = [];
    this.scores.forEach((map, pos) => {
      const ranked = [...map.entries()].sort((a, b) => b[1] - a[1]);
      const top = ranked[0]?.[1] ?? 0;
      const others = Math.max(0, alphabetSize(pos) - map.size);
      const total = ranked.reduce((a, [, v]) => a + Math.exp(v - top), 0) + others * Math.exp(this.unseen[pos] - top);
      const posterior = (v: number) => Math.exp(v - top) / total;
      chars.push(ranked[0]?.[0] ?? '?');
      charConfidences.push(ranked.length ? posterior(top) : 0);
      positions.push(ranked.slice(0, 3).map(([c, v]) => ({ c, p: Math.round(posterior(v) * 10_000) / 10_000 })));
    });
    const plate = chars.join('');
    const confidence = charConfidences.reduce((a, b) => a * b, 1);
    const agree = this.hits.get(plate);
    const best = agree?.best ?? [...this.hits.values()].sort((a, b) => b.count - a.count)[0].best;
    const totalHits = [...this.hits.values()].reduce((a, h) => a + h.count, 0) || 1;
    return {
      plate,
      confidence,
      charConfidences,
      positions,
      agreeingFrames: agree?.count ?? 0,
      frames: this.frames,
      plateType: normalizePlate(plate).plateType ?? best.plateType,
      color: best.color,
      alternatives: [...this.hits.entries()]
        .sort((a, b) => b[1].count - a[1].count)
        .slice(0, 5)
        .map(([p, h]) => ({ plate: p, p: Math.round((h.count / totalHits) * 10_000) / 10_000 })),
      best,
    };
  }
}
