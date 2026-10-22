# Isolated runtime verification

The successful 533 application unit tests and production builds are not an
end-to-end proof of an independently configured community instance.

## Preflight

Only use a dedicated **disposable, isolated** PostgreSQL database and Redis
instance. No customer data, original service volumes, existing credentials,
original DNS names, or existing production ports. Provide a separate
`DATABASE_URL`, `REDIS_URL`, `JWT_SECRET`, `JWT_REFRESH_SECRET`,
`CORS_ORIGINS`, `API_PORT` and web `NEXT_PUBLIC_API_URL`.
Use loopback-only bindings. Generate random secrets and keep them outside git.

The API's `GET /health` verifies that the API can query PostgreSQL.
The web uses `NEXT_PUBLIC_API_URL` at build time: build against the
disposable API endpoint, not the original community. Avoid copying any
production .env files. Run Prisma migrations only after checking that the
configured database is disposable and empty.

The **synthetic sample content** lives in
`examples/neutral-method-pack`. For the API, point
`COMMUNITY_CONTENT_DIR` at its canonical absolute path; check the pack
inspection and assessment/journal endpoints as appropriate for the
authenticated test user. The web's `src/i18n/request.ts` now has an explicit **fail-closed**
private-pack activation gate. When `COMMUNITY_CONTENT_DIR` is set on the web
server it also requires `COMMUNITY_ASSESSMENT_DIMENSIONS` as a comma-separated,
deployment-controlled list matching the active instrument. It attempts full
DE/EN protected-method validation rather than silently falling back to the
generic catalogs. The core now includes synthetic neutral assessment/journal UI contracts
and a complete bilingual synthetic overlay. Its strict loader has a unit
activation test, including rejection of mismatched instrument dimensions.
**Live Next.js request activation is not yet verified in a running instance**;
web client rendering and active API instrument identity must also be checked
before production. Do not point production at this gate.

## Read-only HTTP smoke probe

With API/Web already running locally on disposable ports, execute:

```bash
bash scripts/smoke-isolated-instance.sh http://127.0.0.1:4301 http://127.0.0.1:4300
```

It refuses non-loopback URLs, performs only GETs, demands
`/health` reports healthy API and database, and verifies that the
web login page responds with HTTP 200. It does **not** exercise
registration, end-to-end auth, migrations, backups, private content
rendering or protection against tenant cross-contamination.

## Remaining acceptance gates

- Isolated database/Redis startup and migration evidence
- Successful loopback HTTP probe
- Authenticated API assessment/journal response from external neutral pack
- Web translation loading from external DE+EN pack with strict validation
- Full authenticated browser flow in disposable instance
- Real deployment security suite and backup/restore test (issue #11)
- Content/rights/security review before any production use
