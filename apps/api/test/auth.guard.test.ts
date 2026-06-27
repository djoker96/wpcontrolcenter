import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as jwt from 'jsonwebtoken';
import { UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '../src/common/guards/auth.guard';

test('AuthGuard accepts the httpOnly session cookie when the bearer marker is present', () => {
  const originalJwtSecret = process.env.JWT_SECRET;
  process.env.JWT_SECRET = 'test-jwt-secret';
  const token = jwt.sign({ sub: 'user_1', role: 'ADMIN' }, process.env.JWT_SECRET);
  const request: any = {
    headers: {
      authorization: 'Bearer cookie-session',
      cookie: `wpcc_token=${encodeURIComponent(token)}`,
    },
  };

  try {
    const guard = new AuthGuard();
    assert.equal(guard.canActivate(makeContext(request)), true);
    assert.equal(request.user.sub, 'user_1');
  } finally {
    process.env.JWT_SECRET = originalJwtSecret;
  }
});

test('AuthGuard rejects requests without a cookie or bearer JWT', () => {
  const originalJwtSecret = process.env.JWT_SECRET;
  process.env.JWT_SECRET = 'test-jwt-secret';

  try {
    const guard = new AuthGuard();
    assert.throws(
      () => guard.canActivate(makeContext({ headers: {} })),
      UnauthorizedException,
    );
  } finally {
    process.env.JWT_SECRET = originalJwtSecret;
  }
});

function makeContext(request: any): any {
  return {
    switchToHttp: () => ({
      getRequest: () => request,
    }),
  };
}
