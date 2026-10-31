# Authenticated headless browser checks (Square #102)

This test-only fixture signs in a dedicated synthetic member using the **real Square login form**. It can create an isolated synthetic account through normal registration only when the operator explicitly enables `SQUARE_TEST_ALLOW_SIGNUP=1`. It never bypasses auth or deploys a candidate.

## One-time setup (authorized operator)

1. Provision or reuse a **dedicated synthetic member** through normal login, or set `SQUARE_TEST_ALLOW_SIGNUP=1` on a deliberately authorized isolated signup-enabled test instance to create one on the first run. The generated credentials are saved in `~/.config/turbo-mathe/playwright-account-<origin-hash>.json` with file mode 0600, matching the Turbo Mathe #52 mechanism. Use a unique account reserved for tests, not a real learner. Give it only the minimum member role.
2. Confirm that the test executor can reach the verified candidate instance over HTTPS and trusts any private Caddy test CA at the OS/browser level. An SSH tunnel or a headed browser is unnecessary when the instance is reachable by the executor.
3. Store the instance origin, account email and password in private runner environment/secrets. Never commit them, paste them into Issues, or include them in traces/artifacts.

Optional `SQUARE_TEST_PROTECTED_PATH` selects the authenticated protected route to validate (default `/dashboard`); use a known enabled plugin path if the dashboard is disabled on the instance. The runner includes `*.smoke.spec.ts` and `*.auth.spec.ts` scenarios under `apps/web/e2e`.\n\nRequired: `SQUARE_TEST_URL` (origin, e.g. `https://test.example.invalid`). Use either both `SQUARE_TEST_EMAIL` and `SQUARE_TEST_PASSWORD`, an existing saved synthetic account, or explicit `SQUARE_TEST_ALLOW_SIGNUP=1` on an isolated instance. Optional `SQUARE_TEST_LOGIN_PATH` selects a same-origin plugin login entry page (default `/login`); `SQUARE_TEST_LOGIN_FRAME` is the CSS selector of a same-origin or cross-origin iframe containing Square's normal email/password login form. Omit it for Square-hosted login. Frame navigation and cookies remain subject to the actual browser security model.

## One-command invocation

From the Square repository root with Node.js 22 and pnpm/Corepack installed:

```bash
corepack pnpm --filter @community/web exec playwright test --config=e2e/playwright.auth.config.ts
```

Bootstrap on a fresh executor first with `corepack enable && corepack pnpm install --frozen-lockfile && corepack pnpm --filter @community/web exec playwright install --with-deps chromium`. For systems using nvm, run `nvm use` first (Square's `.nvmrc` is 22). Do not run Chromium in headed mode on a server without X.

Missing instance configuration, synthetic account (unless opt-in registration is enabled), network access, a working Chromium install, or a successful normal login cause a **failed test**, never an implicit skip. The fixture reports the failing authentication phase without printing input values. Chromium must trust the instance's Caddy CA; do not use insecure TLS flags. The dedicated Playwright config disables screenshots, video and tracing to avoid persisting member sessions.

## Consuming from an instance/plugin regression

In a test file named `your-plugin.auth.spec.ts` in `apps/web/e2e/`:

```ts
import { test, expect } from './authenticated.fixture';

test('plugin screen is reachable for the synthetic member', async ({ authenticatedPage }) => {
  await authenticatedPage.goto(new URL('/your-plugin-route', process.env.SQUARE_TEST_URL).href);
  await expect(authenticatedPage.getByRole('main')).toBeVisible();
  // Add plugin-specific behavioral assertions here.
});
```

Plugins own their own behavioral assertions. If a plugin renders a Square login form in an iframe, set `SQUARE_TEST_LOGIN_PATH` to that plugin's login page and `SQUARE_TEST_LOGIN_FRAME` to its iframe selector. If login is Square-hosted, leave it unset. A plugin may import this fixture in its own Playwright project if its tooling resolves `@playwright/test`.

Before merging a behavior fix to `main`, deploy its **exact candidate SHA** to an authorized isolated test instance, independently verify the served revision, then run the generic smoke and the plugin-specific regression together. Record the SHA and the results on the relevant PR. This issue does **not** authorize deployment, instance mutation, synthetic account creation in production, or automatic destructive cleanup.

For a Nightly executor, configure network access and private secret injection in that executor's authorized runtime. Nightly must fail if any required runtime prerequisite is missing; it must not report a green test based only on compiling these files.
