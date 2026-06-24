import { HttpException, HttpStatus } from '@nestjs/common';

export type AuthErrorCode =
  | 'INVALID_CREDENTIALS'
  | 'EMAIL_NOT_VERIFIED'
  | 'PASSWORD_LOGIN_UNAVAILABLE'
  | 'EMAIL_ALREADY_EXISTS'
  | 'EMAIL_VERIFICATION_PENDING'
  | 'EMAIL_DELIVERY_FAILED'
  | 'VERIFICATION_CODE_INVALID'
  | 'VERIFICATION_CODE_EXPIRED'
  | 'VERIFICATION_CODE_USED'
  | 'VERIFICATION_ATTEMPTS_EXCEEDED'
  | 'VERIFICATION_RESEND_COOLDOWN'
  | 'RESET_TOKEN_INVALID'
  | 'RESET_TOKEN_EXPIRED'
  | 'RESET_TOKEN_USED'
  | 'GOOGLE_AUTH_FAILED';

export function authError(
  status: HttpStatus,
  code: AuthErrorCode,
  message: string,
  extra: Record<string, unknown> = {},
): HttpException {
  return new HttpException({ statusCode: status, code, message, ...extra }, status);
}
