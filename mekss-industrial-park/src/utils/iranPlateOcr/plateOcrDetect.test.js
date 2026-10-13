import { describe, expect, it } from 'vitest';
import { cropImageData, letterboxRgbToYoloTensor, mergeBoxes, tileWindows } from './plateOcrCore';

const solid = (width, height, rgb) => {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < width * height; i += 1) data.set([...rgb, 255], i * 4);
  return { data, width, height };
};

describe('multi-scale detection helpers', () => {
  it('splits a photo into four overlapping tiles that stay inside the frame', () => {
    const tiles = tileWindows(1600, 1200);
    expect(tiles).toHaveLength(4);
    expect(tiles[0]).toEqual({ x: 0, y: 0, w: 992, h: 744 });
    expect(tiles[3]).toEqual({ x: 608, y: 456, w: 992, h: 744 });
    tiles.forEach((t) => {
      expect(t.x + t.w).toBeLessThanOrEqual(1600);
      expect(t.y + t.h).toBeLessThanOrEqual(1200);
    });
  });

  it('merges duplicate boxes from overlapping tiles, keeping the most confident', () => {
    const merged = mergeBoxes([
      { x: 100, y: 100, w: 200, h: 50, conf: 0.4 },
      { x: 104, y: 101, w: 198, h: 50, conf: 0.8 },
      { x: 900, y: 700, w: 180, h: 40, conf: 0.3 },
    ]);
    expect(merged.map((b) => b.conf)).toEqual([0.8, 0.3]);
  });

  it('crops raw RGBA without a canvas', () => {
    const img = solid(4, 4, [10, 20, 30]);
    img.data.set([255, 0, 0, 255], (2 * 4 + 3) * 4);
    const crop = cropImageData(img, { x: 2, y: 1, w: 2, h: 2 });
    expect(crop.width).toBe(2);
    expect(crop.height).toBe(2);
    expect([...crop.data.slice(12, 16)]).toEqual([255, 0, 0, 255]);
  });

  it('letterboxes without OffscreenCanvas (older Safari workers)', () => {
    expect(typeof OffscreenCanvas).toBe('undefined');
    const meta = letterboxRgbToYoloTensor(solid(200, 100, [255, 0, 0]), 64);
    expect(meta).toMatchObject({ gain: 0.32, padX: 0, padY: 16, size: 64 });
    const plane = 64 * 64;
    expect(meta.tensor[32 * 64 + 32]).toBeCloseTo(1);
    expect(meta.tensor[plane + 32 * 64 + 32]).toBeCloseTo(0);
    expect(meta.tensor[0]).toBeCloseTo(114 / 255);
  });
});
