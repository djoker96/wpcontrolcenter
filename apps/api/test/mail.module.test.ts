import 'reflect-metadata';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { MailModule } from '../src/modules/mail/mail.module';
import { MAIL_FROM, MAIL_TRANSPORT, WEB_URL } from '../src/modules/mail/mail.service';

test('mail module providers do not require SMTP or WEB_URL environment at app startup', () => {
  const originals = {
    SMTP_HOST: process.env.SMTP_HOST,
    SMTP_PORT: process.env.SMTP_PORT,
    SMTP_SECURE: process.env.SMTP_SECURE,
    SMTP_USER: process.env.SMTP_USER,
    SMTP_PASSWORD: process.env.SMTP_PASSWORD,
    MAIL_FROM: process.env.MAIL_FROM,
    WEB_URL: process.env.WEB_URL,
  };
  for (const name of Object.keys(originals)) {
    delete process.env[name];
  }

  try {
    const providers = ((Reflect as any).getMetadata('providers', MailModule) as any[]) ?? [];
    for (const token of [MAIL_TRANSPORT, MAIL_FROM, WEB_URL]) {
      const provider = providers.find((candidate) => candidate.provide === token);
      assert.ok(provider);
      assert.doesNotThrow(() => provider.useFactory());
    }
  } finally {
    for (const [name, value] of Object.entries(originals)) {
      process.env[name] = value;
    }
  }
});
