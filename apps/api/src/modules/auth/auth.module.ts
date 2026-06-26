import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { EmailVerificationService } from './email-verification.service';
import { MailModule } from '../mail/mail.module';
import { GoogleAuthService } from './google-auth.service';

@Module({
  imports: [MailModule],
  controllers: [AuthController],
  providers: [AuthService, EmailVerificationService, GoogleAuthService],
  exports: [AuthService, GoogleAuthService],
})
export class AuthModule {}
