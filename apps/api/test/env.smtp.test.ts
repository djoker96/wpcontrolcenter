import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getSmtpConfig, validateEnvironment } from '../src/config/env';

const smtpNames = [
  'SMTP_HOST',
  'SMTP_PORT',
  'SMTP_SECURE',
  'SMTP_USER',
  'SMTP_PASSWORD',
  'MAIL_FROM',
] as const;

const productionNames = [
  'NODE_ENV',
  'DATABASE_URL',
  'JWT_SECRET',
  'AGENT_ENCRYPTION_KEY',
  'WEB_URL',
  'GOOGLE_CLIENT_ID',
  'GOOGLE_CLIENT_SECRET',
  'GOOGLE_AUTH_REDIRECT_URI',
  ...smtpNames,
] as const;

function withSmtpEnv(
  overrides: Partial<Record<(typeof smtpNames)[number], string>>,
  run: () => void,
): void {
  const previous = Object.fromEntries(
    smtpNames.map((name) => [name, process.env[name]]),
  );
  Object.assign(process.env, {
    SMTP_HOST: 'smtp.example.com',
    SMTP_PORT: '587',
    SMTP_SECURE: 'false',
    SMTP_USER: 'user',
    SMTP_PASSWORD: 'password',
    MAIL_FROM: 'WPCC <no-reply@example.com>',
    ...overrides,
  });

  try {
    run();
  } finally {
    for (const name of smtpNames) {
      const value = previous[name];
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  }
}

function withProductionEnv(
  overrides: Partial<Record<(typeof productionNames)[number], string>>,
  run: () => void,
): void {
  const previous = Object.fromEntries(
    productionNames.map((name) => [name, process.env[name]]),
  );
  Object.assign(process.env, {
    NODE_ENV: 'production',
    DATABASE_URL: 'postgresql://wpcc:secret@localhost:5432/wpcc',
    JWT_SECRET: 'x'.repeat(32),
    AGENT_ENCRYPTION_KEY: 'y'.repeat(32),
    WEB_URL: 'https://wpcc.example.com/app',
    GOOGLE_CLIENT_ID: 'google-client-id',
    GOOGLE_CLIENT_SECRET: 'google-client-secret',
    GOOGLE_AUTH_REDIRECT_URI: 'https://api.example.com/auth/google/callback',
    SMTP_HOST: 'smtp.example.com',
    SMTP_PORT: '587',
    SMTP_SECURE: 'false',
    SMTP_USER: 'user',
    SMTP_PASSWORD: 'password',
    MAIL_FROM: 'WPCC <no-reply@example.com>',
    ...overrides,
  });

  try {
    run();
  } finally {
    for (const name of productionNames) {
      const value = previous[name];
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  }
}

test('getSmtpConfig accepts strict secure values that match the port policy', () => {
  withSmtpEnv({}, () => {
    assert.deepEqual(getSmtpConfig(), {
      host: 'smtp.example.com',
      port: 587,
      secure: false,
      user: 'user',
      password: 'password',
      from: 'WPCC <no-reply@example.com>',
    });
  });
  withSmtpEnv({ SMTP_PORT: '465', SMTP_SECURE: 'true' }, () => {
    assert.equal(getSmtpConfig().secure, true);
  });
});

test('getSmtpConfig rejects non-boolean SMTP_SECURE values', () => {
  withSmtpEnv({ SMTP_SECURE: 'yes' }, () => {
    assert.throws(() => getSmtpConfig(), /SMTP_SECURE must be either true or false/);
  });
});

test('getSmtpConfig requires secure=true on port 465', () => {
  withSmtpEnv({ SMTP_PORT: '465', SMTP_SECURE: 'false' }, () => {
    assert.throws(() => getSmtpConfig(), /must be true when SMTP_PORT is 465/);
  });
});

test('getSmtpConfig requires secure=false on ports other than 465', () => {
  withSmtpEnv({ SMTP_PORT: '587', SMTP_SECURE: 'true' }, () => {
    assert.throws(() => getSmtpConfig(), /must be false when SMTP_PORT is not 465/);
  });
});

test('validateEnvironment validates SMTP config in production', () => {
  withProductionEnv({ SMTP_SECURE: 'yes' }, () => {
    assert.throws(() => validateEnvironment(), /SMTP_SECURE must be either true or false/);
  });
});
