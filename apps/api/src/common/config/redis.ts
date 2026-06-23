/**
 * Shared BullMQ/ioredis connection options.
 *
 * Centralizes Redis connection config so the API Queue and the worker
 * connect with the same credentials (including REDIS_PASSWORD when set).
 * BullMQ/ioredis ignores `undefined` fields, so dev environments without
 * a Redis password keep working unchanged.
 */
export function redisConnection(): {
  host: string;
  port: number;
  password?: string;
  username?: string;
} {
  return {
    host: process.env.REDIS_HOST || 'localhost',
    port: process.env.REDIS_PORT ? Number(process.env.REDIS_PORT) : 6379,
    password: process.env.REDIS_PASSWORD || undefined,
    username: process.env.REDIS_USERNAME || undefined,
  };
}
