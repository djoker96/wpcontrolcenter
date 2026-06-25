import { HttpException, HttpStatus, Inject, Injectable, Optional } from '@nestjs/common';
import { AuthProvider, Prisma, UserRole } from '@wpcc/database';
import { OAuth2Client } from 'google-auth-library';
import { createHmac, randomBytes, timingSafeEqual } from 'crypto';
import { GoogleAuthConfig, getGoogleAuthConfig, getJwtSecret } from '../../config/env';
import { PrismaService } from '../database/prisma.service';
import { AuthService } from './auth.service';
import { authError } from './auth.errors';

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

  async completeAuthorization(code: string, state: string, signedCookie?: string): Promise<{ accessToken: string; user: any }> {
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
