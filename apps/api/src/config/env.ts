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
