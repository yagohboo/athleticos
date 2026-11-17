import { defineConfig, devices } from '@playwright/test';
import base from './playwright.config';

export default defineConfig({
  ...base,
  timeout: 60000,
  outputDir: 'test-results-webkit',
  reporter: [['list'], ['json', { outputFile: 'artifacts/e2e-webkit.json' }]],
  use: { ...base.use, ...devices['iPhone 13'], browserName: 'webkit' },
});
