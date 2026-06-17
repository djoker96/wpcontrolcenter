import { Body, Controller, Get, Post } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  login(@Body() payload: LoginDto) {
    return this.authService.login(payload);
  }

  @Post('logout')
  logout() {
    return { success: true };
  }

  @Post('forgot-password')
  forgotPassword(@Body() payload: { email: string }) {
    return { accepted: true, email: payload.email };
  }

  @Post('reset-password')
  resetPassword(@Body() payload: { token: string; password: string }) {
    return { success: true, token: payload.token, passwordLength: payload.password.length };
  }

  @Get('me')
  me() {
    return this.authService.me();
  }
}
