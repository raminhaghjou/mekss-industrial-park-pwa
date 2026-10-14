import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';

const VERSION = 'v1';

/**
 * AES-256-GCM for secrets kept in the database (e.g. SMS gateway API keys), so a database dump or
 * backup alone does not reveal them. The key comes from SETTINGS_ENCRYPTION_KEY, falling back to the
 * JWT secret; changing it makes stored secrets unreadable and they must be entered again.
 */
export class SecretBox {
  private readonly key: Buffer;

  constructor(secret: string) {
    if (!secret || secret.length < 16) throw new Error('Settings encryption key must be at least 16 characters');
    this.key = createHash('sha256').update(`mekss-settings:${secret}`).digest();
  }

  encrypt(plain: string): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.key, iv);
    const data = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
    return [VERSION, iv.toString('base64'), cipher.getAuthTag().toString('base64'), data.toString('base64')].join(':');
  }

  /** Null when the value was sealed with another key or was tampered with. */
  decrypt(sealed: string): string | null {
    const [version, iv, tag, data] = String(sealed || '').split(':');
    if (version !== VERSION || !iv || !tag || data === undefined) return null;
    try {
      const decipher = createDecipheriv('aes-256-gcm', this.key, Buffer.from(iv, 'base64'));
      decipher.setAuthTag(Buffer.from(tag, 'base64'));
      return Buffer.concat([decipher.update(Buffer.from(data, 'base64')), decipher.final()]).toString('utf8');
    } catch {
      return null;
    }
  }
}
