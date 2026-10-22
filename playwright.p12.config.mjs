import { defineConfig } from '@playwright/test';
import base from './playwright.config.mjs';
export default defineConfig({ ...base, testDir: './performance-e2e', testMatch: '**/history.mjs',
  reporter: [['./performance-e2e/reporter.mjs']], outputDir: 'test-results-p12',
});
