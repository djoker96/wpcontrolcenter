import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AuthService } from '../src/modules/auth/auth.service';
import { hashPassword } from '../src/common/utils/crypto.utils';

function createAuthFixture() {
  const user: any = {
    id: 'user_1',
    email: 'admin@example.com',
    role: 'SUPER_ADMIN',
    fullName: 'System Administrator',
    isActive: true,
    emailVerifiedAt: new Date(),
    tokenVersion: 0,
    passwordHash: hashPassword('OldPass123!'),
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
      create: async ({ data }: any) => {
        const token = { id: `reset_${resetTokens.length + 1}`, usedAt: null, ...data };
        resetTokens.push(token);
        return token;
      },
      findUnique: async ({ where, include }: any) => {
        const token = resetTokens.find((candidate) => candidate.tokenHash === where.tokenHash);
        return token && include?.user ? { ...token, user } : token ?? null;
      },
      update: async ({ where, data }: any) => {
        const token = resetTokens.find((candidate) => candidate.id === where.id);
        Object.assign(token, data);
        return token;
      },
    },
    $transaction: async (operations: Array<Promise<unknown>>) => Promise.all(operations),
  };
  const mail = {
    sendPasswordResetLink: async (email: string, token: string) => sentResetTokens.push({ email, token }),
  };
  return { user, resetTokens, sentResetTokens, service: new AuthService(prisma, mail as any) };
}

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

test('forgotPassword creates a reset token that resetPassword can consume once', async () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalJwtSecret = process.env.JWT_SECRET;
  process.env.NODE_ENV = 'development';
  process.env.JWT_SECRET = 'test-jwt-secret-at-least-32-characters';

  try {
    const { service, user, sentResetTokens, resetTokens } = createAuthFixture();
    const forgotResult = await service.forgotPassword({ email: user.email } as any) as any;

    assert.deepEqual(forgotResult, {
      success: true,
      message: 'If an account exists for that email, a password reset link has been sent',
    });
    assert.equal(sentResetTokens.length, 1);
    assert.equal(resetTokens.length, 1);

    const resetResult = await service.resetPassword({
      token: sentResetTokens[0].token,
      password: 'NewPass123!',
    } as any);

    assert.deepEqual(resetResult, {
      success: true,
      message: 'Password has been reset successfully',
    });
    assert.equal(resetTokens[0].usedAt instanceof Date, true);

    await assert.rejects(() => service.resetPassword({
      token: sentResetTokens[0].token,
      password: 'AnotherPass123!',
    } as any));
    await assert.rejects(() => service.login({ email: user.email, password: 'OldPass123!' }));

    const loginResult = await service.login({ email: user.email, password: 'NewPass123!' });
    assert.equal(loginResult.user.email, user.email);
    assert.equal(typeof loginResult.accessToken, 'string');
  } finally {
    process.env.NODE_ENV = originalNodeEnv;
    process.env.JWT_SECRET = originalJwtSecret;
  }
});
