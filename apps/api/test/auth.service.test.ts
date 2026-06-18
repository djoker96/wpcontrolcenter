import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AuthService } from '../src/modules/auth/auth.service';
import { hashPassword } from '../src/common/utils/crypto.utils';

test('forgotPassword creates a development reset token that resetPassword can consume once', async () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalJwtSecret = process.env.JWT_SECRET;
  process.env.NODE_ENV = 'development';
  process.env.JWT_SECRET = 'test-jwt-secret';

  const user = {
    id: 'user_1',
    email: 'admin@example.com',
    role: 'SUPER_ADMIN',
    fullName: 'System Administrator',
    isActive: true,
    passwordHash: hashPassword('OldPass123!'),
  };
  const resetTokens: any[] = [];

  const prisma = {
    user: {
      findUnique: async ({ where }: any) => (where.email === user.email || where.id === user.id ? user : null),
      update: async ({ where, data }: any) => {
        assert.equal(where.id, user.id);
        Object.assign(user, data);
        return user;
      },
    },
    passwordResetToken: {
      create: async ({ data }: any) => {
        const token = { id: `reset_${resetTokens.length + 1}`, ...data, usedAt: null };
        resetTokens.push(token);
        return token;
      },
      findUnique: async ({ where, include }: any) => {
        const token = resetTokens.find((candidate) => candidate.tokenHash === where.tokenHash);
        if (!token) return null;
        return include?.user ? { ...token, user } : token;
      },
      update: async ({ where, data }: any) => {
        const token = resetTokens.find((candidate) => candidate.id === where.id);
        assert.ok(token);
        Object.assign(token, data);
        return token;
      },
    },
    $transaction: async (operations: Array<Promise<unknown>>) => Promise.all(operations),
  };

  try {
    const service = new AuthService(prisma as any);
    const forgotResult = await service.forgotPassword({ email: user.email } as any) as any;

    assert.equal(forgotResult.success, true);
    assert.equal(typeof forgotResult.resetToken, 'string');
    assert.equal(resetTokens.length, 1);

    const resetResult = await service.resetPassword({
      token: forgotResult.resetToken,
      password: 'NewPass123!',
    } as any);

    assert.deepEqual(resetResult, {
      success: true,
      message: 'Password has been reset successfully',
    });
    assert.equal(resetTokens[0].usedAt instanceof Date, true);

    await assert.rejects(() => service.resetPassword({
      token: forgotResult.resetToken,
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
