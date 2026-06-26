import { Transform } from 'class-transformer';
import { IsEmail, Matches } from 'class-validator';

export class VerifyEmailDto {
  @Transform(({ value }) => typeof value === 'string' ? value.trim().toLowerCase() : value)
  @IsEmail()
  email!: string;

  @Matches(/^\d{6}$/)
  code!: string;
}
