#!/usr/bin/env node
/**
 * Download the Platrix Iranian plate ONNX models (MIT) into public/models/iran-plate/ for the
 * on-device OCR fallback. Uses the same manifest as mekss-anpr so the browser, the Node engine and
 * the Python service run byte-identical models.
 *
 *   IRAN_PLATE_MODEL_BASE_URL / ANPR_MODEL_BASE_URL  mirror to download from (default: manifest source)
 *   --base-url <url>   same, on the command line
 *   --force            re-download even if a verified file exists
 *   --pin              record the SHA-256 of the downloaded files into the manifest
 */
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.resolve(root, '../public/models/iran-plate');
const manifestPath = path.resolve(root, '../../mekss-anpr/models/manifest.json');

const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const option = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};

const manifest = existsSync(manifestPath)
  ? JSON.parse(await readFile(manifestPath, 'utf8'))
  : {
    source: 'https://huggingface.co/Dibachain/Platrix/resolve/main',
    files: {
      'ocr_crnn.labels.json': { required: true, sha256: null },
      'ocr_crnn.onnx': { required: true, sha256: null },
      'plate_yolo.onnx': { required: true, sha256: null },
    },
  };
const base = (option('--base-url') || process.env.IRAN_PLATE_MODEL_BASE_URL || process.env.ANPR_MODEL_BASE_URL || manifest.source).replace(/\/+$/, '');
// The browser fallback only needs the primary detector and the recogniser.
const wanted = ['ocr_crnn.labels.json', 'ocr_crnn.onnx', 'plate_yolo.onnx'];

const sha256 = (buf) => createHash('sha256').update(buf).digest('hex');

async function download(url, attempts = 3) {
  let lastError;
  for (let i = 1; i <= attempts; i += 1) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(120_000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return Buffer.from(await res.arrayBuffer());
    } catch (error) {
      lastError = error;
      if (i < attempts) await new Promise((r) => setTimeout(r, 1500 * i));
    }
  }
  throw new Error(`Failed ${url}: ${lastError?.message || lastError}`);
}

await mkdir(outDir, { recursive: true });
let pinned = false;
for (const name of wanted) {
  const entry = manifest.files?.[name] || { required: true, sha256: null };
  const target = path.join(outDir, name);
  if (!flag('--force') && existsSync(target)) {
    const current = await readFile(target);
    if (!entry.sha256 || sha256(current) === entry.sha256) {
      console.log(`✓ ${name} (cached${entry.sha256 ? ', verified' : ''})`);
      continue;
    }
    console.log(`! ${name} checksum mismatch — re-downloading`);
  }
  process.stdout.write(`Downloading ${name} from ${base} … `);
  const buf = await download(`${base}/${name}`);
  const digest = sha256(buf);
  if (entry.sha256 && entry.sha256 !== digest) {
    throw new Error(`${name}: SHA-256 mismatch (expected ${entry.sha256}, got ${digest}). Refusing to install.`);
  }
  if (!entry.sha256) {
    if (flag('--pin')) {
      manifest.files[name] = { ...entry, sha256: digest };
      pinned = true;
    } else {
      console.warn(`\n  warning: ${name} has no pinned checksum (run with --pin to record ${digest.slice(0, 12)}…)`);
    }
  }
  await writeFile(`${target}.part`, buf);
  await rename(`${target}.part`, target);
  console.log(`${(buf.length / 1024 / 1024).toFixed(1)} MB`);
}
if (pinned && existsSync(manifestPath)) {
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log('Pinned checksums written to', manifestPath);
}
console.log('Done →', outDir);
