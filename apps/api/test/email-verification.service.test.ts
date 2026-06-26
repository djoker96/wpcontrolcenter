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
  return {
    users,
    codes,
    sent,
    advance: (milliseconds: number) => { now = new Date(now.getTime() + milliseconds); },
    service: new EmailVerificationService(prisma, mail as any, () => now),
  };
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
