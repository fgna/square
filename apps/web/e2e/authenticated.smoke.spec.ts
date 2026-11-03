import { test, expect } from './authenticated.fixture';

test('a synthetic member signs in via Square and can access protected content', async ({ authenticatedPage }) => {
  await expect(authenticatedPage.locator('body')).toBeVisible();
  const url = new URL(authenticatedPage.url());
  expect(url.pathname).not.toMatch(/^\/login(?:\/|$)/);
  const cookies = await authenticatedPage.context().cookies(url.origin);
  expect(cookies.some((cookie) => cookie.name === 'auth-session' && cookie.value === '1')).toBe(true);
});
