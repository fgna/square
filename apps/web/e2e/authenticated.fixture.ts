import { test as base, expect, type Page } from '@playwright/test';

/**
 * Use a dedicated synthetic member. Never log credential values or write browser
 * storage state/traces to artifacts: a live session may contain credentials.
 */
function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing ${name}: configure a private synthetic test account and instance URL`);
  return value;
}

export const test = base.extend<{ authenticatedPage: Page }>({
  authenticatedPage: async ({ page }, use) => {
    const instanceUrl = required('SQUARE_TEST_URL');
    const email = required('SQUARE_TEST_EMAIL');
    const password = required('SQUARE_TEST_PASSWORD');
    let origin: URL;
    try {
      origin = new URL(instanceUrl);
    } catch {
      throw new Error('SQUARE_TEST_URL must be a valid http(s) URL');
    }
    if (!['http:', 'https:'].includes(origin.protocol) || origin.username || origin.password || origin.search || origin.hash) {
      throw new Error('SQUARE_TEST_URL must be an http(s) instance origin without credentials or query parameters');
    }
    // Never use ignoreHTTPSErrors: an authorized executor must trust its test CA.
    const protectedPath = process.env.SQUARE_TEST_PROTECTED_PATH?.trim() || '/dashboard';
    if (!protectedPath.startsWith('/') || protectedPath.startsWith('//')) {
      throw new Error('SQUARE_TEST_PROTECTED_PATH must be an absolute path on the instance');
    }
    const target = new URL(protectedPath, origin);
    if (target.origin !== origin.origin) throw new Error('SQUARE_TEST_PROTECTED_PATH must remain on the Square instance');
    const loginPath = process.env.SQUARE_TEST_LOGIN_PATH?.trim() || '/login';
    if (!loginPath.startsWith('/') || loginPath.startsWith('//') || loginPath.includes('\\\\')) {
      throw new Error('SQUARE_TEST_LOGIN_PATH must be a same-origin absolute path');
    }
    const login = new URL(loginPath, origin);
    if (login.origin !== origin.origin) throw new Error('SQUARE_TEST_LOGIN_PATH must remain on the Square instance');
    if (loginPath === '/login') login.searchParams.set('from', target.pathname);
    let loginHttpStatus: number | undefined;
    let loginAttemptCount = 0;
    let failedLoginRequests = 0;
    page.on('request', request => {
      if (request.url().includes('/api/auth/login') && request.method() === 'POST') loginAttemptCount++;
    });
    page.on('requestfailed', request => {
      if (request.url().includes('/api/auth/login')) failedLoginRequests++;
    });
    page.on('response', response => {
      if (response.url().endsWith('/api/auth/login') && response.request().method() === 'POST') {
        loginHttpStatus = response.status();
      }
    });
    try {
      await page.goto(login.href, { waitUntil: 'load' });
      // Wait for React to attach the form handler before interacting. Clicking
      // server-rendered controls before hydration can silently reload the form.
      await page.waitForFunction(() => {
        const form = document.querySelector('form');
        return !!form && Object.keys(form).some(key => key.startsWith('__reactProps' + '$'));
      }, undefined, { timeout: 15000 });
      const frameSelector = process.env.SQUARE_TEST_LOGIN_FRAME?.trim();
      const form = frameSelector ? page.frameLocator(frameSelector) : page;
      await form.locator('input[type="email"]').fill(email);
      await form.locator('input[type="password"]').fill(password);
      await form.locator('button[type="submit"]').click();
      await expect.poll(async () => {
        const cookies = await page.context().cookies(origin.origin);
        return cookies.some((cookie) => cookie.name === 'auth-session' && cookie.value === '1');
      }, { timeout: 15000, message: 'Square sign-in did not establish an authenticated session' }).toBe(true);
      await expect(page).not.toHaveURL(/\/login(?:[/?#]|$)/, { timeout: 15000 });
    } catch {
      // Do not propagate third-party login messages, URLs or form values to logs.
      throw new Error('Square authentication failed (login requests: ' + loginAttemptCount + ', failed requests: ' + failedLoginRequests + ', HTTP status: ' + (loginHttpStatus ?? 'none') + '). Check instance reachability, test member credentials, login frame, TLS trust and browser installation.');
    }
    await use(page);
  },
});

export { expect };
));
      }, { timeout: 15000 });
      const frameSelector = process.env.SQUARE_TEST_LOGIN_FRAME?.trim();
      const form = frameSelector ? page.frameLocator(frameSelector) : page;
      await form.locator('input[type="email"]').fill(email);
      await form.locator('input[type="password"]').fill(password);
      await form.locator('button[type="submit"]').click();
      await expect.poll(async () => {
        const cookies = await page.context().cookies(origin.origin);
        return cookies.some((cookie) => cookie.name === 'auth-session' && cookie.value === '1');
      }, { timeout: 15000, message: 'Square sign-in did not establish an authenticated session' }).toBe(true);
      await expect(page).not.toHaveURL(/\/login(?:[/?#]|$)/, { timeout: 15000 });
    } catch {
      // Do not propagate third-party login messages, URLs or form values to logs.
      throw new Error('Square authentication failed (login HTTP status: ' + (loginHttpStatus ?? 'no request') + '). Check instance reachability, test member credentials, login frame, TLS trust and browser installation.');
    }
    await use(page);
  },
});

export { expect };
