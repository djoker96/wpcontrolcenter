import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const packageRoot = resolve(__dirname, '..');
const schema = readFileSync(resolve(packageRoot, 'prisma/schema.prisma'), 'utf8');
const migration = readFileSync(
  resolve(packageRoot, 'prisma/migrations/20260624_add_user_authentication/migration.sql'),
  'utf8',
);

test('auth schema supports verified local and Google identities', () => {
  assert.match(schema, /enum AuthProvider\s*{\s*GOOGLE\s*}/);
  assert.match(schema, /passwordHash\s+String\?/);
  assert.match(schema, /emailVerifiedAt\s+DateTime\?/);
  assert.match(schema, /model AuthIdentity/);
  assert.match(schema, /@@unique\(\[provider, providerAccountId\]\)/);
  assert.match(schema, /@@unique\(\[userId, provider\]\)/);
  assert.match(schema, /model EmailVerificationCode/);
  assert.match(schema, /attemptCount\s+Int\s+@default\(0\)/);
});

test('migration backfills existing users before auth enforcement', () => {
  const alterPosition = migration.indexOf('ADD COLUMN "email_verified_at"');
  const backfillPosition = migration.indexOf('UPDATE "users"');
  assert.ok(alterPosition >= 0);
  assert.ok(backfillPosition > alterPosition);
  assert.match(migration, /ALTER COLUMN "password_hash" DROP NOT NULL/);
  assert.match(migration, /SET "email_verified_at" = CURRENT_TIMESTAMP/);
});
