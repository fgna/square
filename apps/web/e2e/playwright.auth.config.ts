import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: '.',
  testMatch: ['**/*.smoke.spec.ts', '**/*.auth.spec.ts'],
  workers: 1,
  retries: 0,
  timeout: 30000,
  reporter: [['list', { printSteps: false }]],
  // Keep sessions and account details out of artifacts.
  use: {
    ...devices['Desktop Chrome'],
    headless: true,
    trace: 'off',
    screenshot: 'off',
    video: 'off',
  },
});
