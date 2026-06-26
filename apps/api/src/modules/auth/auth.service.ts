import { HttpStatus, Injectable, InternalServerErrorException, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { LoginDto } from './dto/login.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { hashPassword, verifyPassword, isLegacyPasswordHash } from '../../common/utils/crypto.utils';
import * as jwt from 'jsonwebtoken';
import { getJwtSecret } from '../../config/env';
import * as crypto from 'crypto';
import { MailService } from '../mail/mail.service';
import { authError } from './auth.errors';

@Injectable()
export class AuthService {
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
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        fullName: user.fullName,
      },
    };
  }

  async login(payload: LoginDto) {
    const email = payload.email.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user || !user.isActive) {
      throw authError(HttpStatus.UNAUTHORIZED, 'INVALID_CREDENTIALS', 'Invalid email or password');
    }

    if (!user.emailVerifiedAt) {
      throw authError(HttpStatus.FORBIDDEN, 'EMAIL_NOT_VERIFIED', 'Verify your email before signing in');
    }

    if (!user.passwordHash) {
      throw authError(HttpStatus.BAD_REQUEST, 'PASSWORD_LOGIN_UNAVAILABLE', 'Continue with Google for this account');
    }

    const isPasswordValid = verifyPassword(payload.password, user.passwordHash);
    if (!isPasswordValid) {
      throw authError(HttpStatus.UNAUTHORIZED, 'INVALID_CREDENTIALS', 'Invalid email or password');
    }

    // Transparently upgrade weak legacy SHA-256 hashes to scrypt on successful login.
    if (isLegacyPasswordHash(user.passwordHash)) {
      try {
        await this.prisma.user.update({
          where: { id: user.id },
          data: { passwordHash: hashPassword(payload.password) },
        });
      } catch {
        // Non-fatal: login still succeeds even if the re-hash write fails.
      }
    }

    return this.createSession(user);
  }

  async me(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });
    if (!user || !user.isActive) {
      throw new UnauthorizedException('User session is invalid');
    }
    return {
      id: user.id,
      email: user.email,
      role: user.role,
      fullName: user.fullName,
    };
  }

  async forgotPassword(payload: ForgotPasswordDto) {
    const email = payload.email.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    // Always return the same generic response to prevent account enumeration.
    const genericResponse = {
      success: true,
      message: 'If an account exists for that email, a password reset link has been sent',
    };

    if (!user || !user.isActive || !user.emailVerifiedAt || !user.passwordHash) {
      return genericResponse;
    }

    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + 3600 * 1000); // 1 hour expiry

    await this.prisma.passwordResetToken.create({
      data: {
        tokenHash,
        expiresAt,
        userId: user.id,
      },
    });

    try {
      await this.mail.sendPasswordResetLink(user.email, rawToken);
    } catch {
      throw authError(HttpStatus.SERVICE_UNAVAILABLE, 'EMAIL_DELIVERY_FAILED', 'The password reset email could not be sent');
    }

    return genericResponse;
  }

  async resetPassword(payload: ResetPasswordDto) {
    const tokenHash = crypto.createHash('sha256').update(payload.token).digest('hex');

    const resetToken = await this.prisma.passwordResetToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (!resetToken) {
      throw authError(HttpStatus.UNAUTHORIZED, 'RESET_TOKEN_INVALID', 'Invalid or expired token');
    }

    if (resetToken.usedAt) {
      throw authError(HttpStatus.UNAUTHORIZED, 'RESET_TOKEN_USED', 'Token has already been used');
    }

    if (new Date() > resetToken.expiresAt) {
      throw authError(HttpStatus.UNAUTHORIZED, 'RESET_TOKEN_EXPIRED', 'Token has expired');
    }

    const passwordHash = hashPassword(payload.password);

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: resetToken.userId },
        data: {
          passwordHash,
          tokenVersion: { increment: 1 }, // invalidates all existing JWT tokens
        },
      }),
      this.prisma.passwordResetToken.update({
        where: { id: resetToken.id },
        data: { usedAt: new Date() },
      }),
    ]);

    return {
      success: true,
      message: 'Password has been reset successfully',
    };
  }
}
