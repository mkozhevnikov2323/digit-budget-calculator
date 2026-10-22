import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './e2e', testMatch: '**/*.spec.mjs', fullyParallel: false, workers: 1,
  forbidOnly: Boolean(process.env.CI), retries: 0, timeout: 90000,
  expect: { timeout: 10000 }, globalTimeout: 12 * 60 * 1000,
  reporter: [['./e2e/safe-reporter.mjs']], outputDir: 'test-results',
  use: { browserName: 'chromium', baseURL: 'http://localhost:5173', headless: true,
    viewport: { width: 1440, height: 1000 }, locale: 'ru-RU', timezoneId: 'UTC',
    trace: 'off', video: 'off', screenshot: 'off',
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
      ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH } : {},
  },
});
