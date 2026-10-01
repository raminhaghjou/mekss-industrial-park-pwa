import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { bilateral, clahe, gaussianBlur, prepCrnnGray, resizeArea, resizeCubic } from './crnnPrep.js';
import { cropEnhanceToCrnnTensor } from './plateOcrCore.js';

const fixture = JSON.parse(
  readFileSync(resolve(process.cwd(), '..', 'shared', 'anpr', 'crnn-prep.opencv.json'), 'utf8'),
);

const gray = (w, h, data) => ({ data: Uint8Array.from(data), width: w, height: h });

function diff(actual, expected) {
  expect(actual.length).toBe(expected.length);
  let max = 0;
  let sum = 0;
  for (let i = 0; i < expected.length; i += 1) {
    const d = Math.abs(actual[i] - expected[i]);
    max = Math.max(max, d);
    sum += d;
  }
  return { max, mean: sum / expected.length };
}

describe('crnnPrep (OpenCV parity with mekss-anpr prep_crnn)', () => {
  const { stage } = fixture;
  const src = gray(stage.w, stage.h, stage.data);

  it('matches each OpenCV stage to within one grey level', () => {
    expect(diff(bilateral(src, 5, 45, 45).data, stage.bilateral).max).toBeLessThanOrEqual(1);
    expect(diff(clahe(src, 2, 8, 8).data, stage.clahe).max).toBeLessThanOrEqual(1);
    expect(diff(gaussianBlur(src, 1).data, stage.gaussian).max).toBeLessThanOrEqual(1);
    expect(diff(resizeCubic(src, 60, 40).data, stage.cubic_40x60).max).toBeLessThanOrEqual(1);
    expect(diff(resizeArea(src, 20, 8).data, stage.area_20x8).max).toBeLessThanOrEqual(1);
    expect(diff(resizeArea(src, 40, 8).data, stage.area_40x8).max).toBeLessThanOrEqual(1);
  });

  it.each([
    ['upscaled (h < 40)', fixture.small],
    ['full-size', fixture.plate],
  ])('reproduces the full transform for a %s plate', (_label, c) => {
    const tensor = prepCrnnGray(gray(c.w, c.h, c.data), 128, 32);
    expect(diff(Array.from(tensor, (v) => Math.round(v * 255)), c.prep).mean).toBeLessThan(1);
  });

  it('crops ImageData (RGBA) at the detector box and feeds the same transform', () => {
    const { w, h, data } = fixture.plate;
    const W = w + 10;
    const H = h + 6;
    const rgba = new Uint8ClampedArray(W * H * 4).fill(255);
    data.forEach((v, i) => {
      const p = ((Math.floor(i / w) + 4) * W + (i % w) + 7) * 4;
      rgba[p] = v;
      rgba[p + 1] = v;
      rgba[p + 2] = v;
    });
    const { tensor, cropBox } = cropEnhanceToCrnnTensor({ width: W, height: H, data: rgba }, { x: 7, y: 4, w, h });
    expect(cropBox).toEqual({ x: 7, y: 4, w, h });
    expect(tensor).toHaveLength(128 * 32);
    expect(diff(Array.from(tensor, (v) => Math.round(v * 255)), fixture.plate.prep).mean).toBeLessThan(1);
  });
});
