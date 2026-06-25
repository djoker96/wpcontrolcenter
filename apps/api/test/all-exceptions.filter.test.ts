import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter';

function catchException(responseBody: Record<string, unknown>): Record<string, unknown> {
  let statusCode: number | undefined;
  let jsonBody: Record<string, unknown> | undefined;
  const response = {
    status(status: number) {
      statusCode = status;
      return this;
    },
    json(body: Record<string, unknown>) {
      jsonBody = body;
      return this;
    },
  };
  const host = {
    switchToHttp: () => ({
      getRequest: () => ({ method: 'POST', url: '/api/auth/test' }),
      getResponse: () => response,
    }),
  } as unknown as ArgumentsHost;

  new AllExceptionsFilter().catch(
    new HttpException(responseBody, HttpStatus.TOO_MANY_REQUESTS),
    host,
  );

  assert.equal(statusCode, HttpStatus.TOO_MANY_REQUESTS);
  assert.ok(jsonBody);
  return jsonBody;
}

test('filter preserves stable auth fields and drops unsafe extras', () => {
  const body = catchException({
    statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
    code: 'VERIFICATION_RESEND_COOLDOWN',
    message: 'Try again later',
    retryAfterSeconds: 45,
    secret: 'do-not-leak',
    nested: { unsafe: true },
  });

  assert.equal(body.statusCode, HttpStatus.TOO_MANY_REQUESTS);
  assert.equal(body.code, 'VERIFICATION_RESEND_COOLDOWN');
  assert.equal(body.message, 'Try again later');
  assert.equal(body.retryAfterSeconds, 45);
  assert.equal('secret' in body, false);
  assert.equal('nested' in body, false);
});

test('filter flattens validation message arrays', () => {
  const body = catchException({
    message: ['email must be valid', 'password is too short'],
    error: 'Bad Request',
  });

  assert.equal(body.message, 'email must be valid; password is too short');
  assert.equal(body.error, 'Bad Request');
});

for (const retryAfterSeconds of [NaN, Infinity, -1, 1.5, '12']) {
  test(`filter drops invalid retryAfterSeconds ${String(retryAfterSeconds)}`, () => {
    const body = catchException({
      code: 'VERIFICATION_RESEND_COOLDOWN',
      message: 'Try again later',
      retryAfterSeconds,
    });

    assert.equal('retryAfterSeconds' in body, false);
  });
}
