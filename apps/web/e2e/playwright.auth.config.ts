import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: '.',
  testMatch: ['**/*.smoke.spec.ts', '**/*.auth.spec.ts'],
  // Plugin-specific cases require the corresponding plugin to be installed.\n  // Generic isolated Square CI runs the shared authentication checks only.\n  testIgnore: process.env.SQUARE_TEST_PLUGIN_TESTS === '1' ? [] : ['**/turbo-mathe-*.auth.spec.ts'],\n  workers: 1,
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
