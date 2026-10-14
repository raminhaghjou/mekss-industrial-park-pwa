import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, createHmac, randomBytes, randomInt, timingSafeEqual } from 'crypto';
import sharp = require('sharp');
import { EphemeralStore } from './ephemeral-store';

export const CAPTCHA_LENGTH = 5;
export const CAPTCHA_TTL_MS = 3 * 60_000;
/** 0, 1 and similar shapes are excluded so a distorted glyph stays unambiguous. */
const CAPTCHA_DIGITS = '23456789';
const WIDTH = 180;
const HEIGHT = 64;
const INVALID_MESSAGE = 'کد امنیتی نادرست یا منقضی شده است؛ کد جدید را وارد کنید.';

/** Single-stroke digit outlines on a 10×16 grid (y grows downward). */
const GLYPHS: Record<string, string> = {
  '2': 'M1 4 Q1 0 5 0 Q9 0 9 4 Q9 7 1 16 L9 16',
  '3': 'M1 1 L9 1 L4 7 Q9 7 9 11.5 Q9 16 5 16 Q1 16 1 13',
  '4': 'M7 16 L7 0 L0 11 L10 11',
  '5': 'M9 0 L2 0 L1 7 Q5 5 8 8 Q10 11 8 14 Q5 17 1 14',
  '6': 'M8 1 Q2 1 1 9 Q1 16 5 16 Q9 16 9 12 Q9 8 5 8 Q2 8 1 11',
  '7': 'M1 0 L9 0 L4 16',
  '8': 'M5 8 Q1 8 1 4 Q1 0 5 0 Q9 0 9 4 Q9 8 5 8 Q1 8 1 12 Q1 16 5 16 Q9 16 9 12 Q9 8 5 8',
  '9': 'M9 5 Q8 8 5 8 Q1 8 1 4 Q1 0 5 0 Q9 0 9 5 Q9 16 2 15',
};

const toAsciiDigits = (value: string) =>
  value
    .replace(/[۰-۹]/g, (digit) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(digit)))
    .replace(/[٠-٩]/g, (digit) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit)));

const between = (random: () => number, min: number, max: number) => min + random() * (max - min);
const round = (value: number) => Math.round(value * 10) / 10;

/**
 * Builds the challenge drawing. Glyphs are vector paths (never <text>), and the SVG is
 * rasterized before leaving the server, so the answer cannot be read from the markup.
 */
export function renderCaptchaSvg(answer: string, random: () => number = Math.random): string {
  const hue = Math.floor(between(random, 0, 360));
  const parts: string[] = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">`,
    `<rect width="${WIDTH}" height="${HEIGHT}" fill="hsl(${hue},45%,94%)"/>`,
  ];
  for (let i = 0; i < 4; i += 1) {
    parts.push(`<circle cx="${round(between(random, 0, WIDTH))}" cy="${round(between(random, 0, HEIGHT))}" r="${round(between(random, 10, 30))}" fill="hsl(${(hue + 40 * i) % 360},50%,86%)" opacity="0.7"/>`);
  }
  const slot = (WIDTH - 20) / answer.length;
  const strokes: string[] = [];
  answer.split('').forEach((digit, index) => {
    const scale = between(random, 2.2, 2.7);
    const x = 10 + index * slot + (slot - 10 * scale) / 2 + between(random, -3, 3);
    const y = (HEIGHT - 16 * scale) / 2 + between(random, -4, 4);
    const rotate = between(random, -22, 22);
    const skew = between(random, -12, 12);
    const width = between(random, 2.4, 3.3) / scale;
    const color = `hsl(${Math.floor(between(random, 0, 360))},65%,${Math.floor(between(random, 22, 34))}%)`;
    strokes.push(
      `<path d="${GLYPHS[digit]}" transform="translate(${round(x)} ${round(y)}) scale(${round(scale * 100) / 100}) rotate(${round(rotate)} 5 8) skewX(${round(skew)})" fill="none" stroke="${color}" stroke-width="${round(width * 100) / 100}" stroke-linecap="round" stroke-linejoin="round"/>`,
    );
  });
  // Interference curves drawn like the glyph strokes so they are hard to segment away.
  for (let i = 0; i < 3; i += 1) {
    const y0 = between(random, 8, HEIGHT - 8);
    strokes.push(
      `<path d="M${round(between(random, -10, 20))} ${round(y0)} C${round(between(random, 30, 80))} ${round(between(random, -10, HEIGHT + 10))} ${round(between(random, 100, 150))} ${round(between(random, -10, HEIGHT + 10))} ${round(between(random, 160, WIDTH + 10))} ${round(between(random, 8, HEIGHT - 8))}" fill="none" stroke="hsl(${Math.floor(between(random, 0, 360))},55%,${Math.floor(between(random, 25, 45))}%)" stroke-width="${round(between(random, 1.2, 2.2))}" stroke-linecap="round"/>`,
    );
  }
  for (let i = strokes.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [strokes[i], strokes[j]] = [strokes[j], strokes[i]];
  }
  parts.push(...strokes);
  for (let i = 0; i < 70; i += 1) {
    parts.push(`<circle cx="${round(between(random, 0, WIDTH))}" cy="${round(between(random, 0, HEIGHT))}" r="${round(between(random, 0.5, 1.5))}" fill="hsl(${Math.floor(between(random, 0, 360))},40%,${Math.floor(between(random, 30, 60))}%)"/>`);
  }
  parts.push('</svg>');
  return parts.join('');
}

/**
 * Stateless, one-time image captcha. The token carries a nonce, its expiry and an HMAC over
 * the answer, so nothing is stored until it is checked; checking claims the nonce, which
 * allows exactly one guess per challenge.
 */
@Injectable()
export class CaptchaService {
  private readonly key: Buffer;

  constructor(config: ConfigService, private readonly store: EphemeralStore) {
    const secret = config.get<string>('CAPTCHA_SECRET')
      || config.get<string>('JWT_ACCESS_SECRET')
      || config.get<string>('JWT_SECRET')
      || 'development-only-captcha-key';
    this.key = createHash('sha256').update(`mekss-captcha:${secret}`).digest();
  }

  async issue(): Promise<{ captchaId: string; image: string; expiresIn: number }> {
    let answer = '';
    for (let i = 0; i < CAPTCHA_LENGTH; i += 1) answer += CAPTCHA_DIGITS[randomInt(0, CAPTCHA_DIGITS.length)];
    const nonce = randomBytes(16).toString('base64url');
    const expiresAt = Date.now() + CAPTCHA_TTL_MS;
    const png = await sharp(Buffer.from(renderCaptchaSvg(answer))).png({ compressionLevel: 9 }).toBuffer();
    return {
      captchaId: `v1.${nonce}.${expiresAt}.${this.mac(nonce, expiresAt, answer)}`,
      image: `data:image/png;base64,${png.toString('base64')}`,
      expiresIn: Math.floor(CAPTCHA_TTL_MS / 1000),
    };
  }

  /** Throws 400 unless the answer matches an unexpired, never-checked challenge. */
  async verify(captchaId: string | undefined, answer: string | undefined): Promise<void> {
    const parts = String(captchaId || '').split('.');
    const normalized = toAsciiDigits(String(answer || '')).replace(/\s+/g, '');
    if (parts.length !== 4 || parts[0] !== 'v1' || !/^\d{1,8}$/.test(normalized)) throw new BadRequestException(INVALID_MESSAGE);
    const [, nonce, expiresRaw, mac] = parts;
    const expiresAt = Number(expiresRaw);
    if (!/^[A-Za-z0-9_-]{16,64}$/.test(nonce) || !Number.isFinite(expiresAt) || expiresAt < Date.now()) {
      throw new BadRequestException(INVALID_MESSAGE);
    }
    if (!(await this.store.claimOnce(`captcha:${nonce}`, Math.max(1_000, expiresAt - Date.now())))) {
      throw new BadRequestException(INVALID_MESSAGE);
    }
    const expected = Buffer.from(this.mac(nonce, expiresAt, normalized));
    const given = Buffer.from(mac);
    if (expected.length !== given.length || !timingSafeEqual(expected, given)) throw new BadRequestException(INVALID_MESSAGE);
  }

  private mac(nonce: string, expiresAt: number, answer: string): string {
    return createHmac('sha256', this.key).update(`${nonce}.${expiresAt}.${answer}`).digest('base64url');
  }
}
