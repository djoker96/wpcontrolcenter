import assert from 'node:assert/strict';
import { test } from 'node:test';
import { HttpStatus } from '@nestjs/common';
import {
  AuthErrorExtra,
  authError,
} from '../src/modules/auth/auth.errors';

test('authError preserves stable fields and allowlists retryAfterSeconds', () => {
  const untrustedExtra = {
    retryAfterSeconds: 30,
    statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
    code: 'GOOGLE_AUTH_FAILED',
    message: 'overridden',
    secret: 'do-not-leak',
  } as unknown as AuthErrorExtra;

  const exception = authError(
    HttpStatus.TOO_MANY_REQUESTS,
    'INVALID_CREDENTIALS',
    'Original message',
    untrustedExtra,
  );

  assert.deepEqual(exception.getResponse(), {
    statusCode: HttpStatus.TOO_MANY_REQUESTS,
    code: 'INVALID_CREDENTIALS',
    message: 'Original message',
    retryAfterSeconds: 30,
  });
});

for (const retryAfterSeconds of [NaN, Infinity, -1, 1.5, '30']) {
  test(`authError drops invalid retryAfterSeconds ${String(retryAfterSeconds)}`, () => {
    const exception = authError(
      HttpStatus.TOO_MANY_REQUESTS,
      'VERIFICATION_RESEND_COOLDOWN',
      'Try again later',
      { retryAfterSeconds } as unknown as AuthErrorExtra,
    );

    assert.deepEqual(exception.getResponse(), {
      statusCode: HttpStatus.TOO_MANY_REQUESTS,
      code: 'VERIFICATION_RESEND_COOLDOWN',
      message: 'Try again later',
    });
  });
}
