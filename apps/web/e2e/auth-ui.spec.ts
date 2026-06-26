import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.route('**/api/auth/me', (route) =>
    route.fulfill({ status: 401, json: { message: 'Unauthorized' } }),
  );
});

test('switches between login, sign-up and lost-password modes', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
  await page.getByRole('tab', { name: 'Create account' }).click();
  await expect(page.getByLabel('Full name')).toBeVisible();
  await page.getByRole('tab', { name: 'Sign in' }).click();
  await page.getByRole('button', { name: 'Forgot password?' }).click();
  await expect(page.getByRole('heading', { name: 'Reset your password' })).toBeVisible();
});

test('registers, verifies six pasted digits and returns to login', async ({ page }) => {
  await page.route('**/api/auth/register', (route) =>
    route.fulfill({
      status: 201,
      json: {
        verificationRequired: true,
        email: 'j***@example.com',
        resendAvailableInSeconds: 60,
      },
    }),
  );
  await page.route('**/api/auth/verify-email', (route) =>
    route.fulfill({ status: 200, json: { success: true, email: 'jane@example.com' } }),
  );

  await page.goto('/');
  await page.getByRole('tab', { name: 'Create account' }).click();
  await page.getByLabel('Full name').fill('Jane Doe');
  await page.getByLabel('Email').fill('jane@example.com');
  await page.getByLabel('Password', { exact: true }).fill('StrongPass123!');
  await page.getByLabel('Confirm password').fill('StrongPass123!');
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page.getByRole('heading', { name: 'Verify your email' })).toBeVisible();
  await page.getByLabel('Verification code').fill('482913');
  await page.getByRole('button', { name: 'Verify email' }).click();
  await expect(page.getByText('Email verified. Sign in to continue.')).toBeVisible();
});

test('opens reset mode from a trusted query token', async ({ page }) => {
  await page.goto('/?mode=reset-password&token=raw-token');
  await expect(page.getByRole('heading', { name: 'Choose a new password' })).toBeVisible();
});
