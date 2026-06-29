import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AuthController } from '../src/modules/auth/auth.controller';

test('login writes the session cookie with a platform-agnostic Set-Cookie header', async () => {
  const originalCookieSecure = process.env.COOKIE_SECURE;
  process.env.COOKIE_SECURE = 'false';
  const headers: Record<string, string> = {};
  const reply = {
    header: (name: string, value: string) => {
      headers[name.toLowerCase()] = value;
      return reply;
    },
  };
  const authService = {
    login: async () => ({
      accessToken: 'jwt-token',
      user: { id: 'user_1', email: 'admin@example.com', role: 'SUPER_ADMIN', fullName: 'Admin' },
    }),
  };

  try {
    const controller = new AuthController(authService as any);
    const result = await controller.login({ email: 'admin@example.com', password: 'ChangeMe123!' } as any, reply as any);

    assert.deepEqual(result, {
      user: { id: 'user_1', email: 'admin@example.com', role: 'SUPER_ADMIN', fullName: 'Admin' },
    });
    assert.match(headers['set-cookie'], /^wpcc_token=jwt-token;/);
    assert.match(headers['set-cookie'], /HttpOnly/);
    assert.match(headers['set-cookie'], /SameSite=Lax/);
    assert.doesNotMatch(headers['set-cookie'], /Secure/);
  } finally {
    process.env.COOKIE_SECURE = originalCookieSecure;
  }
});

test('logout expires the session cookie with a platform-agnostic Set-Cookie header', () => {
  const headers: Record<string, string> = {};
  const reply = {
    header: (name: string, value: string) => {
      headers[name.toLowerCase()] = value;
      return reply;
    },
  };
  const authService = {};
  const controller = new AuthController(authService as any);

  const result = controller.logout(reply as any);

  assert.deepEqual(result, { success: true });
  assert.match(headers['set-cookie'], /^wpcc_token=;/);
  assert.match(headers['set-cookie'], /Max-Age=0/);
  assert.match(headers['set-cookie'], /HttpOnly/);
});
