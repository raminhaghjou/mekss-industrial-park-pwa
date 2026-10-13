import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const workers = [];

class FakeWorker {
  constructor() {
    this.messages = [];
    this.terminated = false;
    workers.push(this);
  }

  postMessage(message) {
    this.messages.push(message);
  }

  terminate() {
    this.terminated = true;
  }

  reply(data) {
    this.onmessage?.({ data });
  }
}

describe('iranPlateOcrClient', () => {
  let client;

  beforeEach(async () => {
    vi.useFakeTimers();
    vi.resetModules();
    workers.length = 0;
    vi.stubGlobal('Worker', FakeWorker);
    vi.stubGlobal('OffscreenCanvas', class {});
    vi.stubGlobal('createImageBitmap', vi.fn(async () => ({ width: 10, height: 10, close: vi.fn() })));
    client = await import('./iranPlateOcrClient');
  });

  afterEach(() => {
    client.terminateIranPlateOcr();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('resolves a recognition with the worker result in the requested mode', async () => {
    const pending = client.recognizeIranPlate(new Blob(['x']), { mode: 'photo' });
    await vi.waitFor(() => expect(workers[0]?.messages).toHaveLength(1));
    const message = workers[0].messages[0];
    expect(message).toMatchObject({ type: 'recognize', mode: 'photo' });
    workers[0].reply({ type: 'result', id: message.id, result: { plate: '12ب34567', valid: true } });
    await expect(pending).resolves.toMatchObject({ plate: '12ب34567' });
  });

  it('terminates a hung worker after the deadline and starts a fresh one next time', async () => {
    const pending = client.recognizeIranPlate(new Blob(['x']));
    const assertion = expect(pending).rejects.toThrow();
    await vi.waitFor(() => expect(workers[0]?.messages).toHaveLength(1));
    await vi.advanceTimersByTimeAsync(client.RECOGNIZE_TIMEOUT_MS.live + 10);
    await assertion;
    expect(workers[0].terminated).toBe(true);

    const next = client.recognizeIranPlate(new Blob(['x']));
    await vi.waitFor(() => expect(workers).toHaveLength(2));
    const message = workers[1].messages[0];
    workers[1].reply({ type: 'result', id: message.id, result: { valid: false } });
    await expect(next).resolves.toEqual({ valid: false });
  });

  it('rejects pending calls and resets when the worker crashes', async () => {
    const warm = client.warmIranPlateOcr();
    const assertion = expect(warm).rejects.toThrow('boom');
    workers[0].onerror({ message: 'boom', preventDefault: vi.fn() });
    await assertion;
    expect(workers[0].terminated).toBe(true);
    client.warmIranPlateOcr().catch(() => undefined);
    expect(workers).toHaveLength(2);
  });

  it('shares one warm-up between concurrent callers', async () => {
    const a = client.warmIranPlateOcr();
    const b = client.warmIranPlateOcr();
    expect(workers[0].messages).toHaveLength(1);
    workers[0].reply({ type: 'inited', id: workers[0].messages[0].id });
    await expect(Promise.all([a, b])).resolves.toEqual([true, true]);
  });
});
