import { Body, Controller, Get, Post, UseGuards, Res } from '@nestjs/common';
import type { Response } from 'express';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { AuthGuard } from '../../common/guards/auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

export const AUTH_COOKIE = 'wpcc_token';

function authCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge: 24 * 60 * 60 * 1000, // 1 day
  };
}

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  // Strict limiter to slow brute-force: 10 attempts / minute per IP
  @Throttle({ auth: { ttl: 60_000, limit: 10 } })
  async login(
    @Body() payload: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.login(payload);
    // Primary auth transport: httpOnly cookie (not readable by JS → XSS-safe).
    res.cookie(AUTH_COOKIE, result.accessToken, authCookieOptions());
    // Return user info only; token also returned for legacy/non-browser clients.
    return result;
  }

  @Post('logout')
  async logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie(AUTH_COOKIE, { ...authCookieOptions(), maxAge: undefined });
    return { success: true };
  }

  @Post('forgot-password')
  // Even stricter: 5 reset requests / minute per IP
  @Throttle({ auth: { ttl: 60_000, limit: 5 } })
  async forgotPassword(@Body() payload: ForgotPasswordDto) {
    return this.authService.forgotPassword(payload);
  }

  @Post('reset-password')
  @Throttle({ auth: { ttl: 60_000, limit: 10 } })
  async resetPassword(@Body() payload: ResetPasswordDto) {
    return this.authService.resetPassword(payload);
  }

  @Get('me')
  @UseGuards(AuthGuard)
  async me(@CurrentUser() user: any) {
    return this.authService.me(user.id);
  }
}
