import { test, expect } from './authenticated.fixture';

// Consumer regression: the plugin uses Square's shared browser login fixture.
// Run only against an authorized instance with Turbo Mathe installed.
test('Turbo Mathe: Blitzblick repeat reveal works four times', async ({ authenticatedPage: page }) => {
  const base = process.env.SQUARE_TEST_URL;
  if (!base) throw new Error('SQUARE_TEST_URL is required');
  const origin = new URL(base).origin;
  await page.goto(new URL('/p/turbo-mathe/ueben/1', origin).href);

  const privacyDialog = page.getByRole('dialog', { name: 'Datenschutzhinweis' });
  const firstGrade = page.getByRole('button', { name: 'Klasse 1' });
  const roundStart = page.getByRole('button', { name: /Los geht.s!/ });
  const question = page.getByRole('region', { name: 'Aufgabe' });
  await expect(firstGrade.or(roundStart).or(question).first()).toBeVisible({ timeout: 15000 });
  if (await privacyDialog.isVisible()) {
    // The plugin shell can intercept pointer events over the privacy dialog.\n    // Activate the actual button handler without relying on hit-testing.\n    await privacyDialog.getByRole('button', { name: 'Verstanden' }).evaluate((button: HTMLButtonElement) => button.click());\n    await expect(privacyDialog).toBeHidden({ timeout: 10000 });
  }
  if (await firstGrade.isVisible()) {
    await firstGrade.click();
    await expect(roundStart).toBeEnabled();
    await roundStart.click();
    await expect(firstGrade).toBeHidden({ timeout: 15000 });
  }
  if (await roundStart.isVisible()) {
    await roundStart.click();
  }
  await expect(question).toBeVisible({ timeout: 15000 });
  const repeat = page.getByRole('button', { name: /Nochmal zeigen/ });
  await expect(repeat).toBeVisible();
  await expect(question.locator('.tt-cover')).toBeVisible({ timeout: 6000 });
  for (let i = 0; i < 4; i++) {
    await expect(repeat).toBeEnabled();
    await repeat.click();
    await expect(question.locator('.tt-cover')).toBeHidden();
    await expect(question.locator('.tt-row .tt-cell').first()).toBeVisible();
    await expect(question.locator('.tt-cover')).toBeVisible({ timeout: 6000 });
  }
});
