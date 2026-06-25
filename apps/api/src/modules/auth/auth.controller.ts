import { Body, Controller, Get, Post, Query, Req, UseGuards, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { RegisterDto } from './dto/register.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { ResendVerificationDto } from './dto/resend-verification.dto';
import { AuthGuard } from '../../common/guards/auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { getWebUrl } from '../../config/env';
import { EmailVerificationService } from './email-verification.service';
import { GoogleAuthService } from './google-auth.service';
import {
  AUTH_COOKIE,
  GOOGLE_STATE_COOKIE,
  authCookieOptions,
  googleStateCookieOptions,
  readCookie,
} from './auth-cookie.util';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly emailVerification: EmailVerificationService,
    private readonly googleAuth: GoogleAuthService,
  ) {}

  @Post('register')
  @Throttle({ auth: { ttl: 60_000, limit: 5 } })
  register(@Body() payload: RegisterDto) {
    return this.emailVerification.register(payload);
  }

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

  @Post('verify-email')
  @Throttle({ auth: { ttl: 60_000, limit: 10 } })
  verifyEmail(@Body() payload: VerifyEmailDto) {
    return this.emailVerification.verify(payload);
  }

  @Post('resend-verification')
  @Throttle({ auth: { ttl: 60 * 60_000, limit: 3 } })
  resendVerification(@Body() payload: ResendVerificationDto) {
    return this.emailVerification.resend(payload);
  }

  @Get('google/start')
  googleStart(@Res() res: Response) {
    const authorization = this.googleAuth.createAuthorization();
    res.cookie(GOOGLE_STATE_COOKIE, authorization.signedCookie, googleStateCookieOptions());
    return res.redirect(authorization.url);
  }

  @Get('google/callback')
  async googleCallback(
    @Query('code') code: string | undefined,
    @Query('state') state: string | undefined,
    @Query('error') providerError: string | undefined,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const webUrl = getWebUrl();
    const failure = new URL('/', webUrl);
    failure.searchParams.set('mode', 'login');
    failure.searchParams.set('oauthError', 'GOOGLE_AUTH_FAILED');
    try {
      if (providerError || !code || !state) return res.redirect(failure.toString());
      const signedCookie = readCookie(req.headers.cookie, GOOGLE_STATE_COOKIE);
      const result = await this.googleAuth.completeAuthorization(code, state, signedCookie);
      res.cookie(AUTH_COOKIE, result.accessToken, authCookieOptions());
      return res.redirect(new URL('/sites', webUrl).toString());
    } catch {
      return res.redirect(failure.toString());
    } finally {
      res.clearCookie(GOOGLE_STATE_COOKIE, { ...googleStateCookieOptions(), maxAge: undefined });
    }
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
