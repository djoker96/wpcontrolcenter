import { test, expect } from '@playwright/test';

test.describe('Sites Operations Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    // Login first
    await page.goto('/');
    await page.fill('input[type="email"]', 'admin@example.com');
    await page.fill('input[type="password"]', 'ChangeMe123!');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL('/sites');
  });

  test('should display active site cards list', async ({ page }) => {
    const siteRows = page.locator('table tbody tr');
    await expect(siteRows.first()).toBeVisible();
  });

  test('should navigate to site details tabs successfully', async ({ page }) => {
    // Click on first site's Manage button
    await page.locator('a:has-text("Manage")').first().click();
    
    // Verify redirection to site detail ID page
    await expect(page).toHaveURL(/\/sites\/.+/);

    // Navigate to tabs and verify tab panel renders
    await page.click('button:has-text("Plugins")');
    await expect(page.locator('h3:has-text("Installed Plugins")')).toBeVisible();

    await page.click('button:has-text("Server Diagnostics")');
    await expect(page.locator('h4:has-text("Disk Space Usage")')).toBeVisible();

    await page.click('button:has-text("Performance & Speed")');
    await expect(page.locator('h3:has-text("Performance & Speed Audits")')).toBeVisible();
  });
});
