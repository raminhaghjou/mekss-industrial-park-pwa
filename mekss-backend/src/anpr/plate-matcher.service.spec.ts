import { Role } from '@prisma/client';
import { GatePassEvents } from '../core/gate-pass-events';
import { ManagementService } from '../core/management.service';
import { PlateMatcherService, weightedDistance } from './plate-matcher.service';

const actor = { id: 'guard-1', role: Role.SECURITY_GUARD, phoneNumber: '09120000000' };

function setup(plates: { id: string; licensePlate: string }[]) {
  const openGatePassPlates = jest.fn().mockResolvedValue(
    plates.map((p) => ({ ...p, plateType: 'PRIVATE', factoryId: 'f1', createdAt: new Date() })),
  );
  const gatePassesForGuard = jest.fn(async (_actor: unknown, ids: string[]) =>
    ids.map((id) => ({ id, licensePlate: plates.find((p) => p.id === id)?.licensePlate })),
  );
  const management = { openGatePassPlates, gatePassesForGuard } as unknown as ManagementService;
  const events = new GatePassEvents();
  const matcher = new PlateMatcherService(management, events);
  return { matcher, events, openGatePassPlates, gatePassesForGuard };
}

describe('PlateMatcherService', () => {
  it('matches exactly, including legacy spaced plates', async () => {
    const { matcher } = setup([{ id: 'gp1', licensePlate: '12 ب 345 67' }]);
    const result = await matcher.match(actor, { plate: '12ب34567' });
    expect(result.outcome).toBe('MATCHED');
    expect(result.via).toBe('exact');
    expect(result.gatePasses.map((g) => g.id)).toEqual(['gp1']);
  });

  it('suggests a pass reachable through an N-best alternative', async () => {
    const { matcher } = setup([{ id: 'gp1', licensePlate: '12پ34567' }]);
    const result = await matcher.match(actor, {
      plate: '12ب34567',
      alternatives: [{ plate: '12ب34567', p: 0.7 }, { plate: '12پ34567', p: 0.25 }],
    });
    expect(result.outcome).toBe('SUGGESTED');
    expect(result.via).toBe('alternative');
    expect(result.suggestions[0].gatePassId).toBe('gp1');
  });

  it('suggests a single confusable misread on a low-confidence character', async () => {
    const { matcher } = setup([{ id: 'gp1', licensePlate: '12س34567' }, { id: 'gp2', licensePlate: '77م11122' }]);
    const conf = [0.99, 0.99, 0.5, 0.99, 0.99, 0.99, 0.99, 0.99];
    const result = await matcher.match(actor, { plate: '12ش34567', charConfidences: conf });
    expect(result.outcome).toBe('SUGGESTED');
    expect(result.via).toBe('fuzzy');
    expect(result.suggestions.map((s) => s.gatePassId)).toEqual(['gp1']);
  });

  it('reports not found for unrelated plates', async () => {
    const { matcher } = setup([{ id: 'gp1', licensePlate: '98م76543' }]);
    const result = await matcher.match(actor, { plate: '12ب34567' });
    expect(result.outcome).toBe('NOT_FOUND');
    expect(result.gatePasses).toEqual([]);
  });

  it('caches open plates and invalidates on gate-pass changes', async () => {
    const { matcher, events, openGatePassPlates } = setup([{ id: 'gp1', licensePlate: '12ب34567' }]);
    await matcher.match(actor, { plate: '12ب34567' });
    await matcher.match(actor, { plate: '12ب34567' });
    expect(openGatePassPlates).toHaveBeenCalledTimes(1);
    events.emit({ gatePassId: 'gp2', factoryId: 'f1', kind: 'created' });
    await matcher.match(actor, { plate: '12ب34567' });
    expect(openGatePassPlates).toHaveBeenCalledTimes(2);
    matcher.onModuleDestroy();
  });

  it('weights disagreement by character confidence', () => {
    const sure = weightedDistance('12ب34567', '12ب34568', { plate: '', charConfidences: Array(8).fill(1) });
    const unsure = weightedDistance('12ب34567', '12ب34568', { plate: '', charConfidences: [1, 1, 1, 1, 1, 1, 1, 0.2] });
    expect(unsure).toBeLessThan(sure);
    const inTopK = weightedDistance('12ب34567', '12ب34568', {
      plate: '',
      positions: [[], [], [], [], [], [], [], [{ c: '7', p: 0.55 }, { c: '8', p: 0.45 }]],
    });
    expect(inTopK).toBeLessThanOrEqual(0.4);
  });
});
