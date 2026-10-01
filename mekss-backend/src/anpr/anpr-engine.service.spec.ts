import { ConfigService } from '@nestjs/config';
import { AnprEngineService } from './anpr-engine.service';
import { EngineResult, EngineUnavailableError, InvalidImageError } from './anpr.types';
import { CircuitBreaker } from './circuit-breaker';
import { NodeAnprEngine } from './engines/node-anpr.engine';
import { PythonAnprEngine } from './engines/python-anpr.engine';

const result = (engine: 'python' | 'node'): EngineResult => ({
  ok: true,
  engine,
  modelVersion: 'test',
  image: { w: 640, h: 480 },
  candidates: [],
  timings: {},
});

function setup() {
  const python = { name: 'python', recognize: jest.fn(), isAvailable: jest.fn().mockResolvedValue(true) };
  const node = { name: 'node', recognize: jest.fn().mockResolvedValue(result('node')), isAvailable: jest.fn().mockResolvedValue(true) };
  const config = { get: (key: string, fallback?: string) => ({ ANPR_BREAKER_FAILURES: '3', ANPR_BREAKER_COOLDOWN_MS: '30000' } as Record<string, string>)[key] ?? fallback } as ConfigService;
  const service = new AnprEngineService(python as unknown as PythonAnprEngine, node as unknown as NodeAnprEngine, config);
  return { service, python, node };
}

describe('AnprEngineService (engine A with engine B failover)', () => {
  it('uses the Python engine by default', async () => {
    const { service, python, node } = setup();
    python.recognize.mockResolvedValue(result('python'));
    await expect(service.recognize(Buffer.from('x'))).resolves.toMatchObject({ engine: 'python' });
    expect(node.recognize).not.toHaveBeenCalled();
  });

  it('retries the same frame on Node when Python fails, and opens the breaker after 3 failures', async () => {
    const { service, python, node } = setup();
    python.recognize.mockRejectedValue(new EngineUnavailableError('timeout'));
    for (let i = 0; i < 3; i += 1) {
      await expect(service.recognize(Buffer.from('x'))).resolves.toMatchObject({ engine: 'node' });
    }
    expect(service.breakerState).toBe('open');
    await service.recognize(Buffer.from('x'));
    expect(python.recognize).toHaveBeenCalledTimes(3);
    expect(node.recognize).toHaveBeenCalledTimes(4);
  });

  it('does not fail over on an invalid image', async () => {
    const { service, python, node } = setup();
    python.recognize.mockRejectedValue(new InvalidImageError());
    await expect(service.recognize(Buffer.from('x'))).rejects.toBeInstanceOf(InvalidImageError);
    expect(node.recognize).not.toHaveBeenCalled();
    expect(service.breakerState).toBe('closed');
  });
});

describe('CircuitBreaker', () => {
  it('half-opens after the cooldown and closes on a successful trial', () => {
    let now = 0;
    const breaker = new CircuitBreaker(2, 1000, () => now);
    breaker.recordFailure();
    breaker.recordFailure();
    expect(breaker.allowRequest()).toBe(false);
    now = 1000;
    expect(breaker.state).toBe('half-open');
    expect(breaker.allowRequest()).toBe(true);
    expect(breaker.allowRequest()).toBe(false);
    breaker.recordSuccess();
    expect(breaker.state).toBe('closed');
  });

  it('re-opens when the half-open trial fails', () => {
    let now = 0;
    const breaker = new CircuitBreaker(1, 1000, () => now);
    breaker.recordFailure();
    now = 1500;
    expect(breaker.allowRequest()).toBe(true);
    breaker.recordFailure();
    expect(breaker.state).toBe('open');
  });
});
