import { defineConfig } from '@playwright/test';
import base from './playwright.config.mjs';
export default defineConfig({
  ...base,
  testMatch: 'classification-groups.spec.mjs',
  globalTimeout: 5 * 60 * 1000,
  reporter: [
    ['./e2e/safe-reporter.mjs', { expected: 2, folder: 'groups-e2e-results' }],
  ],
});
