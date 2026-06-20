import { defineConfig, devices } from '@playwright/test';

const isCI = !!process.env.CI;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 2 : 0,
  workers: isCI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: process.env.BASE_URL || 'http://localhost:5001',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
  ],
  // In CI, the Docker stack provides the running server via nginx.
  // Locally, Playwright manages its own dev server.
  ...(isCI
    ? {}
    : {
        webServer: {
          command: 'npm run dev',
          url: 'http://localhost:5001',
          reuseExistingServer: true,
          timeout: 120 * 1000,
        },
      }),
});
