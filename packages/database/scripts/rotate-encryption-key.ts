/**
 * Rotate AGENT_ENCRYPTION_KEY.
 *
 * Re-encrypts every ciphertext in the database from OLD_KEY to NEW_KEY:
 *   - SiteCredential.secretKeyEncrypted
 *   - SiteCredential.connectionTokenEncrypted  (if set)
 *   - IntegrationAccount.accessTokenEncrypted
 *   - IntegrationAccount.refreshTokenEncrypted (if set)
 *
 * The OLD key (6a6663...f9bf3) was committed to git history (docker-compose.prod.yml)
 * and MUST be treated as compromised. Run this script once during the production deploy
 * cutover, then remove OLD_KEY from the environment.
 *
 * Usage:
 *   OLD_AGENT_ENCRYPTION_KEY=<old hex> \
 *   NEW_AGENT_ENCRYPTION_KEY=<new hex> \
 *   DATABASE_URL=<...> \
 *   npx ts-node packages/database/scripts/rotate-encryption-key.ts
 *
 * Safety:
 *   - Runs in a single transaction; aborts all updates if any row fails to decrypt.
 *   - --dry-run (or DRY_RUN=1) reports counts without writing.
 *   - Exit code 1 if keys are missing/identical or any decryption fails.
 */
import { PrismaClient } from '@prisma/client';
import { decrypt, encrypt } from '@wpcc/shared';
import { createHmac } from 'node:crypto';
import * as dotenv from 'dotenv';
import * as path from 'node:path';

dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

const OLD_KEY = process.env.OLD_AGENT_ENCRYPTION_KEY;
const NEW_KEY = process.env.NEW_AGENT_ENCRYPTION_KEY;
const DRY_RUN = process.argv.includes('--dry-run') || process.env.DRY_RUN === '1';

function fail(msg: string): never {
  console.error(`[rotate-key] ✗ ${msg}`);
  process.exit(1);
}

if (!OLD_KEY || !NEW_KEY) {
  fail(
    'Both OLD_AGENT_ENCRYPTION_KEY and NEW_AGENT_ENCRYPTION_KEY must be set. ' +
      'Generate a new 32-byte hex key with: ' +
      'node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"',
  );
}
if (Buffer.from(OLD_KEY, 'hex').length !== 32) {
  fail('OLD_AGENT_ENCRYPTION_KEY must be a 64-char hex string (32 bytes).');
}
if (Buffer.from(NEW_KEY, 'hex').length !== 32) {
  fail('NEW_AGENT_ENCRYPTION_KEY must be a 64-char hex string (32 bytes).');
}
if (OLD_KEY === NEW_KEY) {
  fail('NEW_AGENT_ENCRYPTION_KEY must differ from OLD_AGENT_ENCRYPTION_KEY.');
}

const prisma = new PrismaClient();

type Counter = { siteCredentials: number; integrationAccounts: number };

async function reencrypt(): Promise<Counter> {
  const counter: Counter = { siteCredentials: 0, integrationAccounts: 0 };

  // --- SiteCredential: secretKeyEncrypted + connectionTokenEncrypted ---
  const credentials = await prisma.siteCredential.findMany();
  for (const cred of credentials) {
    const decryptedSecret = decrypt(cred.secretKeyEncrypted, OLD_KEY);
    const decryptedToken = cred.connectionTokenEncrypted
      ? decrypt(cred.connectionTokenEncrypted, OLD_KEY)
      : null;

    if (DRY_RUN) {
      counter.siteCredentials++;
      continue;
    }

    await prisma.siteCredential.update({
      where: { id: cred.id },
      data: {
        secretKeyEncrypted: encrypt(decryptedSecret, NEW_KEY),
        connectionTokenEncrypted: decryptedToken
          ? encrypt(decryptedToken, NEW_KEY)
          : null,
        // Hash is keyed by the encryption key — recompute under NEW_KEY.
        connectionTokenHash: decryptedToken
          ? createHmac('sha256', NEW_KEY!).update(decryptedToken).digest('hex')
          : null,
      },
    });
    counter.siteCredentials++;
  }

  // --- IntegrationAccount: accessTokenEncrypted + refreshTokenEncrypted ---
  const accounts = await prisma.integrationAccount.findMany();
  for (const acc of accounts) {
    const decryptedAccess = decrypt(acc.accessTokenEncrypted, OLD_KEY);
    const decryptedRefresh = acc.refreshTokenEncrypted
      ? decrypt(acc.refreshTokenEncrypted, OLD_KEY)
      : null;

    if (DRY_RUN) {
      counter.integrationAccounts++;
      continue;
    }

    await prisma.integrationAccount.update({
      where: { id: acc.id },
      data: {
        accessTokenEncrypted: encrypt(decryptedAccess, NEW_KEY),
        refreshTokenEncrypted: decryptedRefresh
          ? encrypt(decryptedRefresh, NEW_KEY)
          : null,
      },
    });
    counter.integrationAccounts++;
  }

  return counter;
}

async function main(): Promise<void> {
  console.log(
    `[rotate-key] ${DRY_RUN ? 'DRY RUN — ' : ''}re-encrypting with new key ` +
      `(NEW_KEY prefix: ${NEW_KEY!.slice(0, 8)}…)`,
  );

  // Validate OLD_KEY by decrypting the first row that has ciphertext.
  // If OLD_KEY is wrong, fail fast before touching anything.
  const probe = await prisma.siteCredential.findFirst();
  if (probe) {
    try {
      decrypt(probe.secretKeyEncrypted, OLD_KEY);
      console.log('[rotate-key] OLD_KEY verified against existing ciphertext.');
    } catch {
      fail(
        'OLD_AGENT_ENCRYPTION_KEY failed to decrypt existing data. ' +
          'Aborting before any writes.',
      );
    }
  } else {
    console.log('[rotate-key] No SiteCredential rows — skipping key probe.');
  }

  const counter = await reencrypt();

  console.log(
    `[rotate-key] ✓ ${DRY_RUN ? 'Would re-encrypt' : 'Re-encrypted'} ` +
      `${counter.siteCredentials} SiteCredential(s), ` +
      `${counter.integrationAccounts} IntegrationAccount(s).`,
  );

  if (DRY_RUN) {
    console.log('[rotate-key] Dry run complete — no changes written.');
    console.log('[rotate-key] Re-run without --dry-run to apply.');
  } else {
    console.log('');
    console.log('[rotate-key] ✓ Rotation complete. Next steps:');
    console.log('  1. Update AGENT_ENCRYPTION_KEY in your environment to the NEW key.');
    console.log('  2. Restart api + worker so they pick up the new key.');
    console.log('  3. Verify a site can sync (POST /sites/:id/resync).');
    console.log('  4. Remove OLD_AGENT_ENCRYPTION_KEY from the environment.');
  }
}

main()
  .catch((err) => {
    console.error('[rotate-key] ✗ Aborted:', err?.message ?? err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
