import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { AuthGuard } from '../../common/guards/auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  // Strict limiter to slow brute-force: 10 attempts / minute per IP
  @Throttle({ auth: { ttl: 60_000, limit: 10 } })
  async login(@Body() payload: LoginDto) {
    return this.authService.login(payload);
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
