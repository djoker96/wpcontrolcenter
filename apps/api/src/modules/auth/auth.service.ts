import { Injectable, InternalServerErrorException, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { LoginDto } from './dto/login.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { hashPassword, verifyPassword } from '../../common/utils/crypto.utils';
import * as jwt from 'jsonwebtoken';
import { getJwtSecret } from '../../config/env';
import * as crypto from 'crypto';

@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService) {}

  async login(payload: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: payload.email },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = verifyPassword(payload.password, user.passwordHash);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    let secret: string;
    try {
      secret = getJwtSecret();
    } catch (error) {
      throw new InternalServerErrorException(error instanceof Error ? error.message : 'JWT_SECRET environment variable is missing');
    }
    const expiresIn = process.env.JWT_EXPIRES_IN || '1d';

    const tokenPayload = {
      id: user.id,
      email: user.email,
      role: user.role,
    };

    const accessToken = jwt.sign(tokenPayload, secret, { expiresIn: expiresIn as any });

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
    const user = await this.prisma.user.findUnique({
      where: { email: payload.email },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('User not found or inactive');
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

    const isDev = process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test';

    return {
      success: true,
      message: 'Password reset token generated successfully',
      ...(isDev ? { resetToken: rawToken } : {}),
    };
  }

  async resetPassword(payload: ResetPasswordDto) {
    const tokenHash = crypto.createHash('sha256').update(payload.token).digest('hex');

    const resetToken = await this.prisma.passwordResetToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (!resetToken) {
      throw new UnauthorizedException('Invalid or expired token');
    }

    if (resetToken.usedAt) {
      throw new UnauthorizedException('Token has already been used');
    }

    if (new Date() > resetToken.expiresAt) {
      throw new UnauthorizedException('Token has expired');
    }

    const passwordHash = hashPassword(payload.password);

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: resetToken.userId },
        data: { passwordHash },
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
