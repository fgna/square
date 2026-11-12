import { test, expect } from './authenticated.fixture';

test('synthetic member can dismiss optional privacy notice over onboarding without forced clicks', async ({ authenticatedPage }) => {
  test.skip(process.env.SQUARE_E2E_DISPOSABLE !== '1', 'Requires isolated seeded Square #102 runtime');
  const apiUrl = process.env.SQUARE_E2E_API_URL;
  const adminToken = process.env.SQUARE_E2E_ADMIN_TOKEN;
  if (!apiUrl || !adminToken) throw new Error('Missing disposable test API/admin credentials');

  // The CI runner creates these credentials and the database exclusively for
  // this test. Never use production member accounts or instance settings.
  const settings = await authenticatedPage.request.put(`${apiUrl}/api/admin/settings`, {
    headers: { Authorization: `Bearer ${adminToken}` },
    data: { privacyNoticeEnabled: true },
  });
  expect(settings.ok(), 'disposable admin must enable the optional notice').toBe(true);

  await authenticatedPage.evaluate(() => localStorage.removeItem('privacy-notice-seen'));
  await authenticatedPage.reload({ waitUntil: 'domcontentloaded' });

  // A new synthetic member has unfinished onboarding; the Radix backdrop is
  // present at the same time as the informational privacy notice.
  await expect(authenticatedPage.locator('.fixed.inset-0.z-50')).toBeVisible();
  const notice = authenticatedPage.locator('[role="dialog"][aria-label="Privacy notice"]');
  await expect(notice).toBeVisible({ timeout: 15_000 });
  // Playwright deliberately uses a normal click; no force, DOM dispatch or bypass.
  await notice.getByRole('button', { name: 'Got it', includeHidden: true }).click();
  await expect(notice).toHaveCount(0);
});
