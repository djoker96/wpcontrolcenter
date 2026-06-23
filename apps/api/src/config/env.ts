export function getRequiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} environment variable is missing`);
  }
  return value;
}

export function getAgentEncryptionKey(): string {
  return getRequiredEnv('AGENT_ENCRYPTION_KEY');
}

export function getJwtSecret(): string {
  return getRequiredEnv('JWT_SECRET');
}

/**
 * Validate ALL required environment variables at application startup.
 * Call this once in main.ts bootstrap() to fail fast instead of crashing
 * on the first DB query / encryption call at runtime.
 */
export function validateEnvironment(): void {
  const required = [
    'DATABASE_URL',
    'JWT_SECRET',
    'AGENT_ENCRYPTION_KEY',
  ];

  const missing: string[] = [];
  for (const name of required) {
    if (!process.env[name]) {
      missing.push(name);
    }
  }

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(', ')}. ` +
      `Set these before starting the application.`,
    );
  }

  // Validate DATABASE_URL format (basic check)
  const dbUrl = process.env.DATABASE_URL as string;
  if (!dbUrl.startsWith('postgresql://') && !dbUrl.startsWith('postgres://')) {
    throw new Error(
      `DATABASE_URL must be a PostgreSQL connection string ` +
      `(starting with postgresql:// or postgres://)`,
    );
  }

  // Validate AGENT_ENCRYPTION_KEY length — AES-256 requires a 32-byte key (64 hex chars)
  const encKey = process.env.AGENT_ENCRYPTION_KEY as string;
  if (encKey.length < 32) {
    throw new Error(
      `AGENT_ENCRYPTION_KEY must be at least 32 characters (got ${encKey.length}). ` +
      `Generate one with: openssl rand -hex 32`,
    );
  }

  // Warn (not fail) if production is missing security-sensitive config
  if (process.env.NODE_ENV === 'production') {
    if (!process.env.CORS_ORIGIN) {
      console.warn(
        '[security] CORS_ORIGIN is not set in production; cross-origin requests will be rejected.',
      );
    }
    if (process.env.JWT_SECRET && (process.env.JWT_SECRET as string).length < 32) {
      console.warn(
        '[security] JWT_SECRET is shorter than 32 characters in production.',
      );
    }
    if (!process.env.REDIS_PASSWORD) {
      console.warn(
        '[security] REDIS_PASSWORD is not set in production; the BullMQ queue connects to Redis without authentication.',
      );
    }
  }
}

/**
 * Parse CORS_ALLOWED_ORIGINS into a list. Accepts comma-separated origins
 * (e.g. "https://app.example.com,https://admin.example.com").
 *
 * Returns false to block cross-origin requests entirely when not configured
 * in production. In development, defaults to common localhost ports so that
 * the Next.js dev server (port 5001) and webpack proxy (port 3000) can reach
 * the API without manual CORS_ORIGIN setup.
 */
export function getCorsOrigins(): string[] | false {
  const raw = process.env.CORS_ORIGIN;
  if (!raw) {
    // In production, no CORS_ORIGIN means block cross-origin requests.
    if (process.env.NODE_ENV === 'production') {
      return false;
    }
    // In development, allow common local dev servers.
    return [
      'http://localhost:5001',
      'http://localhost:3000',
      'http://127.0.0.1:5001',
      'http://127.0.0.1:3000',
    ];
  }
  return raw
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
}
