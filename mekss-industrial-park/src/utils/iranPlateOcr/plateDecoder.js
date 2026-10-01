/**
 * Grammar-constrained CTC prefix beam search for the on-device fallback.
 * Same algorithm and priors as mekss-backend/src/anpr/ctc-decoder.ts and mekss-anpr decoder.py,
 * so device reads rank candidates exactly like the server engines.
 */
import { IRAN_PLATE_LETTERS, isKnownIranPlateRegion } from '../iranLicensePlate';

const NEG_INF = -Infinity;
const PLATE_LETTER_SET = new Set(IRAN_PLATE_LETTERS.map((l) => l.value));
const LAYOUT = ['digit', 'digit', 'letter', 'digit', 'digit', 'digit', 'digit', 'digit'];

const logSumExp = (a, b) => {
  if (a === NEG_INF) return b;
  if (b === NEG_INF) return a;
  const m = Math.max(a, b);
  return m + Math.log(Math.exp(a - m) + Math.exp(b - m));
};
const round = (p) => Math.round(p * 10000) / 10000;

export const positionPrior = (pos, ch) => ((pos === 0 || pos === 3 || pos === 6) && ch === '0' ? 0.05 : 1);
export const regionPrior = (region) => (isKnownIranPlateRegion(region) ? 1 : 0.2);

/** Row-wise softmax of flat `T x C` logits. */
export function softmaxRows(logits, timeSteps, classes) {
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

export function greedyDecode(probs, timeSteps, labels) {
  const classes = labels.length + 1;
  const blank = labels.length;
  const chars = [];
  const confs = [];
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

/**
 * @param {Float64Array} probs softmax probabilities, `T x (labels.length + 1)`, blank last
 * @returns {{ plate: string, probability: number, charConfidences: number[], positions: {c:string,p:number}[][],
 *   alternatives: {plate:string,p:number}[], raw: string, rawConfidence: number, valid: boolean }}
 */
export function constrainedBeamSearch(probs, timeSteps, labels, { beamWidth = 12, nbest = 5, prune = 1e-4 } = {}) {
  const classes = labels.length + 1;
  const blank = labels.length;
  const digitIds = new Set();
  const letterIds = new Set();
  labels.forEach((ch, i) => {
    if (/^\d$/.test(ch)) digitIds.add(i);
    else if (PLATE_LETTER_SET.has(ch)) letterIds.add(i);
  });
  const allowed = LAYOUT.map((kind) => (kind === 'digit' ? digitIds : letterIds));
  const targetLen = LAYOUT.length;
  const { raw, confidence: rawConfidence } = greedyDecode(probs, timeSteps, labels);

  let beams = [{ prefix: [], pb: 0, pnb: NEG_INF }];
  for (let t = 0; t < timeSteps; t += 1) {
    const off = t * classes;
    const lp = (c) => Math.log(Math.max(probs[off + c], 1e-12));
    const candidates = [];
    for (let c = 0; c < blank; c += 1) if (probs[off + c] > prune) candidates.push(c);

    const next = new Map();
    const add = (prefix, pb, pnb) => {
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
  const positions = [];
  const charConfidences = [];
  for (let pos = 0; pos < targetLen; pos += 1) {
    const dist = new Map();
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
