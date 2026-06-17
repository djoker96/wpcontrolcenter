import { scryptSync, randomBytes, timingSafeEqual, createHash, createCipheriv, createDecipheriv } from 'node:crypto';

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

const ALGORITHM = 'aes-256-gcm';

export function encrypt(text: string, secretKeyHex: string): string {
  const key = Buffer.from(secretKeyHex, 'hex');
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  const authTag = cipher.getAuthTag().toString('hex');
  
  return `${iv.toString('hex')}:${encrypted}:${authTag}`;
}

export function decrypt(encryptedText: string, secretKeyHex: string): string {
  const key = Buffer.from(secretKeyHex, 'hex');
  const parts = encryptedText.split(':');
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted text format');
  }
  
  const iv = Buffer.from(parts[0], 'hex');
  const encrypted = parts[1];
  const authTag = Buffer.from(parts[2], 'hex');
  
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
}
