import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from 'crypto';

const key = (): Buffer => {
  const secret = process.env.SESSION_ENCRYPTION_KEY;
  if (!secret) throw new Error('SESSION_ENCRYPTION_KEY is not set');
  return createHash('sha256').update(secret).digest();
};

export const sha256 = (value: string): string =>
  createHash('sha256').update(value).digest('hex');

/** AES-256-GCM; output is iv.tag.ciphertext, base64url encoded. */
export function encrypt(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key(), iv);
  const data = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return [iv, cipher.getAuthTag(), data]
    .map((b) => b.toString('base64url'))
    .join('.');
}

export function decrypt(encoded: string): string {
  const [iv, tag, data] = encoded
    .split('.')
    .map((p) => Buffer.from(p, 'base64url'));
  const decipher = createDecipheriv('aes-256-gcm', key(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString(
    'utf8',
  );
}
