import { Body, Controller, Get, Post, Res, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { AuthGuard } from '../../common/guards/auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

type HeaderReply = {
  header(name: string, value: string): unknown;
};

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  async login(@Body() payload: LoginDto, @Res({ passthrough: true }) response: HeaderReply) {
    const result = await this.authService.login(payload);
    response.header('Set-Cookie', serializeCookie('wpcc_token', result.accessToken, {
      httpOnly: true,
      secure: shouldUseSecureCookies(),
      sameSite: 'Lax',
      path: '/',
      maxAge: 24 * 60 * 60,
    }));
    return { user: result.user };
  }

  @Post('logout')
  logout(@Res({ passthrough: true }) response: HeaderReply) {
    response.header('Set-Cookie', serializeCookie('wpcc_token', '', {
      httpOnly: true,
      secure: shouldUseSecureCookies(),
      sameSite: 'Lax',
      path: '/',
      maxAge: 0,
    }));
    return { success: true };
  }

  @Post('forgot-password')
  async forgotPassword(@Body() payload: ForgotPasswordDto) {
    return this.authService.forgotPassword(payload);
  }

  @Post('reset-password')
  async resetPassword(@Body() payload: ResetPasswordDto) {
    return this.authService.resetPassword(payload);
  }

  @Get('me')
  @UseGuards(AuthGuard)
  async me(@CurrentUser() user: any) {
    return this.authService.me(user.id);
  }
}

function shouldUseSecureCookies(): boolean {
  if (process.env.COOKIE_SECURE !== undefined) {
    return process.env.COOKIE_SECURE === 'true';
  }
  return process.env.NODE_ENV === 'production';
}

function serializeCookie(
  name: string,
  value: string,
  options: { httpOnly: boolean; secure: boolean; sameSite: 'Lax'; path: string; maxAge: number },
): string {
  const segments = [
    `${name}=${encodeURIComponent(value)}`,
    `Max-Age=${options.maxAge}`,
    `Path=${options.path}`,
    `SameSite=${options.sameSite}`,
  ];

  if (options.httpOnly) {
    segments.push('HttpOnly');
  }

  if (options.secure) {
    segments.push('Secure');
  }

  return segments.join('; ');
}
