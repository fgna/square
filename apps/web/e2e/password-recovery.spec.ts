import { test, expect } from '@playwright/test';

test('login offers recovery and unknown accounts receive generic confirmation', async ({ page }) => {
  await page.route('**/api/auth/password-reset/request', async route => {
    const body = route.request().postDataJSON();
    expect(body.email).toBe('unknown@example.org');
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ message: 'If an eligible account exists, a password reset email will be sent.' }) });
  });
  await page.goto('/login');
  await page.getByRole('link', { name: /forgot password|passwort vergessen/i }).click();
  await expect(page).toHaveURL(/\/forgot-password/);
  await page.getByLabel(/email|e-mail/i).fill('unknown@example.org');
  await page.getByRole('button', { name: /send reset link|reset-link senden/i }).click();
  await expect(page.getByRole('status')).toContainText(/eligible account|berechtigtes konto/i);
});

test('reset rejects expired tokens without exposing the supplied token in page error', async ({ page }) => {
  const token = 'a'.repeat(64);
  await page.route('**/api/auth/password-reset/confirm', async route => {
    expect(route.request().postDataJSON()).toEqual({ token, password: 'New-password-123' });
    await route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ message: 'Invalid or expired reset link' }) });
  });
  await page.goto('/reset-password?token=' + token);
  await page.getByLabel(/new password|neues passwort/i).fill('New-password-123');
  await page.getByRole('button', { name: /change password|passwort ändern/i }).click();
  const resetError = page.locator('p[role="alert"]');
  await expect(resetError).toContainText(/invalid or expired|ungültig oder abgelaufen/i);
  await expect(resetError).not.toContainText(token);
});

test('successful reset clears token from location and returns to sign in', async ({ page }) => {
  const token = 'b'.repeat(64);
  await page.route('**/api/auth/password-reset/confirm', async route => {
    expect(route.request().postDataJSON()).toEqual({ token, password: 'New-password-123' });
    await route.fulfill({ status: 200, contentType: 'application/json', body: '{"message":"Password updated"}' });
  });
  await page.goto('/reset-password?token=' + token);
  await page.getByLabel(/new password|neues passwort/i).fill('New-password-123');
  await page.getByRole('button', { name: /change password|passwort ändern/i }).click();
  await expect(page.getByRole('status')).toContainText(/password changed|passwort geändert/i);
  await expect(page).toHaveURL(/\/reset-password$/);
  await page.getByRole('link', { name: /back to sign in|zur anmeldung/i }).click();
  await expect(page).toHaveURL(/\/login$/);
});
