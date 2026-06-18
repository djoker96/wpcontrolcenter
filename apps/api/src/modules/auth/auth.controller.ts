import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
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
  async login(@Body() payload: LoginDto) {
    return this.authService.login(payload);
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
