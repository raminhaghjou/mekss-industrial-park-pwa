import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Subscription } from 'rxjs';
import type { AuthenticatedUser } from '../core/auth.guard';
import { GatePassEvents } from '../core/gate-pass-events';
import { ManagementService } from '../core/management.service';
import type { PositionChoice } from './anpr.types';
import { canonicalPlateOrRaw, plateDistance, substitutionCost } from './plate-grammar';

export interface PlateRead {
  plate: string;
  charConfidences?: number[];
  positions?: PositionChoice[][];
  alternatives?: { plate: string; p: number }[];
}

export type MatchVia = 'exact' | 'alternative' | 'fuzzy';

export interface PlateSuggestion {
  gatePassId: string;
  plate: string;
  distance: number;
}

export interface PlateMatch {
  outcome: 'MATCHED' | 'SUGGESTED' | 'NOT_FOUND';
  via: MatchVia | null;
  matchedPlate: string | null;
  gatePasses: Awaited<ReturnType<ManagementService['gatePassesForGuard']>>;
  suggestions: PlateSuggestion[];
}

interface OpenPlate {
  id: string;
  plate: string;
  createdAt: Date;
}

interface CacheEntry {
  at: number;
  plates: OpenPlate[];
  byPlate: Map<string, OpenPlate[]>;
}

const SUGGEST_MAX_WEIGHTED = 0.6;
const SUGGEST_MAX_DISTANCE = 1;
const MIN_ALTERNATIVE_P = 0.05;
const MAX_SUGGESTIONS = 3;

/**
 * Resolves a recognised plate to the open (pending/approved) gate passes in the guard's scope.
 * Open plates are cached per actor and invalidated on any gate-pass mutation so a newly
 * issued pass is matchable immediately.
 */
@Injectable()
export class PlateMatcherService implements OnModuleDestroy {
  private readonly cache = new Map<string, CacheEntry>();
  private readonly inflight = new Map<string, Promise<CacheEntry>>();
  private readonly subscription: Subscription;
  private readonly ttlMs = Number(process.env.ANPR_MATCH_CACHE_TTL_MS || 20_000);

  constructor(
    private readonly management: ManagementService,
    events: GatePassEvents,
  ) {
    this.subscription = events.changes$.subscribe(() => this.invalidate());
  }

  onModuleDestroy(): void {
    this.subscription.unsubscribe();
  }

  invalidate(): void {
    this.cache.clear();
    this.inflight.clear();
  }

  async match(actor: AuthenticatedUser, read: PlateRead): Promise<PlateMatch> {
    const entry = await this.openPlates(actor);
    const plate = canonicalPlateOrRaw(read.plate);

    const exact = entry.byPlate.get(plate);
    if (exact?.length) return this.resolved(actor, 'MATCHED', 'exact', plate, exact, []);

    for (const alt of read.alternatives ?? []) {
      if (alt.p < MIN_ALTERNATIVE_P) continue;
      const altPlate = canonicalPlateOrRaw(alt.plate);
      const hits = entry.byPlate.get(altPlate);
      if (hits?.length) {
        const suggestions = hits.map((h) => ({ gatePassId: h.id, plate: h.plate, distance: plateDistance(plate, h.plate) }));
        return this.resolved(actor, 'SUGGESTED', 'alternative', altPlate, [], suggestions);
      }
    }

    const scored = entry.plates
      .map((open) => ({ open, weighted: weightedDistance(plate, open.plate, read), distance: plateDistance(plate, open.plate) }))
      .filter((s) => s.weighted <= SUGGEST_MAX_WEIGHTED || s.distance <= SUGGEST_MAX_DISTANCE)
      .sort((a, b) => a.weighted - b.weighted || a.distance - b.distance);
    if (!scored.length) return this.resolved(actor, 'NOT_FOUND', null, null, [], []);

    const unique = new Map<string, (typeof scored)[number]>();
    for (const s of scored) if (!unique.has(s.open.id)) unique.set(s.open.id, s);
    const suggestions = [...unique.values()].slice(0, MAX_SUGGESTIONS).map((s) => ({
      gatePassId: s.open.id,
      plate: s.open.plate,
      distance: round(s.weighted),
    }));
    return this.resolved(actor, 'SUGGESTED', 'fuzzy', suggestions[0].plate, [], suggestions);
  }

  private async resolved(
    actor: AuthenticatedUser,
    outcome: PlateMatch['outcome'],
    via: MatchVia | null,
    matchedPlate: string | null,
    matched: OpenPlate[],
    suggestions: PlateSuggestion[],
  ): Promise<PlateMatch> {
    const ids = [...new Set([...matched.map((m) => m.id), ...suggestions.map((s) => s.gatePassId)])];
    const details = await this.management.gatePassesForGuard(actor, ids);
    const order = new Map(ids.map((id, i) => [id, i]));
    details.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
    if (outcome === 'MATCHED' && !details.length) {
      // The pass closed between the cache fill and now.
      this.invalidate();
      return { outcome: 'NOT_FOUND', via: null, matchedPlate: null, gatePasses: [], suggestions: [] };
    }
    return { outcome, via, matchedPlate, gatePasses: details, suggestions };
  }

  private async openPlates(actor: AuthenticatedUser): Promise<CacheEntry> {
    const cached = this.cache.get(actor.id);
    if (cached && Date.now() - cached.at < this.ttlMs) return cached;
    const pending = this.inflight.get(actor.id);
    if (pending) return pending;
    const load = this.management.openGatePassPlates(actor).then((rows) => {
      const plates = rows.map((row) => ({ id: row.id, plate: canonicalPlateOrRaw(row.licensePlate), createdAt: row.createdAt }));
      const byPlate = new Map<string, OpenPlate[]>();
      for (const p of plates) byPlate.set(p.plate, [...(byPlate.get(p.plate) ?? []), p]);
      const entry = { at: Date.now(), plates, byPlate };
      if (this.inflight.get(actor.id) === load) this.cache.set(actor.id, entry);
      return entry;
    }).finally(() => {
      if (this.inflight.get(actor.id) === load) this.inflight.delete(actor.id);
    });
    this.inflight.set(actor.id, load);
    return load;
  }
}

/**
 * Position-aligned substitution cost weighted by how sure the recogniser was of each character:
 * disagreeing on a low-confidence character is cheap, on a high-confidence one expensive.
 * A character that appears in the recogniser's per-position top-3 costs at most (1 - p).
 */
export function weightedDistance(read: string, open: string, info: PlateRead = { plate: read }): number {
  const a = [...read];
  const b = [...open];
  if (a.length !== b.length) return plateDistance(read, open);
  let total = 0;
  for (let i = 0; i < a.length; i += 1) {
    let cost = substitutionCost(a[i], b[i]);
    if (!cost) continue;
    const alt = info.positions?.[i]?.find((choice) => choice.c === b[i]);
    if (alt) cost = Math.min(cost, 1 - alt.p);
    const conf = info.charConfidences?.[i] ?? 1;
    total += cost * (0.35 + 0.65 * conf);
  }
  return total;
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}
