import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AuthController } from '../src/modules/auth/auth.controller';

function withWebUrl<T>(run: () => Promise<T>): Promise<T> {
  const originalWebUrl = process.env.WEB_URL;
  process.env.WEB_URL = 'https://wpcc.example.com';
  return run().finally(() => {
    process.env.WEB_URL = originalWebUrl;
  });
}

function createControllerFixture() {
  const cookies: any[] = [];
  const clearedCookies: any[] = [];
  const redirects: string[] = [];
  const delegated: Array<[string, unknown]> = [];
  const response = {
    cookie: (...args: any[]) => cookies.push(args),
    clearCookie: (...args: any[]) => clearedCookies.push(args),
    redirect: (url: string) => redirects.push(url),
  } as any;
  const auth = {
    login: async () => ({ accessToken: 'jwt', user: { id: 'u1' } }),
  };
  const verification = {
    register: async (payload: unknown) => {
      delegated.push(['register', payload]);
      return { success: true };
    },
    verify: async (payload: unknown) => {
      delegated.push(['verify', payload]);
      return { success: true };
    },
    resend: async (payload: unknown) => {
      delegated.push(['resend', payload]);
      return { success: true };
    },
  };
  const google = {
    createAuthorization: () => ({ url: 'https://accounts.google.com/auth', signedCookie: 'signed' }),
    completeAuthorization: async () => ({ accessToken: 'google-jwt', user: { id: 'u1' } }),
  };
  const controller = new AuthController(auth as any, verification as any, google as any);
  return { controller, cookies, clearedCookies, delegated, redirects, response };
}

test('login and Google callback set the same secure session cookie contract', async () => {
  await withWebUrl(async () => {
    const { controller, cookies, clearedCookies, redirects, response } = createControllerFixture();

    const loginResult = await controller.login({ email: 'a@example.com', password: 'password' }, response);
    assert.equal(cookies[0][0], 'wpcc_token');
    assert.deepEqual(loginResult, { user: { id: 'u1' } });
    assert.equal('accessToken' in loginResult, false);

    await controller.googleCallback(
      'code',
      'state',
      undefined,
      { headers: { cookie: 'wpcc_google_state=signed' } } as any,
      response,
    );

    assert.equal(cookies[1][0], 'wpcc_token');
    assert.deepEqual(cookies[1][2], cookies[0][2]);
    assert.equal(clearedCookies[0][0], 'wpcc_google_state');
    assert.equal(redirects[0], 'https://wpcc.example.com/sites');
  });
});

test('Google start stores state cookie and redirects to provider', () => {
  const { controller, cookies, redirects, response } = createControllerFixture();

  controller.googleStart(response);

  assert.equal(cookies[0][0], 'wpcc_google_state');
  assert.equal(cookies[0][1], 'signed');
  assert.equal(redirects[0], 'https://accounts.google.com/auth');
});

test('Google callback clears state cookie on provider failure', async () => {
  await withWebUrl(async () => {
    const { controller, clearedCookies, redirects, response } = createControllerFixture();

    await controller.googleCallback(
      undefined,
      'state',
      'access_denied',
      { headers: { cookie: 'wpcc_google_state=signed' } } as any,
      response,
    );

    assert.equal(clearedCookies[0][0], 'wpcc_google_state');
    assert.equal(redirects[0], 'https://wpcc.example.com/?mode=login&oauthError=GOOGLE_AUTH_FAILED');
  });
});

test('Google callback clears state cookie when authorization completion fails', async () => {
  await withWebUrl(async () => {
    const { controller, clearedCookies, redirects, response } = createControllerFixture();
    (controller as any).googleAuth.completeAuthorization = async () => {
      throw new Error('bad oauth state');
    };

    await controller.googleCallback(
      'code',
      'state',
      undefined,
      { headers: { cookie: 'wpcc_google_state=signed' } } as any,
      response,
    );

    assert.equal(clearedCookies[0][0], 'wpcc_google_state');
    assert.equal(redirects[0], 'https://wpcc.example.com/?mode=login&oauthError=GOOGLE_AUTH_FAILED');
  });
});

test('registration endpoints only delegate to EmailVerificationService', async () => {
  const { controller, delegated } = createControllerFixture();

  await controller.register({
    email: 'a@example.com',
    password: 'Password123!',
    fullName: 'A User',
  } as any);
  await controller.verifyEmail({ email: 'a@example.com', code: '123456' } as any);
  await controller.resendVerification({ email: 'a@example.com' } as any);

  assert.deepEqual(delegated, [
    ['register', { email: 'a@example.com', password: 'Password123!', fullName: 'A User' }],
    ['verify', { email: 'a@example.com', code: '123456' }],
    ['resend', { email: 'a@example.com' }],
  ]);
});
