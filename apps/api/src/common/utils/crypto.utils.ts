import { scryptSync, randomBytes, timingSafeEqual, createHash } from 'node:crypto';

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  // Support legacy SHA-256 hash from database seed
  if (storedHash.length === 64 && !storedHash.includes(':')) {
    const sha256 = createHash('sha256').update(password).digest('hex');
    try {
      return timingSafeEqual(Buffer.from(sha256), Buffer.from(storedHash));
    } catch {
      return sha256 === storedHash;
    }
  }

  const parts = storedHash.split(':');
  if (parts.length !== 2) return false;
  const [salt, hash] = parts;
  const verifyHash = scryptSync(password, salt, 64).toString('hex');
  
  try {
    return timingSafeEqual(Buffer.from(verifyHash), Buffer.from(hash));
  } catch {
    return verifyHash === hash;
  }
}
