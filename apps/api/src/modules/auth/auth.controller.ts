import { Body, Controller, Get, Post, UseGuards, NotImplementedException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { AuthGuard } from '../../common/guards/auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  async login(@Body() payload: LoginDto) {
    return this.authService.login(payload);
  }

  @Post('logout')
  logout() {
    throw new NotImplementedException('Logout feature is not implemented yet. Clean up local token instead.');
  }

  @Post('forgot-password')
  forgotPassword(@Body() payload: { email: string }) {
    throw new NotImplementedException('Password recovery is not implemented yet.');
  }

  @Post('reset-password')
  resetPassword(@Body() payload: { token: string; password: string }) {
    throw new NotImplementedException('Password reset is not implemented yet.');
  }

  @Get('me')
  @UseGuards(AuthGuard)
  async me(@CurrentUser() user: any) {
    return this.authService.me(user.id);
  }
}
