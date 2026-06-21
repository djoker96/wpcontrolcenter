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
}
