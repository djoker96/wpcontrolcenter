import { createHmac, timingSafeEqual, randomBytes } from 'crypto';
import { UnauthorizedException } from '@nestjs/common';
import { getAgentEncryptionKey } from '../../config/env';

/**
 * Signed, self-contained OAuth `state` token.
 *
 * Format: `<base64url(payload)>.<base64url(signature)>`
 *   payload  = { nonce, exp }  (exp = unix seconds)
 *   signature = HMAC-SHA256(payloadB64, AGENT_ENCRYPTION_KEY)
 *
 * Self-contained design: no Redis/DB needed, no schema change. The same
 * AGENT_ENCRYPTION_KEY already used for at-rest token encryption doubles as
 * the signing key. A state token is valid for at most STATE_TTL_SECONDS.
 */
const STATE_TTL_SECONDS = 10 * 60; // 10 minutes

function base64url(input: Buffer | string): string {
  return Buffer.from(input).toString('base64url');
}

function sign(payloadB64: string): string {
  return createHmac('sha256', getAgentEncryptionKey()).update(payloadB64).digest('base64url');
}

/** Mint a fresh state token for the start of an OAuth flow. */
export function createStateToken(): string {
  const nonce = randomBytes(16).toString('hex');
  const exp = Math.floor(Date.now() / 1000) + STATE_TTL_SECONDS;
  const payloadB64 = base64url(JSON.stringify({ nonce, exp }));
  return `${payloadB64}.${sign(payloadB64)}`;
}

/**
 * Verify a state token returned from the OAuth provider. Throws
 * UnauthorizedException on any failure (bad format, tampered signature,
 * expired). Returns the decoded payload on success.
 */
export function verifyStateToken(state: string | undefined | null): { nonce: string; exp: number } {
  if (!state || typeof state !== 'string' || !state.includes('.')) {
    throw new UnauthorizedException('Invalid OAuth state: missing or malformed');
  }
  const [payloadB64, sig] = state.split('.');
  if (!payloadB64 || !sig) {
    throw new UnauthorizedException('Invalid OAuth state: missing component');
  }

  const expectedSig = sign(payloadB64);
  const a = Buffer.from(sig);
  const b = Buffer.from(expectedSig);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    throw new UnauthorizedException('Invalid OAuth state: signature mismatch');
  }

  let payload: { nonce: string; exp: number };
  try {
    payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'));
  } catch {
    throw new UnauthorizedException('Invalid OAuth state: corrupt payload');
  }

  if (typeof payload.exp !== 'number' || payload.exp < Math.floor(Date.now() / 1000)) {
    throw new UnauthorizedException('Invalid OAuth state: expired');
  }
  return payload;
}
