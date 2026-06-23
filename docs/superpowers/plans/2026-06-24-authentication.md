# Authentication UI and Account Creation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver one WP Control Center authentication experience for email/password login, ADMIN self-registration with email OTP verification, Google sign-in with safe account linking, and SMTP-backed password recovery.

**Architecture:** Extend the existing NestJS `AuthModule`, Prisma `User`, and httpOnly JWT cookie instead of replacing the auth stack. Isolate SMTP delivery in `MailModule` and Google OpenID Connect in `GoogleAuthService`; keep Next.js `app/page.tsx` as a Server Component that renders a focused client-side `AuthCard` and form components.

**Tech Stack:** Next.js 16.2.6, React 19.2.4, Tailwind CSS 4, NestJS 10, Prisma 5/PostgreSQL, Nodemailer SMTP, `google-auth-library`, Node test runner, Playwright.

## Global Constraints

- Source of truth: `docs/superpowers/specs/2026-06-24-authentication-design.md`.
- Every self-registered email or Google account receives `UserRole.ADMIN`; retain the existing `VIEWER` role everywhere else.
- Email OTP is exactly six digits, expires after ten minutes, allows five failed attempts, and has a 60-second resend cooldown.
- Browser JWT stays only in the existing `wpcc_token` httpOnly cookie; never add localStorage/sessionStorage token handling.
- Google sign-in accepts only `email_verified=true`, links an existing normalized email, and stores no Google access or refresh token.
- SMTP uses Nodemailer and sends both plain-text and HTML bodies; tests must use a fake transporter.
- Existing users are backfilled as email-verified so the current seeded administrator remains login-capable.
- User-facing auth copy remains English and follows the existing zinc/violet/emerald design system.
- Read `node_modules/next/dist/docs/01-app/02-guides/authentication.md`, `01-app/01-getting-started/05-server-and-client-components.md`, and `01-app/02-guides/redirecting.md` before changing web code.
- Preserve the user's unrelated working-tree modification in `apps/api/tsconfig.json`; never stage it in feature commits unless the user explicitly brings it into scope.
- Approved TDD exception: Prisma schema, SQL migration, dependency installation, and environment/Compose configuration may use contract validation instead of a behavioral RED test; all application behavior remains strict RED-GREEN-REFACTOR.
- Do not add methods used only by tests to production classes; Google tests capture the real `state` and `nonce` through the injected adapter.

## File Structure

### Database

- Modify `packages/database/prisma/schema.prisma`: nullable local password, email verification timestamp, Google identity, and OTP models.
- Create `packages/database/prisma/migrations/20260624_add_user_authentication/migration.sql`: safe existing-user backfill and new constraints.
- Modify `packages/database/prisma/seed.ts`: mark seeded administrator verified.
- Create `packages/database/test/auth-schema.test.ts`: structural regression test for schema/migration invariants.

### API

- Modify `apps/api/package.json`: Nodemailer, Google auth library, and Nodemailer types.
- Modify `apps/api/src/config/env.ts`: typed SMTP, Google, and web URL configuration.
- Create `apps/api/src/modules/mail/mail.module.ts` and `mail.service.ts`: SMTP transport and two transactional templates.
- Create `apps/api/src/modules/auth/auth.errors.ts`: stable auth error codes.
- Create `apps/api/src/modules/auth/email-verification.service.ts`: OTP issuance, verification, and cooldown.
- Create `apps/api/src/modules/auth/google-auth.service.ts`: state/nonce, Google token verification, and account linking.
- Create `apps/api/src/modules/auth/auth-cookie.util.ts`: shared cookie parsing and options.
- Create `apps/api/src/modules/auth/dto/register.dto.ts`, `verify-email.dto.ts`, and `resend-verification.dto.ts`.
- Modify `apps/api/src/modules/auth/auth.service.ts`, `auth.controller.ts`, and `auth.module.ts`.
- Modify `apps/api/src/common/filters/all-exceptions.filter.ts`: preserve stable API error codes and retry metadata.
- Create `apps/api/test/mail.service.test.ts`, `email-verification.service.test.ts`, `google-auth.service.test.ts`, and `auth.controller.test.ts`.
- Modify `apps/api/test/auth.service.test.ts`.

### Web

- Modify `apps/web/app/page.tsx`: render the auth shell only.
- Create `apps/web/lib/auth-api.ts`: typed API methods and error parsing.
- Create `apps/web/components/auth/AuthCard.tsx`, `AuthMessage.tsx`, `GoogleAuthButton.tsx`, `LoginForm.tsx`, `SignUpForm.tsx`, `VerifyEmailForm.tsx`, `ForgotPasswordForm.tsx`, and `ResetPasswordForm.tsx`.
- Replace `apps/web/e2e/login.spec.ts` and create `apps/web/e2e/auth-ui.spec.ts`.

### Deployment and documentation

- Modify `.env.ci.example`, `.env.compose`, and `docker-compose.prod.yml` with SMTP, Google auth, and web URL settings.

---

### Task 1: Persist verified email identities safely

**Files:**
- Modify: `packages/database/prisma/schema.prisma`
- Create: `packages/database/prisma/migrations/20260624_add_user_authentication/migration.sql`
- Modify: `packages/database/prisma/seed.ts`
- Modify: `packages/database/package.json`
- Create: `packages/database/test/auth-schema.test.ts`

**Interfaces:**
- Consumes: existing `User`, `UserRole`, and Prisma migration conventions.
- Produces: `AuthProvider.GOOGLE`, nullable `User.passwordHash`, `User.emailVerifiedAt`, `AuthIdentity`, and `EmailVerificationCode` Prisma delegates used by Tasks 3–5.

- [ ] **Step 1: Add the schema contract regression test under the approved schema/config TDD exception**

Add a database test script to `packages/database/package.json`:

```json
"test": "node --test -r ts-node/register \"test/**/*.test.ts\""
```

Create `packages/database/test/auth-schema.test.ts`:

```ts
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
```

- [ ] **Step 2: Run the test and confirm the new contract is absent**

Run:

```bash
npm run test -w packages/database
```

Expected: FAIL because the migration file and new schema members do not exist.

- [ ] **Step 3: Add the Prisma models and relations**

Add this enum near `UserRole` in `schema.prisma`:

```prisma
enum AuthProvider {
  GOOGLE
}
```

Replace the scalar/relation portion of `User` with these exact members while retaining all unrelated relations:

```prisma
model User {
  id              String     @id @default(cuid())
  email           String     @unique
  passwordHash    String?    @map("password_hash")
  emailVerifiedAt DateTime?  @map("email_verified_at")
  fullName        String?    @map("full_name")
  role            UserRole   @default(ADMIN)
  isActive        Boolean    @default(true) @map("is_active")
  tokenVersion    Int        @default(0) @map("token_version")
  createdAt       DateTime   @default(now()) @map("created_at")
  updatedAt       DateTime   @updatedAt @map("updated_at")

  initiatedJobs          Job[]                    @relation("JobsInitiatedByUser")
  auditLogs              AuditLog[]
  maintenanceSnapshots   MaintenanceSnapshot[]
  passwordResetTokens    PasswordResetToken[]
  integrationAccounts    IntegrationAccount[]
  authIdentities         AuthIdentity[]
  emailVerificationCodes EmailVerificationCode[]

  @@map("users")
}
```

Add the new models after `User`:

```prisma
model AuthIdentity {
  id                String       @id @default(cuid())
  userId            String       @map("user_id")
  provider          AuthProvider
  providerAccountId String       @map("provider_account_id")
  createdAt         DateTime     @default(now()) @map("created_at")
  updatedAt         DateTime     @updatedAt @map("updated_at")

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([provider, providerAccountId])
  @@unique([userId, provider])
  @@index([userId])
  @@map("auth_identities")
}

model EmailVerificationCode {
  id           String    @id @default(cuid())
  userId       String    @map("user_id")
  codeHash     String    @map("code_hash")
  expiresAt    DateTime  @map("expires_at")
  consumedAt   DateTime? @map("consumed_at")
  attemptCount Int       @default(0) @map("attempt_count")
  createdAt    DateTime  @default(now()) @map("created_at")

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@index([expiresAt])
  @@map("email_verification_codes")
}
```

- [ ] **Step 4: Write the forward-only SQL migration**

Create `packages/database/prisma/migrations/20260624_add_user_authentication/migration.sql`:

```sql
CREATE TYPE "AuthProvider" AS ENUM ('GOOGLE');

ALTER TABLE "users"
  ALTER COLUMN "password_hash" DROP NOT NULL,
  ADD COLUMN "email_verified_at" TIMESTAMP(3);

UPDATE "users"
SET "email_verified_at" = CURRENT_TIMESTAMP
WHERE "email_verified_at" IS NULL;

CREATE TABLE "auth_identities" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "provider" "AuthProvider" NOT NULL,
  "provider_account_id" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "auth_identities_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "email_verification_codes" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "code_hash" TEXT NOT NULL,
  "expires_at" TIMESTAMP(3) NOT NULL,
  "consumed_at" TIMESTAMP(3),
  "attempt_count" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "email_verification_codes_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "auth_identities_provider_provider_account_id_key"
  ON "auth_identities"("provider", "provider_account_id");
CREATE UNIQUE INDEX "auth_identities_user_id_provider_key"
  ON "auth_identities"("user_id", "provider");
CREATE INDEX "auth_identities_user_id_idx" ON "auth_identities"("user_id");
CREATE INDEX "email_verification_codes_user_id_idx" ON "email_verification_codes"("user_id");
CREATE INDEX "email_verification_codes_expires_at_idx" ON "email_verification_codes"("expires_at");

ALTER TABLE "auth_identities"
  ADD CONSTRAINT "auth_identities_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "email_verification_codes"
  ADD CONSTRAINT "email_verification_codes_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
```

- [ ] **Step 5: Keep the seed administrator verified**

Add `emailVerifiedAt: new Date()` to both `update` and `create` in the administrator `prisma.user.upsert` inside `packages/database/prisma/seed.ts`:

```ts
update: {
  passwordHash: hashPassword(seededAdminPassword.password),
  emailVerifiedAt: new Date(),
  role: UserRole.SUPER_ADMIN,
},
create: {
  email: 'admin@example.com',
  passwordHash: hashPassword(seededAdminPassword.password),
  emailVerifiedAt: new Date(),
  fullName: 'System Administrator',
  role: UserRole.SUPER_ADMIN,
},
```

- [ ] **Step 6: Generate Prisma Client and run the database tests**

Run:

```bash
npm run generate -w packages/database
npm run test -w packages/database
npm run build -w packages/database
```

Expected: Prisma generation succeeds; both auth schema tests PASS; database package build PASS.

- [ ] **Step 7: Commit the persistence slice**

```bash
git add packages/database/package.json packages/database/prisma/schema.prisma packages/database/prisma/migrations/20260624_add_user_authentication/migration.sql packages/database/prisma/seed.ts packages/database/test/auth-schema.test.ts package-lock.json
git commit -m "feat(auth): add verified account identity schema"
```

### Task 2: Configure SMTP delivery and stable auth errors

**Files:**
- Modify: `apps/api/package.json`
- Modify: `apps/api/src/config/env.ts`
- Modify: `apps/api/src/common/filters/all-exceptions.filter.ts`
- Create: `apps/api/src/modules/auth/auth.errors.ts`
- Create: `apps/api/src/modules/mail/mail.module.ts`
- Create: `apps/api/src/modules/mail/mail.service.ts`
- Create: `apps/api/test/mail.service.test.ts`

**Interfaces:**
- Consumes: `getRequiredEnv(name)` and Nest provider injection.
- Produces: `MailService.sendVerificationCode(to, code)` and `MailService.sendPasswordResetLink(to, rawToken)`; `authError(status, code, message, extra)`; typed SMTP/Google config accessors.

- [ ] **Step 1: Install the two runtime libraries and Nodemailer types**

Run:

```bash
npm install nodemailer google-auth-library -w apps/api
npm install --save-dev @types/nodemailer -w apps/api
```

Expected: `apps/api/package.json` and root `package-lock.json` contain the new dependencies.

- [ ] **Step 2: Write the failing mail service tests**

Create `apps/api/test/mail.service.test.ts`:

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MailService } from '../src/modules/mail/mail.service';

test('sendVerificationCode emits safe text and HTML with the ten-minute expiry', async () => {
  const sent: any[] = [];
  const transport = { sendMail: async (message: unknown) => sent.push(message) };
  const service = new MailService(transport as any, 'WPCC <no-reply@example.com>', 'https://wpcc.example.com');

  await service.sendVerificationCode('jane@example.com', '482913');

  assert.equal(sent[0].to, 'jane@example.com');
  assert.match(sent[0].subject, /verify/i);
  assert.match(sent[0].text, /482913/);
  assert.match(sent[0].text, /10 minutes/);
  assert.match(sent[0].html, /482913/);
});

test('sendPasswordResetLink uses WEB_URL and never interpolates an untrusted origin', async () => {
  const sent: any[] = [];
  const transport = { sendMail: async (message: unknown) => sent.push(message) };
  const service = new MailService(transport as any, 'WPCC <no-reply@example.com>', 'https://wpcc.example.com');

  await service.sendPasswordResetLink('jane@example.com', 'raw-token');

  assert.match(sent[0].text, /https:\/\/wpcc\.example\.com\/\?mode=reset-password&token=raw-token/);
  assert.match(sent[0].text, /one hour/i);
  assert.doesNotMatch(sent[0].text, /localhost/);
});
```

- [ ] **Step 3: Run the focused test and verify it fails**

Run:

```bash
node --test -r ts-node/register apps/api/test/mail.service.test.ts
```

Expected: FAIL with module-not-found for `mail.service`.

- [ ] **Step 4: Add typed environment accessors**

Append to `apps/api/src/config/env.ts`:

```ts
export interface SmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  password: string;
  from: string;
}

export interface GoogleAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

function parsePort(name: string, value: string): number {
  const port = Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`${name} must be an integer between 1 and 65535`);
  }
  return port;
}

export function getWebUrl(): string {
  const value = getRequiredEnv('WEB_URL');
  const url = new URL(value);
  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new Error('WEB_URL must use http or https');
  }
  return url.origin;
}

export function getSmtpConfig(): SmtpConfig {
  return {
    host: getRequiredEnv('SMTP_HOST'),
    port: parsePort('SMTP_PORT', getRequiredEnv('SMTP_PORT')),
    secure: getRequiredEnv('SMTP_SECURE') === 'true',
    user: getRequiredEnv('SMTP_USER'),
    password: getRequiredEnv('SMTP_PASSWORD'),
    from: getRequiredEnv('MAIL_FROM'),
  };
}

export function getGoogleAuthConfig(): GoogleAuthConfig {
  return {
    clientId: getRequiredEnv('GOOGLE_CLIENT_ID'),
    clientSecret: getRequiredEnv('GOOGLE_CLIENT_SECRET'),
    redirectUri: getRequiredEnv('GOOGLE_AUTH_REDIRECT_URI'),
  };
}
```

Inside `validateEnvironment`, append the new names only in production:

```ts
if (process.env.NODE_ENV === 'production') {
  required.push(
    'WEB_URL',
    'SMTP_HOST',
    'SMTP_PORT',
    'SMTP_SECURE',
    'SMTP_USER',
    'SMTP_PASSWORD',
    'MAIL_FROM',
    'GOOGLE_CLIENT_ID',
    'GOOGLE_CLIENT_SECRET',
    'GOOGLE_AUTH_REDIRECT_URI',
  );
}
```

After the missing-variable check, validate the typed values when all new keys are present:

```ts
if (required.every((name) => process.env[name])) {
  if (process.env.NODE_ENV === 'production') {
    getWebUrl();
    getSmtpConfig();
    const google = getGoogleAuthConfig();
    const callback = new URL(google.redirectUri);
    if (!['http:', 'https:'].includes(callback.protocol)) {
      throw new Error('GOOGLE_AUTH_REDIRECT_URI must use http or https');
    }
  }
}
```

- [ ] **Step 5: Add stable auth exceptions and preserve their fields**

Create `apps/api/src/modules/auth/auth.errors.ts`:

```ts
import { HttpException, HttpStatus } from '@nestjs/common';

export type AuthErrorCode =
  | 'INVALID_CREDENTIALS'
  | 'EMAIL_NOT_VERIFIED'
  | 'PASSWORD_LOGIN_UNAVAILABLE'
  | 'EMAIL_ALREADY_EXISTS'
  | 'EMAIL_VERIFICATION_PENDING'
  | 'EMAIL_DELIVERY_FAILED'
  | 'VERIFICATION_CODE_INVALID'
  | 'VERIFICATION_CODE_EXPIRED'
  | 'VERIFICATION_CODE_USED'
  | 'VERIFICATION_ATTEMPTS_EXCEEDED'
  | 'VERIFICATION_RESEND_COOLDOWN'
  | 'RESET_TOKEN_INVALID'
  | 'RESET_TOKEN_EXPIRED'
  | 'RESET_TOKEN_USED'
  | 'GOOGLE_AUTH_FAILED';

export function authError(
  status: HttpStatus,
  code: AuthErrorCode,
  message: string,
  extra: Record<string, unknown> = {},
): HttpException {
  return new HttpException({ statusCode: status, code, message, ...extra }, status);
}
```

In `AllExceptionsFilter.catch`, declare `code` and `extra`, copy safe auth fields from object exceptions, then spread them into the response:

```ts
let code: string | undefined;
let extra: Record<string, unknown> = {};

if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
  const res = exceptionResponse as Record<string, unknown>;
  message = (res.message as string) || exception.message;
  error = (res.error as string) || exception.name;
  code = typeof res.code === 'string' ? res.code : undefined;
  if (typeof res.retryAfterSeconds === 'number') {
    extra = { retryAfterSeconds: res.retryAfterSeconds };
  }
  if (Array.isArray(res.message)) {
    message = (res.message as string[]).join('; ');
  }
}

response.status(status).json({
  statusCode: status,
  message,
  error,
  ...(code ? { code } : {}),
  ...extra,
  timestamp: new Date().toISOString(),
  path: request.url,
});
```

Remove the old duplicated object-exception block while applying this replacement.

- [ ] **Step 6: Implement the SMTP module**

Create `apps/api/src/modules/mail/mail.service.ts`:

```ts
import { Inject, Injectable } from '@nestjs/common';
import type { Transporter } from 'nodemailer';

export const MAIL_TRANSPORT = Symbol('MAIL_TRANSPORT');
export const MAIL_FROM = Symbol('MAIL_FROM');
export const WEB_URL = Symbol('WEB_URL');

@Injectable()
export class MailService {
  constructor(
    @Inject(MAIL_TRANSPORT) private readonly transport: Pick<Transporter, 'sendMail'>,
    @Inject(MAIL_FROM) private readonly from: string,
    @Inject(WEB_URL) private readonly webUrl: string,
  ) {}

  async sendVerificationCode(to: string, code: string): Promise<void> {
    await this.transport.sendMail({
      from: this.from,
      to,
      subject: 'Verify your WP Control Center email',
      text: `Your WP Control Center verification code is ${code}. It expires in 10 minutes. If you did not create this account, ignore this email.`,
      html: `<p>Your WP Control Center verification code is:</p><p style="font-size:28px;font-weight:700;letter-spacing:6px">${code}</p><p>It expires in 10 minutes. If you did not create this account, ignore this email.</p>`,
    });
  }

  async sendPasswordResetLink(to: string, rawToken: string): Promise<void> {
    const url = new URL('/', this.webUrl);
    url.searchParams.set('mode', 'reset-password');
    url.searchParams.set('token', rawToken);
    const link = url.toString();
    await this.transport.sendMail({
      from: this.from,
      to,
      subject: 'Reset your WP Control Center password',
      text: `Reset your password within one hour: ${link}\n\nIf you did not request this reset, ignore this email.`,
      html: `<p>Reset your password within one hour:</p><p><a href="${link}">Reset password</a></p><p>If you did not request this reset, ignore this email.</p>`,
    });
  }
}
```

Create `apps/api/src/modules/mail/mail.module.ts`:

```ts
import { Module } from '@nestjs/common';
import nodemailer from 'nodemailer';
import { getSmtpConfig, getWebUrl } from '../../config/env';
import { MAIL_FROM, MAIL_TRANSPORT, MailService, WEB_URL } from './mail.service';

@Module({
  providers: [
    {
      provide: MAIL_TRANSPORT,
      useFactory: () => {
        const config = getSmtpConfig();
        return nodemailer.createTransport({
          host: config.host,
          port: config.port,
          secure: config.secure,
          auth: { user: config.user, pass: config.password },
        });
      },
    },
    { provide: MAIL_FROM, useFactory: () => getSmtpConfig().from },
    { provide: WEB_URL, useFactory: getWebUrl },
    MailService,
  ],
  exports: [MailService],
})
export class MailModule {}
```

- [ ] **Step 7: Run mail and API checks**

Run:

```bash
node --test -r ts-node/register apps/api/test/mail.service.test.ts
npm run typecheck -w apps/api
```

Expected: two mail tests PASS and API typecheck PASS.

- [ ] **Step 8: Commit the mail/config slice**

```bash
git add apps/api/package.json apps/api/src/config/env.ts apps/api/src/common/filters/all-exceptions.filter.ts apps/api/src/modules/auth/auth.errors.ts apps/api/src/modules/mail apps/api/test/mail.service.test.ts package-lock.json
git commit -m "feat(auth): add SMTP mail delivery"
```

### Task 3: Add ADMIN registration and email OTP verification

**Files:**
- Create: `apps/api/src/modules/auth/dto/register.dto.ts`
- Create: `apps/api/src/modules/auth/dto/verify-email.dto.ts`
- Create: `apps/api/src/modules/auth/dto/resend-verification.dto.ts`
- Create: `apps/api/src/modules/auth/email-verification.service.ts`
- Create: `apps/api/test/email-verification.service.test.ts`
- Modify: `apps/api/src/modules/auth/auth.module.ts`

**Interfaces:**
- Consumes: `MailService.sendVerificationCode`, Prisma auth models, `getJwtSecret`, and `authError`.
- Produces: `register(payload)`, `verify(payload)`, and `resend(payload)` service methods used by Task 6 controller endpoints.

- [ ] **Step 1: Write failing tests for registration, verification, and resend**

Create `apps/api/test/email-verification.service.test.ts` with an in-memory Prisma fake that implements `user.findUnique/create/update`, `emailVerificationCode.findFirst/create/updateMany`, and callback-style `$transaction`. The complete assertions are:

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EmailVerificationService } from '../src/modules/auth/email-verification.service';

function createFixture() {
  const users: any[] = [];
  const codes: any[] = [];
  const sent: Array<{ to: string; code: string }> = [];
  let now = new Date('2026-06-24T00:00:00Z');
  const prisma: any = {
    user: {
      findUnique: async ({ where }: any) => users.find((user) => user.email === where.email) ?? null,
      create: async ({ data }: any) => {
        const user = { id: `user_${users.length + 1}`, emailVerifiedAt: null, isActive: true, ...data };
        users.push(user);
        return user;
      },
      update: async ({ where, data }: any) => {
        const user = users.find((candidate) => candidate.id === where.id);
        Object.assign(user, data);
        return user;
      },
    },
    emailVerificationCode: {
      findFirst: async ({ where }: any) => codes.filter((code) => code.userId === where.userId).at(-1) ?? null,
      create: async ({ data }: any) => {
        const code = { id: `code_${codes.length + 1}`, attemptCount: 0, consumedAt: null, createdAt: new Date(), ...data };
        codes.push(code);
        return code;
      },
      updateMany: async ({ where, data }: any) => {
        const matches = codes.filter((code) =>
          (where.id === undefined || code.id === where.id) &&
          (where.userId === undefined || code.userId === where.userId) &&
          (where.consumedAt === undefined || code.consumedAt === where.consumedAt) &&
          (where.attemptCount?.lt === undefined || code.attemptCount < where.attemptCount.lt) &&
          (where.expiresAt?.gt === undefined || code.expiresAt > where.expiresAt.gt),
        );
        for (const code of matches) {
          if (data.attemptCount?.increment) code.attemptCount += data.attemptCount.increment;
          if (data.consumedAt) code.consumedAt = data.consumedAt;
        }
        return { count: matches.length };
      },
    },
    $transaction: async (work: (tx: any) => Promise<unknown>) => work(prisma),
  };
  const mail = { sendVerificationCode: async (to: string, code: string) => sent.push({ to, code }) };
  return { users, codes, sent, advance: (milliseconds: number) => { now = new Date(now.getTime() + milliseconds); }, service: new EmailVerificationService(prisma, mail as any, () => now) };
}

test('register normalizes email, creates ADMIN, hashes password and sends a six-digit code', async () => {
  process.env.JWT_SECRET = 'test-secret-at-least-32-characters-long';
  const fixture = createFixture();
  const result = await fixture.service.register({ fullName: ' Jane Doe ', email: ' JANE@Example.com ', password: 'StrongPass123!' });
  assert.equal(fixture.users[0].email, 'jane@example.com');
  assert.equal(fixture.users[0].role, 'ADMIN');
  assert.notEqual(fixture.users[0].passwordHash, 'StrongPass123!');
  assert.equal(fixture.codes[0].codeHash.includes(fixture.sent[0].code), false);
  assert.match(fixture.sent[0].code, /^\d{6}$/);
  assert.equal(result.verificationRequired, true);
});

test('verify rejects wrong codes and consumes the correct code once', async () => {
  process.env.JWT_SECRET = 'test-secret-at-least-32-characters-long';
  const fixture = createFixture();
  await fixture.service.register({ fullName: 'Jane', email: 'jane@example.com', password: 'StrongPass123!' });
  await assert.rejects(() => fixture.service.verify({ email: 'jane@example.com', code: '000000' }), (error: any) => error.getResponse().code === 'VERIFICATION_CODE_INVALID');
  await fixture.service.verify({ email: 'jane@example.com', code: fixture.sent[0].code });
  assert.ok(fixture.users[0].emailVerifiedAt instanceof Date);
  assert.ok(fixture.codes[0].consumedAt instanceof Date);
  await assert.rejects(() => fixture.service.verify({ email: 'jane@example.com', code: fixture.sent[0].code }));
});

test('resend enforces 60 seconds and invalidates the earlier code', async () => {
  process.env.JWT_SECRET = 'test-secret-at-least-32-characters-long';
  const fixture = createFixture();
  await fixture.service.register({ fullName: 'Jane', email: 'jane@example.com', password: 'StrongPass123!' });
  await assert.rejects(() => fixture.service.resend({ email: 'jane@example.com' }), (error: any) => error.getResponse().code === 'VERIFICATION_RESEND_COOLDOWN');
  fixture.advance(60_001);
  await fixture.service.resend({ email: 'jane@example.com' });
  assert.ok(fixture.codes[0].consumedAt instanceof Date);
  assert.equal(fixture.sent.length, 2);
});

test('verify rejects expired codes and locks after five wrong attempts', async () => {
  process.env.JWT_SECRET = 'test-secret-at-least-32-characters-long';
  const fixture = createFixture();
  await fixture.service.register({ fullName: 'Jane', email: 'jane@example.com', password: 'StrongPass123!' });
  fixture.advance(10 * 60 * 1000 + 1);
  await assert.rejects(() => fixture.service.verify({ email: 'jane@example.com', code: fixture.sent[0].code }), (error: any) => error.getResponse().code === 'VERIFICATION_CODE_EXPIRED');
  fixture.codes[0].expiresAt = new Date('2026-06-25T00:00:00Z');
  fixture.codes[0].attemptCount = 4;
  await assert.rejects(() => fixture.service.verify({ email: 'jane@example.com', code: '000000' }), (error: any) => error.getResponse().code === 'VERIFICATION_ATTEMPTS_EXCEEDED');
});

test('only one concurrent submission can consume a correct code', async () => {
  process.env.JWT_SECRET = 'test-secret-at-least-32-characters-long';
  const fixture = createFixture();
  await fixture.service.register({ fullName: 'Jane', email: 'jane@example.com', password: 'StrongPass123!' });
  const payload = { email: 'jane@example.com', code: fixture.sent[0].code };
  const results = await Promise.allSettled([fixture.service.verify(payload), fixture.service.verify(payload)]);
  assert.equal(results.filter((result) => result.status === 'fulfilled').length, 1);
  assert.equal(results.filter((result) => result.status === 'rejected').length, 1);
});
```

- [ ] **Step 2: Run the focused tests and verify they fail**

Run:

```bash
node --test -r ts-node/register apps/api/test/email-verification.service.test.ts
```

Expected: FAIL because DTO/service modules do not exist.

- [ ] **Step 3: Add the three request DTOs**

Create `register.dto.ts`:

```ts
import { Transform } from 'class-transformer';
import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';

export class RegisterDto {
  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  fullName!: string;

  @Transform(({ value }) => typeof value === 'string' ? value.trim().toLowerCase() : value)
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password!: string;
}
```

Create `verify-email.dto.ts`:

```ts
import { Transform } from 'class-transformer';
import { IsEmail, Matches } from 'class-validator';

export class VerifyEmailDto {
  @Transform(({ value }) => typeof value === 'string' ? value.trim().toLowerCase() : value)
  @IsEmail()
  email!: string;

  @Matches(/^\d{6}$/)
  code!: string;
}
```

Create `resend-verification.dto.ts`:

```ts
import { Transform } from 'class-transformer';
import { IsEmail } from 'class-validator';

export class ResendVerificationDto {
  @Transform(({ value }) => typeof value === 'string' ? value.trim().toLowerCase() : value)
  @IsEmail()
  email!: string;
}
```

- [ ] **Step 4: Implement the email verification service**

Create `email-verification.service.ts` with these constants and public methods:

```ts
import { HttpStatus, Inject, Injectable, Optional } from '@nestjs/common';
import { UserRole } from '@wpcc/database';
import { createHmac, randomInt, timingSafeEqual } from 'node:crypto';
import { getJwtSecret } from '../../config/env';
import { hashPassword } from '../../common/utils/crypto.utils';
import { PrismaService } from '../database/prisma.service';
import { MailService } from '../mail/mail.service';
import { authError } from './auth.errors';
import { RegisterDto } from './dto/register.dto';
import { ResendVerificationDto } from './dto/resend-verification.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';

const OTP_TTL_MS = 10 * 60 * 1000;
const RESEND_COOLDOWN_MS = 60 * 1000;
const MAX_ATTEMPTS = 5;
export const AUTH_CLOCK = Symbol('AUTH_CLOCK');

@Injectable()
export class EmailVerificationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
    @Optional() @Inject(AUTH_CLOCK) private readonly clock?: () => Date,
  ) {}

  private now(): Date {
    return this.clock ? this.clock() : new Date();
  }

  private normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }

  private newCode(): string {
    return randomInt(0, 1_000_000).toString().padStart(6, '0');
  }

  private hashCode(userId: string, code: string): string {
    return createHmac('sha256', getJwtSecret()).update(`${userId}:${code}`).digest('hex');
  }

  private equalHash(actual: string, expected: string): boolean {
    const left = Buffer.from(actual, 'hex');
    const right = Buffer.from(expected, 'hex');
    return left.length === right.length && timingSafeEqual(left, right);
  }

  private maskEmail(email: string): string {
    const [local, domain] = email.split('@');
    return `${local.slice(0, 1)}***@${domain}`;
  }

  async register(payload: RegisterDto) {
    const email = this.normalizeEmail(payload.email);
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw authError(
        HttpStatus.CONFLICT,
        existing.emailVerifiedAt ? 'EMAIL_ALREADY_EXISTS' : 'EMAIL_VERIFICATION_PENDING',
        existing.emailVerifiedAt ? 'An account already exists for this email' : 'Email verification is still pending',
      );
    }

    const rawCode = this.newCode();
    const createdAt = this.now();
    const user = await this.prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          email,
          fullName: payload.fullName.trim(),
          passwordHash: hashPassword(payload.password),
          role: UserRole.ADMIN,
        },
      });
      await tx.emailVerificationCode.create({
        data: {
          userId: created.id,
          codeHash: this.hashCode(created.id, rawCode),
          expiresAt: new Date(createdAt.getTime() + OTP_TTL_MS),
          createdAt,
        },
      });
      return created;
    });

    try {
      await this.mail.sendVerificationCode(user.email, rawCode);
    } catch {
      throw authError(HttpStatus.SERVICE_UNAVAILABLE, 'EMAIL_DELIVERY_FAILED', 'The account was created, but the verification email could not be sent');
    }

    return { verificationRequired: true, email: this.maskEmail(user.email), resendAvailableInSeconds: 60 };
  }

  async verify(payload: VerifyEmailDto) {
    const email = this.normalizeEmail(payload.email);
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) throw authError(HttpStatus.BAD_REQUEST, 'VERIFICATION_CODE_INVALID', 'Invalid verification code');
    if (user.emailVerifiedAt) return { success: true, email: user.email };

    const code = await this.prisma.emailVerificationCode.findFirst({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
    });
    if (!code) throw authError(HttpStatus.BAD_REQUEST, 'VERIFICATION_CODE_INVALID', 'Invalid verification code');
    if (code.consumedAt) throw authError(HttpStatus.BAD_REQUEST, 'VERIFICATION_CODE_USED', 'Verification code has already been used');
    if (code.attemptCount >= MAX_ATTEMPTS) throw authError(HttpStatus.TOO_MANY_REQUESTS, 'VERIFICATION_ATTEMPTS_EXCEEDED', 'Request a new verification code');
    if (code.expiresAt <= this.now()) throw authError(HttpStatus.BAD_REQUEST, 'VERIFICATION_CODE_EXPIRED', 'Verification code has expired');

    const suppliedHash = this.hashCode(user.id, payload.code);
    if (!this.equalHash(suppliedHash, code.codeHash)) {
      await this.prisma.emailVerificationCode.updateMany({ where: { id: code.id, consumedAt: null }, data: { attemptCount: { increment: 1 } } });
      const nextAttempts = code.attemptCount + 1;
      throw authError(
        nextAttempts >= MAX_ATTEMPTS ? HttpStatus.TOO_MANY_REQUESTS : HttpStatus.BAD_REQUEST,
        nextAttempts >= MAX_ATTEMPTS ? 'VERIFICATION_ATTEMPTS_EXCEEDED' : 'VERIFICATION_CODE_INVALID',
        nextAttempts >= MAX_ATTEMPTS ? 'Request a new verification code' : 'Invalid verification code',
      );
    }

    const now = this.now();
    await this.prisma.$transaction(async (tx) => {
      const consumed = await tx.emailVerificationCode.updateMany({
        where: { id: code.id, consumedAt: null, attemptCount: { lt: MAX_ATTEMPTS }, expiresAt: { gt: now } },
        data: { consumedAt: now },
      });
      if (consumed.count !== 1) throw authError(HttpStatus.BAD_REQUEST, 'VERIFICATION_CODE_USED', 'Verification code has already been used');
      await tx.user.update({ where: { id: user.id }, data: { emailVerifiedAt: now } });
    });
    return { success: true, email: user.email };
  }

  async resend(payload: ResendVerificationDto) {
    const email = this.normalizeEmail(payload.email);
    const user = await this.prisma.user.findUnique({ where: { email } });
    const generic = { success: true, resendAvailableInSeconds: 60 };
    if (!user || user.emailVerifiedAt) return generic;

    const latest = await this.prisma.emailVerificationCode.findFirst({ where: { userId: user.id }, orderBy: { createdAt: 'desc' } });
    const now = this.now();
    if (latest) {
      const retryAfterSeconds = Math.ceil((latest.createdAt.getTime() + RESEND_COOLDOWN_MS - now.getTime()) / 1000);
      if (retryAfterSeconds > 0) throw authError(HttpStatus.TOO_MANY_REQUESTS, 'VERIFICATION_RESEND_COOLDOWN', 'Wait before requesting another code', { retryAfterSeconds });
    }

    const rawCode = this.newCode();
    await this.prisma.$transaction(async (tx) => {
      await tx.emailVerificationCode.updateMany({ where: { userId: user.id, consumedAt: null }, data: { consumedAt: now } });
      await tx.emailVerificationCode.create({ data: { userId: user.id, codeHash: this.hashCode(user.id, rawCode), expiresAt: new Date(now.getTime() + OTP_TTL_MS), createdAt: now } });
    });
    try {
      await this.mail.sendVerificationCode(user.email, rawCode);
    } catch {
      throw authError(HttpStatus.SERVICE_UNAVAILABLE, 'EMAIL_DELIVERY_FAILED', 'The verification email could not be sent');
    }
    return generic;
  }
}
```

- [ ] **Step 5: Register the service and mail dependency**

Update `AuthModule`:

```ts
import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { EmailVerificationService } from './email-verification.service';
import { MailModule } from '../mail/mail.module';

@Module({
  imports: [MailModule],
  controllers: [AuthController],
  providers: [AuthService, EmailVerificationService],
  exports: [AuthService],
})
export class AuthModule {}
```

- [ ] **Step 6: Run the OTP tests and API checks**

Run:

```bash
node --test -r ts-node/register apps/api/test/email-verification.service.test.ts
npm run lint -w apps/api
npm run typecheck -w apps/api
```

Expected: three OTP tests PASS; lint and typecheck PASS.

- [ ] **Step 7: Commit the verification domain**

```bash
git add apps/api/src/modules/auth/dto apps/api/src/modules/auth/email-verification.service.ts apps/api/src/modules/auth/auth.module.ts apps/api/test/email-verification.service.test.ts
git commit -m "feat(auth): add email registration verification"
```

### Task 4: Enforce verification at login and deliver password resets

**Files:**
- Modify: `apps/api/src/modules/auth/auth.service.ts`
- Modify: `apps/api/test/auth.service.test.ts`

**Interfaces:**
- Consumes: nullable `passwordHash`, `emailVerifiedAt`, `MailService`, `authError`.
- Produces: `AuthService.createSession(user)`, verification-aware `login`, SMTP-backed `forgotPassword`, and stable reset errors used by Tasks 5–6.

- [ ] **Step 1: Extend the existing auth test fixture first**

Update `apps/api/test/auth.service.test.ts` so the fixture user contains `emailVerifiedAt` and `tokenVersion`, inject a mail fake into `new AuthService`, and add these tests:

```ts
test('login refuses an unverified local account and a Google-only account', async () => {
  process.env.JWT_SECRET = 'test-jwt-secret-at-least-32-characters';
  const fixture = createAuthFixture();
  fixture.user.emailVerifiedAt = null;
  await assert.rejects(
    () => fixture.service.login({ email: fixture.user.email, password: 'OldPass123!' }),
    (error: any) => error.getResponse().code === 'EMAIL_NOT_VERIFIED',
  );
  fixture.user.emailVerifiedAt = new Date();
  fixture.user.passwordHash = null;
  await assert.rejects(
    () => fixture.service.login({ email: fixture.user.email, password: 'OldPass123!' }),
    (error: any) => error.getResponse().code === 'PASSWORD_LOGIN_UNAVAILABLE',
  );
});

test('forgotPassword sends a trusted reset link but never returns the raw token', async () => {
  const fixture = createAuthFixture();
  const result = await fixture.service.forgotPassword({ email: fixture.user.email });
  assert.deepEqual(result, {
    success: true,
    message: 'If an account exists for that email, a password reset link has been sent',
  });
  assert.equal(fixture.sentResetTokens.length, 1);
});
```

Use this complete fixture above the tests and migrate the existing reset test to it:

```ts
function createAuthFixture() {
  const user: any = {
    id: 'user_1', email: 'admin@example.com', role: 'SUPER_ADMIN', fullName: 'System Administrator',
    isActive: true, emailVerifiedAt: new Date(), tokenVersion: 0, passwordHash: hashPassword('OldPass123!'),
  };
  const resetTokens: any[] = [];
  const sentResetTokens: Array<{ email: string; token: string }> = [];
  const prisma: any = {
    user: {
      findUnique: async ({ where }: any) => (where.email === user.email || where.id === user.id ? user : null),
      update: async ({ data }: any) => {
        if (data.tokenVersion?.increment) user.tokenVersion += data.tokenVersion.increment;
        Object.assign(user, { ...data, tokenVersion: user.tokenVersion });
        return user;
      },
    },
    passwordResetToken: {
      create: async ({ data }: any) => { const token = { id: `reset_${resetTokens.length + 1}`, usedAt: null, ...data }; resetTokens.push(token); return token; },
      findUnique: async ({ where, include }: any) => { const token = resetTokens.find((candidate) => candidate.tokenHash === where.tokenHash); return token && include?.user ? { ...token, user } : token ?? null; },
      update: async ({ where, data }: any) => { const token = resetTokens.find((candidate) => candidate.id === where.id); Object.assign(token, data); return token; },
    },
    $transaction: async (operations: Array<Promise<unknown>>) => Promise.all(operations),
  };
  const mail = { sendPasswordResetLink: async (email: string, token: string) => sentResetTokens.push({ email, token }) };
  return { user, resetTokens, sentResetTokens, service: new AuthService(prisma, mail as any) };
}
```

- [ ] **Step 2: Run the auth service tests and verify the new cases fail**

Run:

```bash
node --test -r ts-node/register apps/api/test/auth.service.test.ts
```

Expected: FAIL because `AuthService` does not inject MailService or enforce email verification.

- [ ] **Step 3: Refactor session creation and login rules**

Replace the Nest import with `import { HttpStatus, Injectable, InternalServerErrorException, UnauthorizedException } from '@nestjs/common';`, add `import { MailService } from '../mail/mail.service';` and `import { authError } from './auth.errors';`, then inject `MailService` and add `createSession`:

```ts
constructor(
  private readonly prisma: PrismaService,
  private readonly mail: MailService,
) {}

createSession(user: { id: string; email: string; role: string; fullName: string | null; tokenVersion: number }) {
  let secret: string;
  try {
    secret = getJwtSecret();
  } catch (error) {
    throw new InternalServerErrorException(error instanceof Error ? error.message : 'JWT_SECRET environment variable is missing');
  }
  const accessToken = jwt.sign(
    { id: user.id, email: user.email, role: user.role, tokenVersion: user.tokenVersion },
    secret,
    { expiresIn: (process.env.JWT_EXPIRES_IN || '1d') as any, algorithm: 'HS256' },
  );
  return {
    accessToken,
    user: { id: user.id, email: user.email, role: user.role, fullName: user.fullName },
  };
}
```

Replace the pre-password section of `login` with:

```ts
const email = payload.email.trim().toLowerCase();
const user = await this.prisma.user.findUnique({ where: { email } });
if (!user || !user.isActive) {
  throw authError(HttpStatus.UNAUTHORIZED, 'INVALID_CREDENTIALS', 'Invalid email or password');
}
if (!user.emailVerifiedAt) {
  throw authError(HttpStatus.FORBIDDEN, 'EMAIL_NOT_VERIFIED', 'Verify your email before signing in');
}
if (!user.passwordHash) {
  throw authError(HttpStatus.BAD_REQUEST, 'PASSWORD_LOGIN_UNAVAILABLE', 'Continue with Google for this account');
}
if (!verifyPassword(payload.password, user.passwordHash)) {
  throw authError(HttpStatus.UNAUTHORIZED, 'INVALID_CREDENTIALS', 'Invalid email or password');
}
```

Retain the legacy scrypt upgrade and replace the existing JWT block with:

```ts
return this.createSession(user);
```

- [ ] **Step 4: Send the existing reset token through SMTP**

Normalize email at the start of `forgotPassword`, require active + verified + non-null password, remove the development token response, and send after persistence:

```ts
const email = payload.email.trim().toLowerCase();
const user = await this.prisma.user.findUnique({ where: { email } });
const genericResponse = {
  success: true,
  message: 'If an account exists for that email, a password reset link has been sent',
};
if (!user || !user.isActive || !user.emailVerifiedAt || !user.passwordHash) return genericResponse;

const rawToken = crypto.randomBytes(32).toString('hex');
const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
await this.prisma.passwordResetToken.create({
  data: { tokenHash, expiresAt: new Date(Date.now() + 3600 * 1000), userId: user.id },
});
try {
  await this.mail.sendPasswordResetLink(user.email, rawToken);
} catch {
  throw authError(HttpStatus.SERVICE_UNAVAILABLE, 'EMAIL_DELIVERY_FAILED', 'The password reset email could not be sent');
}
return genericResponse;
```

Replace the three reset-token exceptions with `RESET_TOKEN_INVALID`, `RESET_TOKEN_USED`, and `RESET_TOKEN_EXPIRED` through `authError`; retain the existing transaction and tokenVersion increment.

- [ ] **Step 5: Run the complete API unit suite**

Run:

```bash
npm run test -w apps/api
npm run lint -w apps/api
npm run typecheck -w apps/api
```

Expected: all API tests PASS; lint and typecheck PASS.

- [ ] **Step 6: Commit login and recovery behavior**

```bash
git add apps/api/src/modules/auth/auth.service.ts apps/api/test/auth.service.test.ts
git commit -m "feat(auth): enforce verification and email resets"
```

### Task 5: Add Google OpenID Connect with safe account linking

**Files:**
- Create: `apps/api/src/modules/auth/auth-cookie.util.ts`
- Create: `apps/api/src/modules/auth/google-auth.service.ts`
- Create: `apps/api/test/google-auth.service.test.ts`
- Modify: `apps/api/src/common/guards/auth.guard.ts`
- Modify: `apps/api/src/modules/auth/auth.module.ts`

**Interfaces:**
- Consumes: `getGoogleAuthConfig`, `getJwtSecret`, `AuthService.createSession`, Prisma `AuthIdentity`, and Google `OAuth2Client`.
- Produces: `createAuthorization()` and `completeAuthorization(code, state, signedCookie)` for Task 6.

- [ ] **Step 1: Write failing Google account-linking tests**

Create `apps/api/test/google-auth.service.test.ts`. Mock the Google adapter through constructor injection; assert these exact outcomes:

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Prisma } from '@wpcc/database';
import { GoogleAuthService } from '../src/modules/auth/google-auth.service';

test('completeAuthorization creates a verified ADMIN for a new Google email', async () => {
  const fixture = createGoogleFixture({ sub: 'google-1', email: 'Jane@Example.com', email_verified: true });
  const auth = fixture.service.createAuthorization();
  const result = await fixture.service.completeAuthorization('code-1', fixture.capturedState(), auth.signedCookie);
  assert.equal(result.user.email, 'jane@example.com');
  assert.equal(result.user.role, 'ADMIN');
  assert.ok(result.user.emailVerifiedAt instanceof Date);
  assert.equal(result.user.passwordHash, null);
  assert.equal(fixture.identities.length, 1);
});

test('completeAuthorization links a matching email instead of creating a duplicate user', async () => {
  const fixture = createGoogleFixture({ sub: 'google-1', email: 'jane@example.com', email_verified: true });
  fixture.users.push({ id: 'user-1', email: 'jane@example.com', passwordHash: 'hash', emailVerifiedAt: new Date(), role: 'ADMIN', isActive: true, tokenVersion: 0, fullName: 'Jane' });
  const auth = fixture.service.createAuthorization();
  await fixture.service.completeAuthorization('code-1', fixture.capturedState(), auth.signedCookie);
  assert.equal(fixture.users.length, 1);
  assert.equal(fixture.identities[0].userId, 'user-1');
});

test('completeAuthorization rejects unverified email and nonce mismatch', async () => {
  const unverified = createGoogleFixture({ sub: 'google-1', email: 'jane@example.com', email_verified: false });
  const auth = unverified.service.createAuthorization();
  await assert.rejects(() => unverified.service.completeAuthorization('code-1', unverified.capturedState(), auth.signedCookie));
  const wrongNonce = createGoogleFixture({ sub: 'google-1', email: 'jane@example.com', email_verified: true, nonce: 'other' });
  const wrongAuth = wrongNonce.service.createAuthorization();
  await assert.rejects(() => wrongNonce.service.completeAuthorization('code-1', wrongNonce.capturedState(), wrongAuth.signedCookie));
});

test('completeAuthorization reuses an existing immutable Google identity', async () => {
  const fixture = createGoogleFixture({ sub: 'google-1', email: 'jane@example.com', email_verified: true });
  fixture.users.push({ id: 'user-1', email: 'jane@example.com', passwordHash: null, emailVerifiedAt: new Date(), role: 'ADMIN', isActive: true, tokenVersion: 0, fullName: 'Jane' });
  fixture.identities.push({ id: 'identity-1', userId: 'user-1', provider: 'GOOGLE', providerAccountId: 'google-1' });
  const auth = fixture.service.createAuthorization();
  const result = await fixture.service.completeAuthorization('code-1', fixture.capturedState(), auth.signedCookie);
  assert.equal(result.user.id, 'user-1');
  assert.equal(fixture.identities.length, 1);
});

test('completeAuthorization resolves a P2002 race through the winning identity', async () => {
  const fixture = createGoogleFixture({ sub: 'google-1', email: 'jane@example.com', email_verified: true });
  fixture.users.push({ id: 'user-1', email: 'jane@example.com', passwordHash: 'hash', emailVerifiedAt: new Date(), role: 'ADMIN', isActive: true, tokenVersion: 0, fullName: 'Jane' });
  fixture.tx.authIdentity.create = async ({ data }: any) => {
    fixture.identities.push({ id: 'identity-winner', ...data });
    throw new Prisma.PrismaClientKnownRequestError('Unique identity', { code: 'P2002', clientVersion: '5.14.0' });
  };
  const auth = fixture.service.createAuthorization();
  const result = await fixture.service.completeAuthorization('code-1', fixture.capturedState(), auth.signedCookie);
  assert.equal(result.user.id, 'user-1');
  assert.equal(fixture.identities.length, 1);
});
```

Use this complete fixture above those tests; it implements callback-style Prisma transactions and never calls Google over the network:

```ts
function createGoogleFixture(profile: any) {
  process.env.JWT_SECRET = 'test-secret-at-least-32-characters-long';
  process.env.GOOGLE_CLIENT_ID = 'client-id';
  process.env.GOOGLE_CLIENT_SECRET = 'client-secret';
  process.env.GOOGLE_AUTH_REDIRECT_URI = 'https://api.example.com/api/auth/google/callback';
  const users: any[] = [];
  const identities: any[] = [];
  let state = '';
  let nonce = '';
  const tx: any = {
    authIdentity: {
      findUnique: async ({ where, include }: any) => {
        const key = where.provider_providerAccountId;
        const identity = identities.find((item) => item.provider === key.provider && item.providerAccountId === key.providerAccountId);
        if (!identity) return null;
        return include?.user ? { ...identity, user: users.find((user) => user.id === identity.userId) } : identity;
      },
      create: async ({ data }: any) => {
        const identity = { id: `identity-${identities.length + 1}`, ...data };
        identities.push(identity);
        return identity;
      },
    },
    user: {
      findUnique: async ({ where }: any) => users.find((user) => user.email === where.email || user.id === where.id) ?? null,
      update: async ({ where, data }: any) => {
        const user = users.find((candidate) => candidate.id === where.id);
        Object.assign(user, data);
        return user;
      },
      create: async ({ data }: any) => {
        const nestedIdentity = data.authIdentities?.create;
        const user = { id: `user-${users.length + 1}`, isActive: true, tokenVersion: 0, ...data };
        delete user.authIdentities;
        users.push(user);
        if (nestedIdentity) identities.push({ id: `identity-${identities.length + 1}`, userId: user.id, ...nestedIdentity });
        return user;
      },
    },
  };
  const prisma = { ...tx, $transaction: async (work: (client: any) => Promise<unknown>) => work(tx) };
  const auth = { createSession: (user: any) => ({ accessToken: 'jwt', user }) };
  const adapter = {
    authorizationUrl: (nextState: string, nextNonce: string) => {
      state = nextState;
      nonce = nextNonce;
      return `https://accounts.google.com/o/oauth2/v2/auth?state=${nextState}&nonce=${nextNonce}`;
    },
    exchangeCode: async () => 'id-token',
    verifyIdToken: async () => ({ ...profile, nonce: profile.nonce ?? nonce }),
  };
  return { users, identities, tx, capturedState: () => state, service: new GoogleAuthService(prisma as any, auth as any, adapter) };
}
```

- [ ] **Step 2: Run the Google test and confirm it fails**

Run:

```bash
node --test -r ts-node/register apps/api/test/google-auth.service.test.ts
```

Expected: FAIL because `GoogleAuthService` does not exist.

- [ ] **Step 3: Add shared cookie helpers**

Create `auth-cookie.util.ts`:

```ts
export const AUTH_COOKIE = 'wpcc_token';
export const GOOGLE_STATE_COOKIE = 'wpcc_google_state';

export function authCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge: 24 * 60 * 60 * 1000,
  };
}

export function googleStateCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/api/auth/google/callback',
    maxAge: 10 * 60 * 1000,
  };
}

export function readCookie(header: string | undefined, name: string): string | undefined {
  if (!header) return undefined;
  for (const part of header.split(';')) {
    const [key, ...value] = part.trim().split('=');
    if (key === name) {
      try { return decodeURIComponent(value.join('=')); } catch { return undefined; }
    }
  }
  return undefined;
}
```

Update `AuthGuard` to import and use `AUTH_COOKIE` plus `readCookie`; delete its private duplicate parser.

- [ ] **Step 4: Implement Google state, token verification, and linking**

Create `google-auth.service.ts` with these public contracts:

```ts
export interface GoogleProfile {
  sub: string;
  email: string;
  email_verified: boolean;
  name?: string;
  nonce?: string;
}

export interface GoogleAdapter {
  authorizationUrl(state: string, nonce: string): string;
  exchangeCode(code: string): Promise<string>;
  verifyIdToken(idToken: string): Promise<GoogleProfile>;
}

export const GOOGLE_ADAPTER = Symbol('GOOGLE_ADAPTER');

export interface GoogleAuthorization {
  url: string;
  signedCookie: string;
}
```

The production adapter is:

```ts
import { OAuth2Client } from 'google-auth-library';

class GoogleLibraryAdapter implements GoogleAdapter {
  private readonly client: OAuth2Client;
  constructor(private readonly config: GoogleAuthConfig) {
    this.client = new OAuth2Client(config.clientId, config.clientSecret, config.redirectUri);
  }
  authorizationUrl(state: string, nonce: string): string {
    const url = new URL(this.client.generateAuthUrl({ access_type: 'online', scope: ['openid', 'email', 'profile'], state, prompt: 'select_account' }));
    url.searchParams.set('nonce', nonce);
    return url.toString();
  }
  async exchangeCode(code: string): Promise<string> {
    const { tokens } = await this.client.getToken({ code, redirect_uri: this.config.redirectUri });
    if (!tokens.id_token) throw new Error('Google did not return an ID token');
    return tokens.id_token;
  }
  async verifyIdToken(idToken: string): Promise<GoogleProfile> {
    const ticket = await this.client.verifyIdToken({ idToken, audience: this.config.clientId });
    return ticket.getPayload() as GoogleProfile;
  }
}
```

`GoogleAuthService` must:

```ts
@Injectable()
export class GoogleAuthService {
  private readonly adapter: GoogleAdapter;
  constructor(
    private readonly prisma: PrismaService,
    private readonly authService: AuthService,
    @Optional() @Inject(GOOGLE_ADAPTER) adapter?: GoogleAdapter,
  ) {
    this.adapter = adapter ?? new GoogleLibraryAdapter(getGoogleAuthConfig());
  }

  createAuthorization(): GoogleAuthorization {
    const state = randomBytes(32).toString('base64url');
    const nonce = randomBytes(32).toString('base64url');
    const payload = Buffer.from(JSON.stringify({ state, nonce, exp: Date.now() + 10 * 60 * 1000 })).toString('base64url');
    const signature = createHmac('sha256', getJwtSecret()).update(payload).digest('base64url');
    return { url: this.adapter.authorizationUrl(state, nonce), signedCookie: `${payload}.${signature}` };
  }

  private verifyState(signedCookie: string | undefined, returnedState: string): string {
    if (!signedCookie) throw authError(HttpStatus.UNAUTHORIZED, 'GOOGLE_AUTH_FAILED', 'Google sign-in could not be verified');
    const [payload, signature] = signedCookie.split('.');
    const expected = createHmac('sha256', getJwtSecret()).update(payload || '').digest('base64url');
    const left = Buffer.from(signature || '');
    const right = Buffer.from(expected);
    if (left.length !== right.length || !timingSafeEqual(left, right)) throw authError(HttpStatus.UNAUTHORIZED, 'GOOGLE_AUTH_FAILED', 'Google sign-in could not be verified');
    const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as { state: string; nonce: string; exp: number };
    const expectedState = Buffer.from(decoded.state);
    const actualState = Buffer.from(returnedState);
    if (decoded.exp <= Date.now() || expectedState.length !== actualState.length || !timingSafeEqual(expectedState, actualState)) {
      throw authError(HttpStatus.UNAUTHORIZED, 'GOOGLE_AUTH_FAILED', 'Google sign-in could not be verified');
    }
    return decoded.nonce;
  }
}
```

Implement `completeAuthorization` in the same class. Resolve a `P2002` race only through the winning immutable Google identity; never silently move or replace an identity:

```ts
async completeAuthorization(code: string, state: string, signedCookie?: string) {
  let providerAccountId: string | undefined;
  try {
    const nonce = this.verifyState(signedCookie, state);
    const idToken = await this.adapter.exchangeCode(code);
    const profile = await this.adapter.verifyIdToken(idToken);
    if (!profile.sub || !profile.email || !profile.email_verified || profile.nonce !== nonce) {
      throw new Error('Google profile failed verification');
    }
    providerAccountId = profile.sub;
    const email = profile.email.trim().toLowerCase();
    const user = await this.prisma.$transaction(async (tx) => {
      const identity = await tx.authIdentity.findUnique({
        where: { provider_providerAccountId: { provider: AuthProvider.GOOGLE, providerAccountId: profile.sub } },
        include: { user: true },
      });
      if (identity) return identity.user;
      const existing = await tx.user.findUnique({ where: { email } });
      if (existing) {
        if (!existing.isActive) throw new Error('Inactive user');
        await tx.authIdentity.create({ data: { userId: existing.id, provider: AuthProvider.GOOGLE, providerAccountId: profile.sub } });
        return tx.user.update({ where: { id: existing.id }, data: { emailVerifiedAt: existing.emailVerifiedAt ?? new Date() } });
      }
      return tx.user.create({
        data: {
          email,
          passwordHash: null,
          emailVerifiedAt: new Date(),
          fullName: profile.name?.trim() || null,
          role: UserRole.ADMIN,
          authIdentities: { create: { provider: AuthProvider.GOOGLE, providerAccountId: profile.sub } },
        },
      });
    });
    if (!user.isActive) throw new Error('Inactive user');
    return this.authService.createSession(user);
  } catch (error) {
    if (error instanceof HttpException) throw error;
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002' && providerAccountId) {
      const winner = await this.prisma.authIdentity.findUnique({
        where: { provider_providerAccountId: { provider: AuthProvider.GOOGLE, providerAccountId } },
        include: { user: true },
      });
      if (winner?.user?.isActive) return this.authService.createSession(winner.user);
    }
    throw authError(HttpStatus.UNAUTHORIZED, 'GOOGLE_AUTH_FAILED', 'Google sign-in failed');
  }
}
```

Import `AuthProvider`, `Prisma`, `UserRole`, `HttpException`, `HttpStatus`, `Inject`, `Injectable`, `Optional`, `createHmac`, `randomBytes`, and `timingSafeEqual` exactly where used.

- [ ] **Step 5: Register GoogleAuthService**

Add `GoogleAuthService` to `AuthModule.providers`. Keep `MailModule` in imports.

- [ ] **Step 6: Run Google tests and API checks**

Run:

```bash
node --test -r ts-node/register apps/api/test/google-auth.service.test.ts
npm run test -w apps/api
npm run typecheck -w apps/api
```

Expected: Google tests and the full API suite PASS; typecheck PASS.

- [ ] **Step 7: Commit Google authentication**

```bash
git add apps/api/src/common/guards/auth.guard.ts apps/api/src/modules/auth/auth-cookie.util.ts apps/api/src/modules/auth/google-auth.service.ts apps/api/src/modules/auth/auth.module.ts apps/api/test/google-auth.service.test.ts
git commit -m "feat(auth): add Google account linking"
```

### Task 6: Expose the complete auth HTTP contract

**Files:**
- Modify: `apps/api/src/modules/auth/auth.controller.ts`
- Create: `apps/api/test/auth.controller.test.ts`

**Interfaces:**
- Consumes: `EmailVerificationService`, `GoogleAuthService`, `AuthService`, and cookie helpers.
- Produces: `/register`, `/verify-email`, `/resend-verification`, `/google/start`, and `/google/callback` plus unchanged login/logout/me/recovery endpoints.

- [ ] **Step 1: Write controller tests for cookie and redirect behavior**

Create `apps/api/test/auth.controller.test.ts` and directly instantiate the controller with fakes. Assert:

```ts
test('login and Google callback set the same secure session cookie contract', async () => {
  const cookies: any[] = [];
  const redirects: string[] = [];
  const response = {
    cookie: (...args: any[]) => cookies.push(args),
    clearCookie: () => undefined,
    redirect: (url: string) => redirects.push(url),
  } as any;
  const auth = { login: async () => ({ accessToken: 'jwt', user: { id: 'u1' } }) };
  const verification = { register: async () => ({}), verify: async () => ({}), resend: async () => ({}) };
  const google = {
    createAuthorization: () => ({ url: 'https://accounts.google.com/auth', signedCookie: 'signed' }),
    completeAuthorization: async () => ({ accessToken: 'google-jwt', user: { id: 'u1' } }),
  };
  const controller = new AuthController(auth as any, verification as any, google as any);
  await controller.login({ email: 'a@example.com', password: 'password' }, response);
  assert.equal(cookies[0][0], 'wpcc_token');
  await controller.googleCallback('code', 'state', undefined, { headers: { cookie: 'wpcc_google_state=signed' } } as any, response);
  assert.equal(cookies[1][0], 'wpcc_token');
  assert.equal(redirects[0], 'https://wpcc.example.com/sites');
});
```

Set `process.env.WEB_URL = 'https://wpcc.example.com'` within the test and restore it afterward.

- [ ] **Step 2: Run the controller test and verify it fails**

Run:

```bash
node --test -r ts-node/register apps/api/test/auth.controller.test.ts
```

Expected: FAIL because the constructor and Google endpoints are absent.

- [ ] **Step 3: Add registration and verification endpoints**

Inject all three services:

```ts
constructor(
  private readonly authService: AuthService,
  private readonly emailVerification: EmailVerificationService,
  private readonly googleAuth: GoogleAuthService,
) {}
```

Add these controller methods:

```ts
@Post('register')
@Throttle({ auth: { ttl: 60_000, limit: 5 } })
register(@Body() payload: RegisterDto) {
  return this.emailVerification.register(payload);
}

@Post('verify-email')
@Throttle({ auth: { ttl: 60_000, limit: 10 } })
verifyEmail(@Body() payload: VerifyEmailDto) {
  return this.emailVerification.verify(payload);
}

@Post('resend-verification')
@Throttle({ auth: { ttl: 60 * 60_000, limit: 3 } })
resendVerification(@Body() payload: ResendVerificationDto) {
  return this.emailVerification.resend(payload);
}
```

- [ ] **Step 4: Add Google redirects and clear state on every callback**

Add imports for `Query`, `Req`, `Request`, `getWebUrl`, and cookie helpers, then add:

```ts
@Get('google/start')
googleStart(@Res() res: Response) {
  const authorization = this.googleAuth.createAuthorization();
  res.cookie(GOOGLE_STATE_COOKIE, authorization.signedCookie, googleStateCookieOptions());
  return res.redirect(authorization.url);
}

@Get('google/callback')
async googleCallback(
  @Query('code') code: string | undefined,
  @Query('state') state: string | undefined,
  @Query('error') providerError: string | undefined,
  @Req() req: Request,
  @Res() res: Response,
) {
  const webUrl = getWebUrl();
  const failure = new URL('/', webUrl);
  failure.searchParams.set('mode', 'login');
  failure.searchParams.set('oauthError', 'GOOGLE_AUTH_FAILED');
  try {
    if (providerError || !code || !state) return res.redirect(failure.toString());
    const signedCookie = readCookie(req.headers.cookie, GOOGLE_STATE_COOKIE);
    const result = await this.googleAuth.completeAuthorization(code, state, signedCookie);
    res.cookie(AUTH_COOKIE, result.accessToken, authCookieOptions());
    return res.redirect(new URL('/sites', webUrl).toString());
  } catch {
    return res.redirect(failure.toString());
  } finally {
    res.clearCookie(GOOGLE_STATE_COOKIE, { ...googleStateCookieOptions(), maxAge: undefined });
  }
}
```

Replace controller-local auth cookie constants/options with imports from `auth-cookie.util.ts`.

- [ ] **Step 5: Run controller and full API verification**

Run:

```bash
node --test -r ts-node/register apps/api/test/auth.controller.test.ts
npm run test -w apps/api
npm run lint -w apps/api
npm run typecheck -w apps/api
npm run build -w apps/api
```

Expected: controller test and entire API suite PASS; lint, typecheck, and build PASS.

- [ ] **Step 6: Commit the HTTP contract**

```bash
git add apps/api/src/modules/auth/auth.controller.ts apps/api/test/auth.controller.test.ts
git commit -m "feat(auth): expose registration and Google endpoints"
```

### Task 7: Build the single-page authentication UI

**Files:**
- Create: `apps/web/lib/auth-api.ts`
- Create: `apps/web/components/auth/AuthMessage.tsx`
- Create: `apps/web/components/auth/GoogleAuthButton.tsx`
- Create: `apps/web/components/auth/LoginForm.tsx`
- Create: `apps/web/components/auth/SignUpForm.tsx`
- Create: `apps/web/components/auth/VerifyEmailForm.tsx`
- Create: `apps/web/components/auth/ForgotPasswordForm.tsx`
- Create: `apps/web/components/auth/ResetPasswordForm.tsx`
- Create: `apps/web/components/auth/AuthCard.tsx`
- Modify: `apps/web/app/page.tsx`
- Create: `apps/web/e2e/auth-ui.spec.ts`

**Interfaces:**
- Consumes: Task 6 API response/error codes and existing `API_URL`/Button/design tokens.
- Produces: a single `/` auth page with `login | signup | verify-email | forgot-password | reset-password` modes.

- [ ] **Step 1: Write Playwright tests against mocked auth APIs**

Create `apps/web/e2e/auth-ui.spec.ts`:

```ts
import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.route('**/api/auth/me', (route) => route.fulfill({ status: 401, json: { message: 'Unauthorized' } }));
});

test('switches between login, sign-up and lost-password modes', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
  await page.getByRole('tab', { name: 'Create account' }).click();
  await expect(page.getByLabel('Full name')).toBeVisible();
  await page.getByRole('tab', { name: 'Sign in' }).click();
  await page.getByRole('button', { name: 'Forgot password?' }).click();
  await expect(page.getByRole('heading', { name: 'Reset your password' })).toBeVisible();
});

test('registers, verifies six pasted digits and returns to login', async ({ page }) => {
  await page.route('**/api/auth/register', (route) => route.fulfill({ status: 201, json: { verificationRequired: true, email: 'j***@example.com', resendAvailableInSeconds: 60 } }));
  await page.route('**/api/auth/verify-email', (route) => route.fulfill({ status: 200, json: { success: true, email: 'jane@example.com' } }));
  await page.goto('/');
  await page.getByRole('tab', { name: 'Create account' }).click();
  await page.getByLabel('Full name').fill('Jane Doe');
  await page.getByLabel('Email').fill('jane@example.com');
  await page.getByLabel('Password', { exact: true }).fill('StrongPass123!');
  await page.getByLabel('Confirm password').fill('StrongPass123!');
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page.getByRole('heading', { name: 'Verify your email' })).toBeVisible();
  await page.getByLabel('Verification code').fill('482913');
  await page.getByRole('button', { name: 'Verify email' }).click();
  await expect(page.getByText('Email verified. Sign in to continue.')).toBeVisible();
});

test('opens reset mode from a trusted query token', async ({ page }) => {
  await page.goto('/?mode=reset-password&token=raw-token');
  await expect(page.getByRole('heading', { name: 'Choose a new password' })).toBeVisible();
});
```

- [ ] **Step 2: Run the UI suite and confirm the new experience is absent**

Run:

```bash
npm run test:e2e -w apps/web -- e2e/auth-ui.spec.ts --project=chromium
```

Expected: FAIL because the tabs and new forms do not exist.

- [ ] **Step 3: Add the typed auth API client**

Create `apps/web/lib/auth-api.ts`:

```ts
import { API_URL } from './api';

export class AuthApiError extends Error {
  constructor(public readonly code: string, message: string, public readonly retryAfterSeconds?: number) {
    super(message);
  }
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new AuthApiError(data.code || 'AUTH_REQUEST_FAILED', data.message || 'Request failed', data.retryAfterSeconds);
  return data as T;
}

export const authApi = {
  login: (email: string, password: string) => post<{ user: { id: string; email: string } }>('/auth/login', { email: email.trim().toLowerCase(), password }),
  register: (fullName: string, email: string, password: string) => post<{ verificationRequired: true; email: string; resendAvailableInSeconds: number }>('/auth/register', { fullName: fullName.trim(), email: email.trim().toLowerCase(), password }),
  verifyEmail: (email: string, code: string) => post<{ success: true; email: string }>('/auth/verify-email', { email: email.trim().toLowerCase(), code }),
  resendVerification: (email: string) => post<{ success: true; resendAvailableInSeconds: number }>('/auth/resend-verification', { email: email.trim().toLowerCase() }),
  forgotPassword: (email: string) => post<{ success: true; message: string }>('/auth/forgot-password', { email: email.trim().toLowerCase() }),
  resetPassword: (token: string, password: string) => post<{ success: true; message: string }>('/auth/reset-password', { token, password }),
};

export const googleStartUrl = `${API_URL}/auth/google/start`;
```

- [ ] **Step 4: Add shared message and Google controls**

Create `AuthMessage.tsx`:

```tsx
export function AuthMessage({ kind, children }: { kind: 'error' | 'success'; children?: React.ReactNode }) {
  if (!children) return null;
  return (
    <div role={kind === 'error' ? 'alert' : 'status'} className={kind === 'error' ? 'rounded-lg border border-red-900/50 bg-red-950/40 p-3 text-sm text-red-300' : 'rounded-lg border border-emerald-900/50 bg-emerald-950/40 p-3 text-sm text-emerald-300'}>
      {children}
    </div>
  );
}
```

Create `GoogleAuthButton.tsx`:

```tsx
import { googleStartUrl } from '@/lib/auth-api';

export function GoogleAuthButton() {
  return <a href={googleStartUrl} className="flex min-h-11 w-full items-center justify-center rounded-lg border border-zinc-700 bg-zinc-950 px-4 text-sm font-semibold text-zinc-100 transition hover:border-zinc-600 hover:bg-zinc-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500">Continue with Google</a>;
}
```

- [ ] **Step 5: Implement the five focused forms**

Create `LoginForm.tsx`:

```tsx
"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { authApi, AuthApiError } from "@/lib/auth-api";
import { AuthMessage } from "./AuthMessage";
import { GoogleAuthButton } from "./GoogleAuthButton";

export interface LoginFormProps {
  initialEmail: string;
  onNeedsVerification(email: string): void;
  onForgotPassword(email: string): void;
}

export function LoginForm({ initialEmail, onNeedsVerification, onForgotPassword }: LoginFormProps) {
  const router = useRouter();
  const [email, setEmail] = useState(initialEmail);
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setLoading(true);
    try { await authApi.login(email, password); router.push("/sites"); }
    catch (caught) {
      if (caught instanceof AuthApiError && caught.code === "EMAIL_NOT_VERIFIED") { onNeedsVerification(email.trim().toLowerCase()); return; }
      setError(caught instanceof Error ? caught.message : "Something went wrong. Please try again.");
    } finally { setLoading(false); }
  }
  return <form onSubmit={submit} className="space-y-4">
    <GoogleAuthButton />
    <div className="flex items-center gap-3 text-xs text-zinc-500"><span className="h-px flex-1 bg-zinc-800" /><span>or</span><span className="h-px flex-1 bg-zinc-800" /></div>
    <AuthMessage kind="error">{error}</AuthMessage>
    <label className="block text-sm text-zinc-300" htmlFor="login-email">Email<input id="login-email" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} className="mt-2 min-h-11 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 outline-none focus:border-violet-500" /></label>
    <label className="block text-sm text-zinc-300" htmlFor="login-password">Password<input id="login-password" type="password" autoComplete="current-password" minLength={8} required value={password} onChange={(event) => setPassword(event.target.value)} className="mt-2 min-h-11 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 outline-none focus:border-violet-500" /></label>
    <button type="button" onClick={() => onForgotPassword(email)} className="min-h-11 text-sm text-violet-300 hover:text-violet-200">Forgot password?</button>
    <Button type="submit" disabled={loading} className="min-h-11 w-full bg-gradient-to-r from-violet-600 to-indigo-600">{loading ? "Signing in..." : "Sign in"}</Button>
  </form>;
}
```

Create `SignUpForm.tsx`:

```tsx
"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { authApi, AuthApiError } from "@/lib/auth-api";
import { AuthMessage } from "./AuthMessage";
import { GoogleAuthButton } from "./GoogleAuthButton";

export interface SignUpFormProps { onRegistered(email: string, maskedEmail: string, cooldown: number): void; }
export function SignUpForm({ onRegistered }: SignUpFormProps) {
  const [fullName, setFullName] = useState(""); const [email, setEmail] = useState("");
  const [password, setPassword] = useState(""); const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false); const [error, setError] = useState("");
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError("");
    if (password !== confirmPassword) { setError("Passwords do not match."); return; }
    setLoading(true);
    try {
      const result = await authApi.register(fullName, email, password);
      onRegistered(email.trim().toLowerCase(), result.email, result.resendAvailableInSeconds);
    } catch (caught) {
      if (caught instanceof AuthApiError && caught.code === "EMAIL_VERIFICATION_PENDING") { onRegistered(email.trim().toLowerCase(), email.trim().toLowerCase(), 0); return; }
      setError(caught instanceof Error ? caught.message : "Something went wrong. Please try again.");
    } finally { setLoading(false); }
  }
  const inputClass = "mt-2 min-h-11 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 outline-none focus:border-violet-500";
  return <form onSubmit={submit} className="space-y-4">
    <GoogleAuthButton /><div className="flex items-center gap-3 text-xs text-zinc-500"><span className="h-px flex-1 bg-zinc-800" /><span>or</span><span className="h-px flex-1 bg-zinc-800" /></div>
    <AuthMessage kind="error">{error}</AuthMessage>
    <label className="block text-sm text-zinc-300" htmlFor="signup-name">Full name<input id="signup-name" autoComplete="name" minLength={2} required value={fullName} onChange={(event) => setFullName(event.target.value)} className={inputClass} /></label>
    <label className="block text-sm text-zinc-300" htmlFor="signup-email">Email<input id="signup-email" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} className={inputClass} /></label>
    <label className="block text-sm text-zinc-300" htmlFor="signup-password">Password<input id="signup-password" type="password" autoComplete="new-password" minLength={8} required value={password} onChange={(event) => setPassword(event.target.value)} className={inputClass} /></label>
    <label className="block text-sm text-zinc-300" htmlFor="signup-confirm">Confirm password<input id="signup-confirm" type="password" autoComplete="new-password" minLength={8} required value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} className={inputClass} /></label>
    <Button type="submit" disabled={loading} className="min-h-11 w-full bg-gradient-to-r from-violet-600 to-indigo-600">{loading ? "Creating account..." : "Create account"}</Button>
  </form>;
}
```

Create `VerifyEmailForm.tsx`:

```tsx
"use client";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { authApi, AuthApiError } from "@/lib/auth-api";
import { AuthMessage } from "./AuthMessage";

export interface VerifyEmailFormProps { email: string; maskedEmail: string; initialCooldown: number; onVerified(email: string): void; onBack(): void; }
export function VerifyEmailForm({ email, maskedEmail, initialCooldown, onVerified, onBack }: VerifyEmailFormProps) {
  const [code, setCode] = useState(""); const [cooldown, setCooldown] = useState(initialCooldown);
  const [loading, setLoading] = useState(false); const [error, setError] = useState("");
  useEffect(() => { if (cooldown <= 0) return; const timer = window.setInterval(() => setCooldown((value) => Math.max(0, value - 1)), 1000); return () => window.clearInterval(timer); }, [cooldown]);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setLoading(true);
    try { const result = await authApi.verifyEmail(email, code); onVerified(result.email); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Verification failed."); }
    finally { setLoading(false); }
  }
  async function resend() {
    setError("");
    try { const result = await authApi.resendVerification(email); setCooldown(result.resendAvailableInSeconds); }
    catch (caught) { if (caught instanceof AuthApiError && caught.retryAfterSeconds) setCooldown(caught.retryAfterSeconds); setError(caught instanceof Error ? caught.message : "Could not resend the code."); }
  }
  return <form onSubmit={submit} className="space-y-4">
    <p className="text-sm text-zinc-400">Enter the code sent to {maskedEmail}.</p><AuthMessage kind="error">{error}</AuthMessage>
    <label className="block text-sm text-zinc-300" htmlFor="verification-code">Verification code<input id="verification-code" aria-label="Verification code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} pattern="[0-9]{6}" required value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))} className="mt-2 min-h-12 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 text-center text-2xl tracking-[0.5em] outline-none focus:border-violet-500" /></label>
    <Button type="submit" disabled={loading || code.length !== 6} className="min-h-11 w-full bg-gradient-to-r from-violet-600 to-indigo-600">{loading ? "Verifying..." : "Verify email"}</Button>
    <div className="flex justify-between text-sm"><button type="button" onClick={onBack} className="min-h-11 text-zinc-400">Back to sign in</button><button type="button" disabled={cooldown > 0} onClick={resend} className="min-h-11 text-violet-300 disabled:text-zinc-600">{cooldown > 0 ? `Resend in ${cooldown}s` : "Resend code"}</button></div>
  </form>;
}
```

Create `ForgotPasswordForm.tsx`:

```tsx
"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { authApi } from "@/lib/auth-api";
import { AuthMessage } from "./AuthMessage";
export interface ForgotPasswordFormProps { initialEmail: string; onBack(email: string): void; }
export function ForgotPasswordForm({ initialEmail, onBack }: ForgotPasswordFormProps) {
  const [email, setEmail] = useState(initialEmail); const [loading, setLoading] = useState(false);
  const [error, setError] = useState(""); const [success, setSuccess] = useState("");
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setLoading(true);
    try { const result = await authApi.forgotPassword(email); setSuccess(result.message); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Request failed."); }
    finally { setLoading(false); }
  }
  return <form onSubmit={submit} className="space-y-4"><AuthMessage kind="error">{error}</AuthMessage><AuthMessage kind="success">{success}</AuthMessage><label className="block text-sm text-zinc-300" htmlFor="forgot-email">Email<input id="forgot-email" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} className="mt-2 min-h-11 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 outline-none focus:border-violet-500" /></label><Button type="submit" disabled={loading} className="min-h-11 w-full bg-gradient-to-r from-violet-600 to-indigo-600">{loading ? "Sending..." : "Send reset link"}</Button><button type="button" onClick={() => onBack(email)} className="min-h-11 text-sm text-zinc-400">Back to sign in</button></form>;
}
```

Create `ResetPasswordForm.tsx`:

```tsx
"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { authApi, AuthApiError } from "@/lib/auth-api";
import { AuthMessage } from "./AuthMessage";
export interface ResetPasswordFormProps { token: string; onComplete(): void; onInvalid(): void; }
export function ResetPasswordForm({ token, onComplete, onInvalid }: ResetPasswordFormProps) {
  const [password, setPassword] = useState(""); const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false); const [error, setError] = useState("");
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError("");
    if (password.length < 8) { setError("Password must be at least 8 characters."); return; }
    if (password !== confirmPassword) { setError("Passwords do not match."); return; }
    setLoading(true);
    try { await authApi.resetPassword(token, password); onComplete(); }
    catch (caught) { if (caught instanceof AuthApiError && ["RESET_TOKEN_INVALID", "RESET_TOKEN_EXPIRED", "RESET_TOKEN_USED"].includes(caught.code)) { onInvalid(); return; } setError(caught instanceof Error ? caught.message : "Reset failed."); }
    finally { setLoading(false); }
  }
  const inputClass = "mt-2 min-h-11 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 outline-none focus:border-violet-500";
  return <form onSubmit={submit} className="space-y-4"><AuthMessage kind="error">{error}</AuthMessage><label className="block text-sm text-zinc-300" htmlFor="reset-password">New password<input id="reset-password" type="password" autoComplete="new-password" required minLength={8} value={password} onChange={(event) => setPassword(event.target.value)} className={inputClass} /></label><label className="block text-sm text-zinc-300" htmlFor="reset-confirm">Confirm password<input id="reset-confirm" type="password" autoComplete="new-password" required minLength={8} value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} className={inputClass} /></label><Button type="submit" disabled={loading} className="min-h-11 w-full bg-gradient-to-r from-violet-600 to-indigo-600">{loading ? "Resetting..." : "Reset password"}</Button></form>;
}
```

- [ ] **Step 6: Implement AuthCard mode orchestration**

Create `AuthCard.tsx`:

```tsx
"use client";
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { API_URL } from "@/lib/api";
import { AuthMessage } from "./AuthMessage";
import { LoginForm } from "./LoginForm";
import { SignUpForm } from "./SignUpForm";
import { VerifyEmailForm } from "./VerifyEmailForm";
import { ForgotPasswordForm } from "./ForgotPasswordForm";
import { ResetPasswordForm } from "./ResetPasswordForm";

type AuthMode = "login" | "signup" | "verify-email" | "forgot-password" | "reset-password";
export function AuthCard() {
  const router = useRouter(); const searchParams = useSearchParams();
  const resetToken = searchParams.get("token") || "";
  const initialMode: AuthMode = searchParams.get("mode") === "reset-password" && resetToken ? "reset-password" : "login";
  const oauthError = searchParams.get("oauthError") === "GOOGLE_AUTH_FAILED" ? "Google sign-in failed. Please try again." : "";
  const [mode, setMode] = useState<AuthMode>(initialMode); const [email, setEmail] = useState("");
  const [maskedEmail, setMaskedEmail] = useState(""); const [cooldown, setCooldown] = useState(0); const [success, setSuccess] = useState("");
  useEffect(() => { fetch(`${API_URL}/auth/me`, { credentials: "include" }).then((response) => { if (response.ok) router.push("/sites"); }).catch(() => undefined); }, [router]);
  useEffect(() => { if (oauthError) window.history.replaceState({}, "", "/"); }, [oauthError]);
  const title = mode === "login" ? "Welcome back" : mode === "signup" ? "Create your account" : mode === "verify-email" ? "Verify your email" : mode === "forgot-password" ? "Reset your password" : "Choose a new password";
  return <main className="relative flex min-h-svh items-center justify-center overflow-hidden bg-zinc-950 px-4 py-8 text-zinc-200"><div className="absolute -left-40 -top-40 h-96 w-96 rounded-full bg-violet-600/20 blur-[128px]" /><div className="absolute -bottom-40 -right-40 h-96 w-96 rounded-full bg-emerald-600/20 blur-[128px]" /><section className="relative w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-900/70 p-6 shadow-2xl backdrop-blur-xl sm:p-8"><header className="mb-6 text-center"><p className="bg-gradient-to-r from-violet-400 via-fuchsia-400 to-emerald-400 bg-clip-text text-2xl font-bold text-transparent">WP Control Center</p><h1 className="mt-3 text-xl font-semibold">{title}</h1></header>{(mode === "login" || mode === "signup") && <div role="tablist" className="mb-6 grid grid-cols-2 rounded-lg bg-zinc-950 p-1"><button role="tab" aria-selected={mode === "login"} onClick={() => setMode("login")} className={`min-h-11 rounded-md text-sm ${mode === "login" ? "bg-zinc-800 text-white" : "text-zinc-400"}`}>Sign in</button><button role="tab" aria-selected={mode === "signup"} onClick={() => setMode("signup")} className={`min-h-11 rounded-md text-sm ${mode === "signup" ? "bg-zinc-800 text-white" : "text-zinc-400"}`}>Create account</button></div>}<div className="mb-4 space-y-3"><AuthMessage kind="error">{oauthError}</AuthMessage><AuthMessage kind="success">{success}</AuthMessage></div>{mode === "login" && <LoginForm initialEmail={email} onNeedsVerification={(nextEmail) => { setEmail(nextEmail); setMaskedEmail(nextEmail); setCooldown(0); setMode("verify-email"); }} onForgotPassword={(nextEmail) => { setEmail(nextEmail); setMode("forgot-password"); }} />}{mode === "signup" && <SignUpForm onRegistered={(nextEmail, masked, seconds) => { setEmail(nextEmail); setMaskedEmail(masked); setCooldown(seconds); setMode("verify-email"); }} />}{mode === "verify-email" && <VerifyEmailForm email={email} maskedEmail={maskedEmail} initialCooldown={cooldown} onVerified={(nextEmail) => { setEmail(nextEmail); setSuccess("Email verified. Sign in to continue."); setMode("login"); }} onBack={() => setMode("login")} />}{mode === "forgot-password" && <ForgotPasswordForm initialEmail={email} onBack={(nextEmail) => { setEmail(nextEmail); setMode("login"); }} />}{mode === "reset-password" && <ResetPasswordForm token={resetToken} onComplete={() => { setSuccess("Password reset. Sign in with your new password."); setMode("login"); window.history.replaceState({}, "", "/"); }} onInvalid={() => { setMode("forgot-password"); window.history.replaceState({}, "", "/"); }} />}</section></main>;
}
```

- [ ] **Step 7: Make the App Router page a thin Server Component**

Replace `apps/web/app/page.tsx` with:

```tsx
import { Suspense } from 'react';
import { AuthCard } from '@/components/auth/AuthCard';

export default function AuthPage() {
  return (
    <Suspense fallback={<div className="min-h-svh bg-zinc-950" />}>
      <AuthCard />
    </Suspense>
  );
}
```

- [ ] **Step 8: Run web tests and static checks**

Run:

```bash
npm run test:e2e -w apps/web -- e2e/auth-ui.spec.ts --project=chromium
npm run lint -w apps/web
npm run typecheck -w apps/web
npm run build -w apps/web
```

Expected: auth UI tests PASS; lint, typecheck, and Next build PASS without a `useSearchParams` prerender error.

- [ ] **Step 9: Commit the auth UI**

```bash
git add apps/web/app/page.tsx apps/web/components/auth apps/web/lib/auth-api.ts apps/web/e2e/auth-ui.spec.ts
git commit -m "feat(auth): build unified authentication page"
```

### Task 8: Wire production configuration and prove the complete flow

**Files:**
- Modify: `.env.ci.example`
- Modify: `.env.compose`
- Modify: `docker-compose.prod.yml`
- Modify: `apps/web/e2e/login.spec.ts`

**Interfaces:**
- Consumes: all Tasks 1–7.
- Produces: documented deploy inputs, production Compose wiring, full browser regression, and release evidence.

- [ ] **Step 1: Update deploy examples before runtime verification**

Add to `.env.ci.example` with non-secret placeholders:

```dotenv
WEB_URL=http://localhost
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=CHANGE_ME
SMTP_PASSWORD=CHANGE_ME
MAIL_FROM=WP Control Center <no-reply@example.com>
GOOGLE_CLIENT_ID=CHANGE_ME.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=CHANGE_ME
GOOGLE_AUTH_REDIRECT_URI=http://localhost/api/auth/google/callback
```

Add these explicit non-secret development placeholders to `.env.compose`; the operator replaces them through an untracked env file before testing SMTP/Google:

```dotenv
WEB_URL=http://localhost
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=CHANGE_ME
SMTP_PASSWORD=CHANGE_ME
MAIL_FROM=WP Control Center <no-reply@example.com>
GOOGLE_CLIENT_ID=CHANGE_ME.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=CHANGE_ME
GOOGLE_AUTH_REDIRECT_URI=http://localhost/api/auth/google/callback
```

Pass every value into the `api.environment` block in `docker-compose.prod.yml`:

```yaml
WEB_URL: ${WEB_URL:?WEB_URL is required}
SMTP_HOST: ${SMTP_HOST:?SMTP_HOST is required}
SMTP_PORT: ${SMTP_PORT:-587}
SMTP_SECURE: ${SMTP_SECURE:-false}
SMTP_USER: ${SMTP_USER:?SMTP_USER is required}
SMTP_PASSWORD: ${SMTP_PASSWORD:?SMTP_PASSWORD is required}
MAIL_FROM: ${MAIL_FROM:?MAIL_FROM is required}
GOOGLE_CLIENT_ID: ${GOOGLE_CLIENT_ID:?GOOGLE_CLIENT_ID is required}
GOOGLE_CLIENT_SECRET: ${GOOGLE_CLIENT_SECRET:?GOOGLE_CLIENT_SECRET is required}
GOOGLE_AUTH_REDIRECT_URI: ${GOOGLE_AUTH_REDIRECT_URI:?GOOGLE_AUTH_REDIRECT_URI is required}
```

- [ ] **Step 2: Replace the brittle seeded-password E2E test with an isolated auth flow**

Update `apps/web/e2e/login.spec.ts` to read `E2E_ADMIN_EMAIL` and `E2E_ADMIN_PASSWORD` from environment and skip only the live-login case when they are absent:

```ts
import { test, expect } from '@playwright/test';

test('keeps the auth page visible after an empty submit', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL('/');
  await expect(page.getByLabel('Email')).toBeVisible();
});

test('signs in with configured verified admin credentials', async ({ page }) => {
  const email = process.env.E2E_ADMIN_EMAIL;
  const password = process.env.E2E_ADMIN_PASSWORD;
  test.skip(!email || !password, 'Set E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD for live auth');
  await page.goto('/');
  await page.getByLabel('Email').fill(email!);
  await page.getByLabel('Password').fill(password!);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL('/sites');
});
```

- [ ] **Step 3: Verify the migration against a disposable PostgreSQL database**

Run with a disposable database URL, never the production database:

```bash
DATABASE_URL="$TEST_DATABASE_URL" npm run migrate:deploy -w packages/database
DATABASE_URL="$TEST_DATABASE_URL" npm run seed -w packages/database
DATABASE_URL="$TEST_DATABASE_URL" npm run migrate:deploy -w packages/database
psql "$TEST_DATABASE_URL" -Atc "SELECT email_verified_at IS NOT NULL FROM users WHERE email = 'admin@example.com';"
```

Expected: first deploy applies the auth migration; seed succeeds; second deploy reports no pending migrations; the final query prints `t`.

- [ ] **Step 4: Run the full repository verification stack**

Run:

```bash
npm run test -w packages/database
npm run test -w apps/api
npm run lint -w apps/api
npm run typecheck -w apps/api
npm run lint -w apps/web
npm run typecheck -w apps/web
npm run test:e2e -w apps/web -- e2e/auth-ui.spec.ts --project=chromium
npm run build:all
```

Expected: all tests, lint, typechecks, auth Playwright tests, and workspace builds PASS.

- [ ] **Step 5: Perform the live smoke checklist**

With PostgreSQL, API, web, and a test SMTP inbox running:

1. Register a unique email and confirm the database stores a password hash plus null `email_verified_at`.
2. Confirm the email contains a six-digit code but logs/database do not.
3. Confirm wrong OTP increments attempts; correct OTP verifies; the code cannot be reused.
4. Sign in and confirm the browser receives `wpcc_token` as httpOnly and reaches `/sites`.
5. Request password reset, consume the SMTP link, then confirm the old password/session fails and the new password works.
6. Start Google sign-in, complete consent, and confirm a verified ADMIN user or identity link is created without Google tokens in the database.
7. Repeat Google sign-in and confirm user/identity counts do not increase.
8. Log out and confirm `/api/auth/me` returns 401.

Expected: all eight checks pass with no credential/token material in logs.

- [ ] **Step 6: Commit deploy wiring and regression coverage**

```bash
git add .env.ci.example .env.compose docker-compose.prod.yml apps/web/e2e/login.spec.ts
git commit -m "test(auth): verify production authentication flow"
```

- [ ] **Step 7: Record final evidence**

Run:

```bash
git status --short
git log -8 --oneline
```

Expected: only the user's pre-existing `apps/api/tsconfig.json` modification remains unstaged, and the authentication work appears as focused commits in task order.
