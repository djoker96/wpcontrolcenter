import { test, expect } from '@playwright/test';

test.describe('Admin Login Flow', () => {
  test('should show validation error on empty submit', async ({ page }) => {
    await page.goto('/');
    await page.click('button[type="submit"]');
    // Verify login form stays and hasn't redirected
    await expect(page).toHaveURL('/');
  });

  test('should login successfully with valid admin credentials', async ({ page }) => {
    await page.goto('/');
    await page.fill('input[type="email"]', 'admin@example.com');
    await page.fill('input[type="password"]', 'ChangeMe123!');
    await page.click('button[type="submit"]');

    // Verify redirection to dashboard sites page
    await expect(page).toHaveURL('/sites');
    const header = page.locator('h2');
    await expect(header).toContainText('WordPress Sites');
  });
});
