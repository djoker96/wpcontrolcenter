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
    return randomInt(100_000, 1_000_000).toString();
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
      throw authError(
        HttpStatus.SERVICE_UNAVAILABLE,
        'EMAIL_DELIVERY_FAILED',
        'The account was created, but the verification email could not be sent',
      );
    }

    return { verificationRequired: true, email: this.maskEmail(user.email), resendAvailableInSeconds: 60 };
  }

  async verify(payload: VerifyEmailDto) {
    const email = this.normalizeEmail(payload.email);
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) throw authError(HttpStatus.BAD_REQUEST, 'VERIFICATION_CODE_INVALID', 'Invalid verification code');

    const code = await this.prisma.emailVerificationCode.findFirst({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
    });
    if (!code) throw authError(HttpStatus.BAD_REQUEST, 'VERIFICATION_CODE_INVALID', 'Invalid verification code');
    if (code.consumedAt) throw authError(HttpStatus.BAD_REQUEST, 'VERIFICATION_CODE_USED', 'Verification code has already been used');
    if (code.attemptCount >= MAX_ATTEMPTS) {
      throw authError(HttpStatus.TOO_MANY_REQUESTS, 'VERIFICATION_ATTEMPTS_EXCEEDED', 'Request a new verification code');
    }
    if (code.expiresAt <= this.now()) {
      throw authError(HttpStatus.BAD_REQUEST, 'VERIFICATION_CODE_EXPIRED', 'Verification code has expired');
    }

    const suppliedHash = this.hashCode(user.id, payload.code);
    if (!this.equalHash(suppliedHash, code.codeHash)) {
      const previousAttempts = code.attemptCount;
      await this.prisma.emailVerificationCode.updateMany({
        where: { id: code.id, consumedAt: null },
        data: { attemptCount: { increment: 1 } },
      });
      const nextAttempts = previousAttempts + 1;
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
      if (consumed.count !== 1) {
        throw authError(HttpStatus.BAD_REQUEST, 'VERIFICATION_CODE_USED', 'Verification code has already been used');
      }
      await tx.user.update({ where: { id: user.id }, data: { emailVerifiedAt: now } });
    });
    return { success: true, email: user.email };
  }

  async resend(payload: ResendVerificationDto) {
    const email = this.normalizeEmail(payload.email);
    const user = await this.prisma.user.findUnique({ where: { email } });
    const generic = { success: true, resendAvailableInSeconds: 60 };
    if (!user || user.emailVerifiedAt) return generic;

    const latest = await this.prisma.emailVerificationCode.findFirst({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
    });
    const now = this.now();
    if (latest) {
      const retryAfterSeconds = Math.ceil((latest.createdAt.getTime() + RESEND_COOLDOWN_MS - now.getTime()) / 1000);
      if (retryAfterSeconds > 0) {
        throw authError(
          HttpStatus.TOO_MANY_REQUESTS,
          'VERIFICATION_RESEND_COOLDOWN',
          'Wait before requesting another code',
          { retryAfterSeconds },
        );
      }
    }

    const rawCode = this.newCode();
    await this.prisma.$transaction(async (tx) => {
      await tx.emailVerificationCode.updateMany({
        where: { userId: user.id, consumedAt: null },
        data: { consumedAt: now },
      });
      await tx.emailVerificationCode.create({
        data: {
          userId: user.id,
          codeHash: this.hashCode(user.id, rawCode),
          expiresAt: new Date(now.getTime() + OTP_TTL_MS),
          createdAt: now,
        },
      });
    });
    try {
      await this.mail.sendVerificationCode(user.email, rawCode);
    } catch {
      throw authError(HttpStatus.SERVICE_UNAVAILABLE, 'EMAIL_DELIVERY_FAILED', 'The verification email could not be sent');
    }
    return generic;
  }
}
