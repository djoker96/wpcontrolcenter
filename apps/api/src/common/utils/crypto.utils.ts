import { scryptSync, randomBytes, timingSafeEqual, createHash, createHmac } from 'node:crypto';

export { decrypt, encrypt } from '@wpcc/shared';

/**
 * Deterministic keyed hash of a connection token, used as an indexed lookup
 * column so registration can find the matching credential in O(1) instead of
 * decrypting every row and comparing (a token-guessing oracle + CPU DoS).
 */
export function hashConnectionToken(token: string, key: string): string {
  return createHmac('sha256', key).update(token).digest('hex');
}

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

/** True if the stored hash is the weak legacy unsalted SHA-256 scheme. */
export function isLegacyPasswordHash(storedHash: string): boolean {
  return storedHash.length === 64 && !storedHash.includes(':');
}

/** Constant-time hex-string compare; false on any length/format mismatch. */
function safeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

export function verifyPassword(password: string, storedHash: string): boolean {
  // Legacy SHA-256 hash from old seed — verified only so we can migrate it on login.
  if (isLegacyPasswordHash(storedHash)) {
    const sha256 = createHash('sha256').update(password).digest('hex');
    return safeEqualHex(sha256, storedHash);
  }

  const parts = storedHash.split(':');
  if (parts.length !== 2) return false;
  const [salt, hash] = parts;
  const verifyHash = scryptSync(password, salt, 64).toString('hex');
  return safeEqualHex(verifyHash, hash);
}
