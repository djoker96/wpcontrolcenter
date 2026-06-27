import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { UnauthorizedException } from '@nestjs/common';
import { encrypt } from '../src/common/utils/crypto.utils';
import { AgentGuard } from '../src/common/guards/agent.guard';

const encryptionKey = '0'.repeat(64);

test('AgentGuard accepts a valid HMAC signature', async () => {
  const originalEncryptionKey = process.env.AGENT_ENCRYPTION_KEY;
  process.env.AGENT_ENCRYPTION_KEY = encryptionKey;
  const siteId = 'site_1';
  const secretKey = 'agent-secret';
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const body = { status: 'ok' };
  const path = '/api/agent/heartbeat';
  const message = `POST|${path}|${timestamp}|${JSON.stringify(body)}`;
  const signature = createHmac('sha256', secretKey).update(message).digest('hex');
  const request: any = {
    method: 'POST',
    originalUrl: path,
    body,
    headers: {
      'x-wpcc-site-id': siteId,
      'x-wpcc-signature': signature,
      'x-wpcc-timestamp': timestamp,
    },
  };
  const prisma = {
    siteCredential: {
      findUnique: async () => ({ siteId, secretKeyEncrypted: encrypt(secretKey, encryptionKey) }),
    },
  };

  try {
    const guard = new AgentGuard(prisma as any);
    assert.equal(await guard.canActivate(makeContext(request)), true);
    assert.equal(request.siteId, siteId);
  } finally {
    process.env.AGENT_ENCRYPTION_KEY = originalEncryptionKey;
  }
});

test('AgentGuard rejects malformed signatures before comparison', async () => {
  const originalEncryptionKey = process.env.AGENT_ENCRYPTION_KEY;
  process.env.AGENT_ENCRYPTION_KEY = encryptionKey;
  const siteId = 'site_1';
  const request: any = {
    method: 'POST',
    originalUrl: '/api/agent/heartbeat',
    body: {},
    headers: {
      'x-wpcc-site-id': siteId,
      'x-wpcc-signature': 'not-hex',
      'x-wpcc-timestamp': Math.floor(Date.now() / 1000).toString(),
    },
  };
  const prisma = {
    siteCredential: {
      findUnique: async () => ({ siteId, secretKeyEncrypted: encrypt('agent-secret', encryptionKey) }),
    },
  };

  try {
    const guard = new AgentGuard(prisma as any);
    await assert.rejects(
      () => guard.canActivate(makeContext(request)),
      UnauthorizedException,
    );
  } finally {
    process.env.AGENT_ENCRYPTION_KEY = originalEncryptionKey;
  }
});

function makeContext(request: any): any {
  return {
    switchToHttp: () => ({
      getRequest: () => request,
    }),
  };
}
