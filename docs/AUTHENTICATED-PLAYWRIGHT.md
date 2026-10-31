# Authenticated headless browser checks (Square #102)

This test-only fixture signs in a dedicated synthetic member using the **real Square login form**. It does not create accounts, bypass auth, touch real member data, or deploy a candidate.

## One-time setup (authorized operator)

1. Provision or reuse a **dedicated synthetic member** on an isolated test instance through the instance's existing admin/invitation/registration flow. Use a unique account reserved for tests, not a real learner. Give it only the minimum member role.
2. Confirm that the test executor can reach the verified candidate instance over HTTPS and trusts any private Caddy test CA at the OS/browser level. An SSH tunnel or a headed browser is unnecessary when the instance is reachable by the executor.
3. Store the instance origin, account email and password in private runner environment/secrets. Never commit them, paste them into Issues, or include them in traces/artifacts.

Required environment variables: `SQUARE_TEST_URL` (origin, e.g. `https://test.example.invalid`), `SQUARE_TEST_EMAIL`, `SQUARE_TEST_PASSWORD`. Optional `SQUARE_TEST_LOGIN_FRAME` is the CSS selector of a same-origin or cross-origin iframe containing Square's normal email/password login form. Omit it for Square-hosted login. Frame navigation and cookies remain subject to the actual browser security model.

## One-command invocation

From the Square repository root with Node.js 22 and pnpm/Corepack installed:

```bash
corepack pnpm --filter @community/web exec playwright test --config=e2e/playwright.auth.config.ts
```

Bootstrap on a fresh executor first with `corepack enable && corepack pnpm install --frozen-lockfile && corepack pnpm --filter @community/web exec playwright install --with-deps chromium`. For systems using nvm, run `nvm use` first (Square's `.nvmrc` is 22). Do not run Chromium in headed mode on a server without X.

Missing variables, credentials, network access, a working Chromium install, or a successful normal login cause a **failed test**, never an implicit skip. No environment values are printed by the fixture. The dedicated Playwright config disables screenshots, video and tracing to avoid persisting member sessions.

## Consuming from an instance/plugin regression

In a test file in `apps/web/e2e/`:

```ts
import { test, expect } from './authenticated.fixture';

test('plugin screen is reachable for the synthetic member', async ({ authenticatedPage }) => {
  await authenticatedPage.goto(new URL('/your-plugin-route', process.env.SQUARE_TEST_URL).href);
  await expect(authenticatedPage.getByRole('main')).toBeVisible();
  // Add plugin-specific behavioral assertions here.
});
```

Plugins own their own behavioral assertions. If a plugin renders a login form in an iframe, set `SQUARE_TEST_LOGIN_FRAME` to that frame selector. If login is Square-hosted, leave it unset. A plugin may import this fixture in its own Playwright project if its tooling resolves `@playwright/test`.

Before merging a behavior fix to `main`, deploy its **exact candidate SHA** to an authorized isolated test instance, independently verify the served revision, then run the generic smoke and the plugin-specific regression together. Record the SHA and the results on the relevant PR. This issue does **not** authorize deployment, instance mutation, synthetic account creation in production, or automatic destructive cleanup.

For a Nightly executor, configure network access and private secret injection in that executor's authorized runtime. Nightly must fail if any required runtime prerequisite is missing; it must not report a green test based only on compiling these files.
