import { readFileSync } from 'fs';
import { join } from 'path';
import { GrayImage, bilateral, clahe, gaussianBlur, prepCrnnGray, resizeArea, resizeCubic } from './crnn-prep';
import { prepCrnn } from './node-image-ops';

type Case = { w: number; h: number; data: number[]; prep: number[] };
const fixturePath = join(__dirname, '..', '..', '..', '..', 'shared', 'anpr', 'crnn-prep.opencv.json');
const fixture = JSON.parse(readFileSync(fixturePath, 'utf8')) as {
  small: Case;
  plate: Case;
  stage: { w: number; h: number; data: number[] } & Record<string, number[]>;
};

const gray = (w: number, h: number, data: number[]): GrayImage => ({ data: Uint8Array.from(data), width: w, height: h });

function diff(actual: ArrayLike<number>, expected: number[]) {
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

describe('crnn-prep (OpenCV parity with mekss-anpr prep_crnn)', () => {
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
    const bytes = Array.from(tensor, (v) => Math.round(v * 255));
    const { mean } = diff(bytes, c.prep);
    expect(mean).toBeLessThan(1);
    expect(Math.min(...tensor)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...tensor)).toBeLessThanOrEqual(1);
  });

  it('feeds the CRNN a single-channel 128x32 tensor from an RGB crop', async () => {
    const { w, h, data } = fixture.plate;
    const rgb = Buffer.alloc(w * h * 3);
    data.forEach((v, i) => rgb.fill(v, i * 3, i * 3 + 3));
    const tensor = await prepCrnn({ data: rgb, width: w, height: h });
    expect(tensor).toHaveLength(128 * 32);
    expect(diff(Array.from(tensor, (v) => Math.round(v * 255)), fixture.plate.prep).mean).toBeLessThan(1);
  });
});
