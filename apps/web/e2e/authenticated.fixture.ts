import { test as base, expect, type Page } from '@playwright/test';
import { mkdirSync, renameSync, writeFileSync, chmodSync } from 'node:fs';
import { testAccount } from './authenticated.accounts';
import { homedir } from 'node:os';
import { join } from 'node:path';

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing ${name}: configure the isolated test instance`);
  return value;
}

function testOrigin(): URL {
  const url = new URL(required('SQUARE_TEST_URL'));
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password ||
      url.pathname !== '/' || url.search || url.hash) {
    throw new Error('SQUARE_TEST_URL must be an http(s) instance origin without credentials');
  }
  return url;
}

function persistAccount(file: string, data: { email: string; password: string }): void {
  const dir = join(homedir(), '.config', 'turbo-mathe');
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  const temp = file + '.tmp-' + process.pid;
  writeFileSync(temp, JSON.stringify(data), { mode: 0o600, flag: 'wx' });
  renameSync(temp, file);
  chmodSync(file, 0o600);
}

export const test = base.extend<{ authenticatedPage: Page; syntheticAccountScope: string }>({
  syntheticAccountScope: ['', { option: true }],
  authenticatedPage: async ({ page, syntheticAccountScope }, use) => {
    const origin = testOrigin();
    const member = testAccount(origin.origin, syntheticAccountScope);
    const protectedPath = process.env.SQUARE_TEST_PROTECTED_PATH || '/dashboard';
    const loginPath = process.env.SQUARE_TEST_LOGIN_PATH || '/login';
    for (const path of [protectedPath, loginPath]) {
      if (!path.startsWith('/') || path.startsWith('//') || path.includes('\\\\') ||
          new URL(path, origin).origin !== origin.origin) {
        throw new Error('Test routes must be same-origin absolute paths');
      }
    }
    const target = new URL(protectedPath, origin);
    let phase = 'navigation';
    try {
      if (member.newlyGenerated) {
        phase = 'registration';
        await page.goto(new URL('/register', origin).href, { waitUntil: 'domcontentloaded' });
        await page.locator('#name').fill('Square Synthetic Browser Test');
        await page.locator('#email').fill(member.email);
        await page.locator('#password').fill(member.password);
        await page.locator('#confirmPassword').fill(member.password);
        await page.locator('button[type="submit"]').click();
        await expect(page).not.toHaveURL(/\/register(?:[/?#]|$)/, { timeout: 15000 });
        phase = 'registration session';
        await expect.poll(async () => (await page.context().cookies(origin.origin))
          .some(cookie => cookie.name === 'auth-session' && cookie.value === '1'), { timeout: 15000 }).toBe(true);
        persistAccount(member.file!, member);
      } else {
        phase = 'login';
        const login = new URL(loginPath, origin);
        if (loginPath === '/login') login.searchParams.set('from', target.pathname);
        await page.goto(login.href, { waitUntil: 'load' });
        // Wait until React has hydrated the form. Otherwise a fast headless
        // click may submit server-rendered markup before its login handler exists.
        if (!process.env.SQUARE_TEST_LOGIN_FRAME) {
          await page.waitForFunction(() => {
            const form = document.querySelector('form');
            return !!form && Object.keys(form).some(key => key.startsWith('__reactProps' + '$'));
          }, undefined, { timeout: 15000 });
        }
        const selector = process.env.SQUARE_TEST_LOGIN_FRAME?.trim();
        const form = selector ? page.frameLocator(selector) : page;
        await form.locator('input[type="email"]').fill(member.email);
        await form.locator('input[type="password"]').fill(member.password);
        await form.locator('button[type="submit"]').click();
        phase = 'login session';
        await expect.poll(async () => (await page.context().cookies(origin.origin))
          .some(cookie => cookie.name === 'auth-session' && cookie.value === '1'), { timeout: 15000 }).toBe(true);
      }
      phase = 'protected page';
      const response = await page.goto(target.href, { waitUntil: 'domcontentloaded' });
      if (!response || response.status() >= 400) throw new Error('Protected route unavailable');
      await expect(page).not.toHaveURL(/\/login(?:[/?#]|$)/);
    } catch (error) {
      const detail = error instanceof Error ? error.message : '';
      const diagnostic = /net::ERR_CERT_[A-Z_]+/.exec(detail)?.[0]
        || (/TimeoutError/.test(detail) ? 'TIMEOUT' : 'FORM_OR_SESSION_FAILURE');
      throw new Error(`Square authentication failed during ${phase} (${diagnostic}). Check browser TLS trust, form and synthetic account. No credentials are logged.`);
    }
    await use(page);
  },
});

export { expect };

