import { test, expect } from '@playwright/test';

// Run against an isolated Square web instance using a private content pack
// with branding.theme=corporate-light and branding.colors.primary=#245A81.
// BASE_URL must point to the web origin, not a production instance.
test('configured community palette survives reload and preserves member choice', async ({ page }) => {
  await page.goto(process.env.SQUARE_THEME_TEST_URL ?? 'http://127.0.0.1:4300/login');
  await expect.poll(() => page.locator('html').getAttribute('data-theme')).toBe('corporate-light');
  await expect.poll(() => page.evaluate(() => document.documentElement.style.getPropertyValue('--theme-primary'))).toBe('#245A81');
  await page.reload();
  await expect.poll(() => page.evaluate(() => document.documentElement.style.getPropertyValue('--theme-primary'))).toBe('#245A81');
  await page.evaluate(() => localStorage.setItem('community-theme', JSON.stringify({ state: { themeName: 'high-contrast' }, version: 0 })));
  await page.reload();
  await expect.poll(() => page.locator('html').getAttribute('data-theme')).toBe('high-contrast');
  await expect.poll(() => page.evaluate(() => document.documentElement.style.getPropertyValue('--theme-primary'))).toBe('#ffffff');
});
