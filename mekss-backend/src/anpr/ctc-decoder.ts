/**
 * Grammar-constrained CTC prefix beam search (TypeScript port of mekss-anpr decoder.py),
 * used by the in-process Node engine so both engines emit identical result shapes.
 */
import { PositionChoice } from './anpr.types';
import { PLATE_LETTER_TYPES, STANDARD_LAYOUT, positionPrior, regionPrior } from './plate-grammar';

export interface DecodeResult {
  plate: string;
  probability: number;
  charConfidences: number[];
  positions: PositionChoice[][];
  alternatives: { plate: string; p: number }[];
  raw: string;
  rawConfidence: number;
  valid: boolean;
}

const NEG_INF = -Infinity;

function logSumExp(a: number, b: number): number {
  if (a === NEG_INF) return b;
  if (b === NEG_INF) return a;
  const m = Math.max(a, b);
  return m + Math.log(Math.exp(a - m) + Math.exp(b - m));
}

/** Row-wise softmax of a flat `T x C` logits array. */
export function softmaxRows(logits: ArrayLike<number>, timeSteps: number, classes: number): Float64Array {
  const out = new Float64Array(timeSteps * classes);
  for (let t = 0; t < timeSteps; t += 1) {
    const off = t * classes;
    let max = -Infinity;
    for (let c = 0; c < classes; c += 1) max = Math.max(max, logits[off + c]);
    let sum = 0;
    for (let c = 0; c < classes; c += 1) {
      const e = Math.exp(logits[off + c] - max);
      out[off + c] = e;
      sum += e;
    }
    for (let c = 0; c < classes; c += 1) out[off + c] /= sum;
  }
  return out;
}

export function greedyDecode(probs: Float64Array, timeSteps: number, labels: string[]): { raw: string; confidence: number } {
  const classes = labels.length + 1;
  const blank = labels.length;
  const chars: string[] = [];
  const confs: number[] = [];
  let prev = -1;
  for (let t = 0; t < timeSteps; t += 1) {
    let best = 0;
    let bestP = -1;
    for (let c = 0; c < classes; c += 1) {
      const p = probs[t * classes + c];
      if (p > bestP) {
        bestP = p;
        best = c;
      }
    }
    if (best !== blank && best !== prev) {
      chars.push(labels[best] ?? '');
      confs.push(bestP);
    }
    prev = best;
  }
  return { raw: chars.join(''), confidence: confs.length ? confs.reduce((a, b) => a + b, 0) / confs.length : 0 };
}

export function constrainedBeamSearch(
  probs: Float64Array,
  timeSteps: number,
  labels: string[],
  { beamWidth = 16, nbest = 5, prune = 1e-4 } = {},
): DecodeResult {
  const classes = labels.length + 1;
  const blank = labels.length;
  const digitIds = new Set<number>();
  const letterIds = new Set<number>();
  labels.forEach((ch, i) => {
    if (/^\d$/.test(ch)) digitIds.add(i);
    else if (PLATE_LETTER_TYPES[ch]) letterIds.add(i);
  });
  const allowed = STANDARD_LAYOUT.map((kind) => (kind === 'digit' ? digitIds : letterIds));
  const targetLen = STANDARD_LAYOUT.length;
  const { raw, confidence: rawConfidence } = greedyDecode(probs, timeSteps, labels);

  type Beam = { prefix: number[]; pb: number; pnb: number };
  let beams: Beam[] = [{ prefix: [], pb: 0, pnb: NEG_INF }];

  for (let t = 0; t < timeSteps; t += 1) {
    const off = t * classes;
    const lp = (c: number) => Math.log(Math.max(probs[off + c], 1e-12));
    const candidates: number[] = [];
    for (let c = 0; c < blank; c += 1) if (probs[off + c] > prune) candidates.push(c);

    const next = new Map<string, Beam>();
    const add = (prefix: number[], pb: number, pnb: number) => {
      const key = prefix.join(',');
      const cur = next.get(key);
      if (!cur) next.set(key, { prefix, pb, pnb });
      else {
        cur.pb = logSumExp(cur.pb, pb);
        cur.pnb = logSumExp(cur.pnb, pnb);
      }
    };

    for (const { prefix, pb, pnb } of beams) {
      const total = logSumExp(pb, pnb);
      add(prefix, total + lp(blank), NEG_INF);
      if (prefix.length) add(prefix, NEG_INF, pnb + lp(prefix[prefix.length - 1]));
      const pos = prefix.length;
      if (pos >= targetLen) continue;
      for (const c of candidates) {
        if (!allowed[pos].has(c)) continue;
        const extended = [...prefix, c];
        if (pos && c === prefix[pos - 1]) add(extended, NEG_INF, pb + lp(c));
        else add(extended, NEG_INF, total + lp(c));
      }
    }

    beams = [...next.values()]
      .sort((a, b) => logSumExp(b.pb, b.pnb) - logSumExp(a.pb, a.pnb))
      .slice(0, beamWidth);
  }

  let finals = beams
    .filter((b) => b.prefix.length === targetLen)
    .map((b) => {
      const text = b.prefix.map((i) => labels[i]).join('');
      let prior = 1;
      [...text].forEach((ch, pos) => {
        prior *= positionPrior(pos, ch);
      });
      prior *= regionPrior(text.slice(6, 8));
      return { text, score: logSumExp(b.pb, b.pnb) + Math.log(prior) };
    })
    .sort((a, b) => b.score - a.score);

  if (!finals.length) {
    return { plate: '', probability: 0, charConfidences: [], positions: [], alternatives: [], raw, rawConfidence, valid: false };
  }

  finals = finals.slice(0, Math.max(nbest, 1) * 2);
  const abs = finals.map((f) => Math.exp(f.score));
  const mass = abs.reduce((a, b) => a + b, 0) || 1;
  const weights = abs.map((p) => p / mass);
  const best = finals[0].text;
  const bestChars = [...best];

  const positions: PositionChoice[][] = [];
  const charConfidences: number[] = [];
  for (let pos = 0; pos < targetLen; pos += 1) {
    const dist = new Map<string, number>();
    finals.forEach((f, i) => {
      const ch = [...f.text][pos];
      dist.set(ch, (dist.get(ch) ?? 0) + weights[i]);
    });
    positions.push([...dist.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([c, p]) => ({ c, p: round(p) })));
    charConfidences.push(dist.get(bestChars[pos]) ?? 0);
  }

  return {
    plate: best,
    probability: Math.min(1, abs[0]),
    charConfidences,
    positions,
    alternatives: finals.slice(0, nbest).map((f, i) => ({ plate: f.text, p: round(weights[i]) })),
    raw,
    rawConfidence,
    valid: true,
  };
}

/** Label-level ensemble across test-time-augmentation variants (see decoder.py merge_decodes). */
export function mergeDecodes(results: DecodeResult[]): DecodeResult | null {
  const valid = results.filter((r) => r.valid && r.alternatives.length);
  if (!valid.length) return results[0] ?? null;
  if (valid.length === 1) return valid[0];

  const pooled = new Map<string, number>();
  for (const r of valid) {
    for (const alt of r.alternatives) {
      pooled.set(alt.plate, (pooled.get(alt.plate) ?? 0) + alt.p * Math.max(r.probability, 1e-6));
    }
  }
  const total = [...pooled.values()].reduce((a, b) => a + b, 0) || 1;
  const ranked = [...pooled.entries()].map(([k, v]) => [k, v / total] as const).sort((a, b) => b[1] - a[1]);
  const best = ranked[0][0];
  const bestChars = [...best];

  const positions: PositionChoice[][] = [];
  const charConfidences: number[] = [];
  for (let pos = 0; pos < bestChars.length; pos += 1) {
    const dist = new Map<string, number>();
    for (const [plate, w] of ranked) {
      const chars = [...plate];
      if (chars.length === bestChars.length) dist.set(chars[pos], (dist.get(chars[pos]) ?? 0) + w);
    }
    positions.push([...dist.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([c, p]) => ({ c, p: round(p) })));
    charConfidences.push(dist.get(bestChars[pos]) ?? 0);
  }

  const supporting = valid.filter((r) => r.plate === best).map((r) => r.probability);
  const probability = supporting.length
    ? (supporting.reduce((a, b) => a + b, 0) / supporting.length) * (supporting.length / valid.length)
    : ranked[0][1];
  const anchor = valid.reduce((a, b) => (b.probability > a.probability ? b : a));
  return {
    plate: best,
    probability,
    charConfidences,
    positions,
    alternatives: ranked.slice(0, 5).map(([plate, p]) => ({ plate, p: round(p) })),
    raw: anchor.raw,
    rawConfidence: anchor.rawConfidence,
    valid: true,
  };
}

function round(p: number): number {
  return Math.round(p * 10_000) / 10_000;
}
