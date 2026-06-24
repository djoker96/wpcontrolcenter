import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MailService } from '../src/modules/mail/mail.service';

test('sendVerificationCode emits safe text and HTML with the ten-minute expiry', async () => {
  const sent: any[] = [];
  const transport = { sendMail: async (message: unknown) => sent.push(message) };
  const service = new MailService(transport as any, 'WPCC <no-reply@example.com>', 'https://wpcc.example.com');

  await service.sendVerificationCode('jane@example.com', '482913');

  assert.equal(sent[0].from, 'WPCC <no-reply@example.com>');
  assert.equal(sent[0].to, 'jane@example.com');
  assert.match(sent[0].subject, /verify/i);
  assert.match(sent[0].text, /482913/);
  assert.match(sent[0].text, /10 minutes/);
  assert.match(sent[0].html, /482913/);
  assert.match(sent[0].html, /10 minutes/);
  assert.doesNotMatch(sent[0].html, /href=/i);
});

test('sendPasswordResetLink uses WEB_URL and never interpolates an untrusted origin', async () => {
  const sent: any[] = [];
  const transport = { sendMail: async (message: unknown) => sent.push(message) };
  const service = new MailService(transport as any, 'WPCC <no-reply@example.com>', 'https://wpcc.example.com');

  await service.sendPasswordResetLink('jane@example.com', 'raw-token');

  assert.equal(sent[0].from, 'WPCC <no-reply@example.com>');
  assert.equal(sent[0].to, 'jane@example.com');
  assert.match(sent[0].subject, /reset/i);
  assert.match(sent[0].text, /https:\/\/wpcc\.example\.com\/\?mode=reset-password&token=raw-token/);
  assert.match(sent[0].text, /one hour/i);
  assert.doesNotMatch(sent[0].text, /localhost/);
  assert.match(sent[0].html, /https:\/\/wpcc\.example\.com\/\?mode=reset-password&token=raw-token/);
  assert.match(sent[0].html, /one hour/i);
  assert.doesNotMatch(sent[0].html, /localhost/);
});
