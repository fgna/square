# Playwright test infrastructure policy (Square #102)

All authenticated browser regression tests in Square instances and installed plugins **must use the shared Square #102 fixture and runner**. Do not implement another browser login flow, inline credentials, authentication bypass, or per-plugin headless test configuration.

- Shared fixture: `apps/web/e2e/authenticated.fixture.ts` exposes `test`, `expect`, and `authenticatedPage`. Import from `./authenticated.fixture` in Square-hosted tests. Consumers in plugin repositories may import the exported fixture through their own supported test harness.
- Shared runner: `apps/web/e2e/playwright.auth.config.ts` discovers `*.auth.spec.ts` and `*.smoke.spec.ts` and enforces headless Chromium without session artifacts. Put behavioral plugin-specific assertions in their own `*.auth.spec.ts` test, using `authenticatedPage` for browser login.
- Use dedicated synthetic accounts and private runtime secrets, with `SQUARE_TEST_URL`, `SQUARE_TEST_EMAIL`, `SQUARE_TEST_PASSWORD`, plus optional protected route/login frame settings as specified in [AUTHENTICATED-PLAYWRIGHT.md](AUTHENTICATED-PLAYWRIGHT.md).
- CI discovery (`playwright test --list`) only validates test registration; it **does not count as an authenticated E2E pass**. Nightly/release acceptance requires execution against an isolated, verified candidate SHA. Missing URLs, secrets, Chromium or login must fail loudly, not be silently skipped.
- Test-only backend issuer/admin credentials for gamification remain private server-side inputs. No live member data, production deployment, destructive cleanup or changes to security gates are authorized by browser tests.

For Square #107, run the generic authenticated smoke plus the gamification `*.auth.spec.ts` scenarios with the #102 runner. The disabled-capability test uses a distinct disposable instance with gamification switched off. Only mark the release E2E gate passed after reporting the exact candidate SHA and actual browser results.
