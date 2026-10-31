import { test as base, expect, type Page } from '@playwright/test';
import { createHash, randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync, chmodSync } from 'node:fs';
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

function localAccountFile(origin: string): string {
  const hash = createHash('sha256').update(origin).digest('hex').slice(0, 12);
  return join(homedir(), '.config', 'turbo-mathe', `playwright-account-${hash}.json`);
}

function account(origin: string): { email: string; password: string; newlyGenerated: boolean; file?: string } {
  const email = process.env.SQUARE_TEST_EMAIL;
  const password = process.env.SQUARE_TEST_PASSWORD;
  if (email || password) {
    if (!email || !password) throw new Error('Both SQUARE_TEST_EMAIL and SQUARE_TEST_PASSWORD are required');
    return { email, password, newlyGenerated: false };
  }
  const file = localAccountFile(origin);
  if (existsSync(file)) {
    const data = JSON.parse(readFileSync(file, 'utf8'));
    if (typeof data.email !== 'string' || typeof data.password !== 'string') throw new Error('Invalid synthetic account file');
    return { ...data, newlyGenerated: false };
  }
  if (process.env.SQUARE_TEST_ALLOW_SIGNUP !== '1') {
    throw new Error('No synthetic member exists. Set SQUARE_TEST_ALLOW_SIGNUP=1 only for an authorized isolated signup-enabled test instance');
  }
  return {
    email: `square-playwright-${randomBytes(10).toString('hex')}@example.test`,
    password: 'T' + randomBytes(24).toString('base64url') + 'a9!',
    newlyGenerated: true,
    file,
  };
}

function persistAccount(file: string, data: { email: string; password: string }): void {
  const dir = join(homedir(), '.config', 'turbo-mathe');
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  const temp = file + '.tmp-' + process.pid;
  writeFileSync(temp, JSON.stringify(data), { mode: 0o600, flag: 'wx' });
  renameSync(temp, file);
  chmodSync(file, 0o600);
}

export const test = base.extend<{ authenticatedPage: Page }>({
  authenticatedPage: async ({ page }, use) => {
    const origin = testOrigin();
    const member = account(origin.origin);
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
        await expect(page).not.toHaveURL(/\\/register(?:[/?#]|$)/, { timeout: 15000 });
        phase = 'registration session';
        await expect.poll(async () => (await page.context().cookies(origin.origin))
          .some(cookie => cookie.name === 'auth-session' && cookie.value === '1'), { timeout: 15000 }).toBe(true);
        persistAccount(member.file!, member);
      } else {
        phase = 'login';
        const login = new URL(loginPath, origin);
        if (loginPath === '/login') login.searchParams.set('from', target.pathname);
        await page.goto(login.href, { waitUntil: 'domcontentloaded' });
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
      await expect(page).not.toHaveURL(/\\/login(?:[/?#]|$)/);
    } catch {
      throw new Error(`Square authentication failed during ${phase}. Check TLS trust, normal signup/login, member credentials and enabled protected route. No credentials are logged.`);
    }
    await use(page);
  },
});

export { expect };
