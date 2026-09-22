#!/usr/bin/env node
/**
 * Download Platrix Iranian plate ONNX models into public/models/iran-plate/
 * Source (MIT): https://huggingface.co/Dibachain/Platrix
 */
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.resolve(root, '../public/models/iran-plate');
const base = 'https://huggingface.co/Dibachain/Platrix/resolve/main';
const files = [
  'ocr_crnn.labels.json',
  'ocr_crnn.onnx',
  'plate_yolo.onnx',
];

await mkdir(outDir, { recursive: true });
for (const name of files) {
  const url = `${base}/${name}`;
  process.stdout.write(`Downloading ${name}… `);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed ${url}: ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  await writeFile(path.join(outDir, name), buf);
  console.log(`${(buf.length / 1024 / 1024).toFixed(1)} MB`);
}
console.log('Done →', outDir);
