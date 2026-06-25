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

export interface AuthErrorExtra {
  retryAfterSeconds?: unknown;
}

function isFiniteNonNegativeInteger(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isFinite(value) &&
    Number.isInteger(value) &&
    value >= 0
  );
}

export function authError(
  status: HttpStatus,
  code: AuthErrorCode,
  message: string,
  extra: AuthErrorExtra = {},
): HttpException {
  const safeExtra = isFiniteNonNegativeInteger(extra.retryAfterSeconds)
    ? { retryAfterSeconds: extra.retryAfterSeconds }
    : {};

  return new HttpException(
    {
      statusCode: status,
      code,
      message,
      ...safeExtra,
    },
    status,
  );
}
