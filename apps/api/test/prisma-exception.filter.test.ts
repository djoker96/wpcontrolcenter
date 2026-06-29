import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Prisma } from '@wpcc/database';
import { PrismaExceptionFilter } from '../src/common/filters/prisma-exception.filter';

test('PrismaExceptionFilter writes error responses through a platform-agnostic reply', () => {
  const sent: any[] = [];
  const reply = {
    statusCode: 0,
    status(status: number) {
      this.statusCode = status;
      return this;
    },
    send(payload: unknown) {
      sent.push(payload);
      return this;
    },
  };
  const host = {
    switchToHttp: () => ({
      getResponse: () => reply,
    }),
  };
  const exception = new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
    code: 'P2002',
    clientVersion: 'test',
    meta: { target: ['email'] },
  });

  new PrismaExceptionFilter().catch(exception, host as any);

  assert.equal(reply.statusCode, 409);
  assert.equal(sent[0].statusCode, 409);
  assert.equal(sent[0].error, 'Conflict');
  assert.equal(sent[0].message, 'Duplicate value error: A record with this email already exists.');
});
