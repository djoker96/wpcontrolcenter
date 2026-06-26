import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Prisma } from '@wpcc/database';
import { GoogleAuthService } from '../src/modules/auth/google-auth.service';

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

test('constructor does not require Google environment until OAuth is used', () => {
  const originalClientId = process.env.GOOGLE_CLIENT_ID;
  const originalClientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const originalRedirectUri = process.env.GOOGLE_AUTH_REDIRECT_URI;
  delete process.env.GOOGLE_CLIENT_ID;
  delete process.env.GOOGLE_CLIENT_SECRET;
  delete process.env.GOOGLE_AUTH_REDIRECT_URI;
  try {
    assert.doesNotThrow(() => new GoogleAuthService({} as any, {} as any));
  } finally {
    process.env.GOOGLE_CLIENT_ID = originalClientId;
    process.env.GOOGLE_CLIENT_SECRET = originalClientSecret;
    process.env.GOOGLE_AUTH_REDIRECT_URI = originalRedirectUri;
  }
});
