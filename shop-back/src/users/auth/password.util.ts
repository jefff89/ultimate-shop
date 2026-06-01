import { randomBytes, scrypt as _scrypt, timingSafeEqual } from 'crypto';
import { promisify } from 'util';

const scrypt = promisify(_scrypt) as (
  password: string,
  salt: string,
  keylen: number,
) => Promise<Buffer>;

const KEY_LEN = 32;
const SALT_BYTES = 16;

// Produces a "<salt>.<hash>" string. scrypt is an acceptable KDF; the salt is
// stored alongside the hash so existing records keep verifying.
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_BYTES).toString('hex');
  const hash = await scrypt(password, salt, KEY_LEN);
  return `${salt}.${hash.toString('hex')}`;
}

// Constant-time comparison to avoid leaking the hash via response timing.
export async function verifyPassword(
  password: string,
  stored: string,
): Promise<boolean> {
  const [salt, storedHash] = stored.split('.');
  if (!salt || !storedHash) {
    return false;
  }
  const hash = await scrypt(password, salt, KEY_LEN);
  const storedBuf = Buffer.from(storedHash, 'hex');
  // timingSafeEqual throws on length mismatch, so guard first.
  if (storedBuf.length !== hash.length) {
    return false;
  }
  return timingSafeEqual(storedBuf, hash);
}
