# Gamification API (release integration candidate, #107)

Requires #2 capabilities. When explicitly configuring capabilities, add `gamification` to **both**
`SQUARE_CAPABILITIES` (API) and `NEXT_PUBLIC_SQUARE_CAPABILITIES` (Web), then rebuild the Web app.
Leaving both variables unset enables all capabilities by default.
Without it, all `/api/gamification/**` endpoints return 404.

The ledger and inventory live in Square's database. Every balance change creates
an immutable `GameTransaction`; the wallet cache is atomically maintained.
The migration adds database checks preventing negative balances.

## Flow

1. An authenticated **ADMIN** defines a reward with `POST /api/gamification/admin/rewards`:
   `{"code":"sample-action","amount":10}`.
2. A trusted administrator issues a reward to a known member using
   `POST /api/gamification/admin/events`:
   `{"userId":"...","rewardCode":"sample-action","eventKey":"external-app:event-123"}`.
   Repeating the same user/eventKey/rewardCode returns `duplicate:true` without re-crediting.
   A reused key for a different reward is rejected.
3. An ADMIN creates a product at `POST /api/gamification/admin/items` with
   `{"name":"Profile badge","price":5,"cosmetic":true}`.
4. A signed-in member calls `POST /api/gamification/purchase` with
   `{"itemId":"...","requestKey":"checkout-123"}`. Repeating the same purchase returns
   `duplicate:true`. An already-owned item cannot be purchased again.
5. Members inspect `GET /api/gamification/wallet`, `/transactions`, `/inventory` and `/items`.
   Member IDs are derived from the JWT, never trusted from client input.

Only administrators can issue reward events or configure rewards/items.
Third-party applications need a trusted server-side integration that authenticates
with appropriate admin privileges; **do not expose admin credentials to clients**.
Application-specific reward eligibility stays outside Square.

This candidate includes scoped application issuers. PostgreSQL, migration and
headless Playwright verification are automated in PR CI; see the latest SHA-specific
workflow runs before treating a candidate as validated. Refunds and item quantities are not supported. Do not apply the
migrations to a production database before isolated rehearsal and approval.

## Restricted application reward issuers (experimental)

A server-to-server issuer may POST `/api/gamification/issuer/events` with
`Authorization: Bearer <secret>` and the existing event body
(`userId`, `rewardCode`, `eventKey`). Configure only on the Square API
server using `SQUARE_REWARD_ISSUERS`, a JSON array of objects:

```json
[{"id":"learning","tokenSha256":"<sha256-hex-of-random-secret>","rewardCodes":["completed"]}]
```

Use a cryptographically random 32+-character token, retain the original token
only in the trusted application backend, and store only its SHA-256 digest in
Square's configuration. The issuer identity is prefixed to the event key, so
independent issuers cannot collide on their own event IDs. Unconfigured,
invalid, unknown, or out-of-scope issuers fail closed. Tokens are not account
JWTs and **must never reach browsers/mobile application binaries**.

This only authenticates the calling backend and its allowed reward codes.
The backend must independently verify that each submitted achievement is real
before awarding; Square cannot judge application-specific learning completion.
Issuer secrets must be rotated/revoked via server config and server restart.
The capability guard still blocks the API when gamification is disabled.

**Before production:** validate issuer credential rotation and revocation against
running processes, evaluate rate limits and key management, verify no credentials
are logged or exposed by clients, and complete separate release/security review.

## External issuer integration contract (#69)

The game/backend owns the decision whether an action is eligible for a reward.
Use an internal authenticated participant identity from the application server,
mapped to the correct Square `userId`. Never accept an arbitrary target user ID,
reward code or reward-event key solely from a browser request. The trusted
application server calls:

```http
POST /api/gamification/issuer/events
Authorization: Bearer <server-only-issuer-token>
Content-Type: application/json

{"userId":"<square-user-id>","rewardCode":"completed","eventKey":"task:stable-attempt-id"}
```

Use the same deterministic event key for all retries of the *same* completed
action. Issuer IDs are prefixed by Square, and `(userId,eventKey)` is unique.
A retry of the same event returns `duplicate:true`; reuse with another reward
code is rejected. Issuers must not repurpose a completed event key. An
application should reconcile interrupted delivery by safely retrying the same
event after validating its durable source record. The event key is limited to
128 characters at the HTTP boundary, including no issuer prefix; the issuer
prefix is added internally.

For credential rotation, provision a replacement token using a **new issuer ID**
and change the backend configuration atomically before revoking the previous
entry. Preserve the old issuer ID when possible by replacing its digest after
cutover; otherwise retries after switching issuer identity can create duplicate
events because idempotency is scoped to issuer ID. Choose a maintenance window
or explicit deduplication policy when changing issuer IDs. Revocation removes
the entry from the Square API server configuration and restarts the affected
processes. Issuer IDs and token digests must be unique within the configuration;
shared credentials or duplicate IDs are rejected.

Before adoption, verify `prisma migrate deploy` and a rollback/backup rehearsal
in an isolated disposable PostgreSQL instance. Re-run the focused issuer HTTP,
authentication, capability-disabled, reward concurrency and purchase integrity
tests at the exact current commit. A successful unit test alone does not prove
a live migration or user-facing end-to-end readiness.

## Exact candidate verification (2026-10-31)

On Square PR #108 commit `1aab28c82190f48a576945c71ce73ef49bc660fe`,
all of the following GitHub Actions completed successfully:

- [Headless Playwright #102, run 41191112488](https://github.com/fgna/square/actions/runs/41191112488): dedicated synthetic member login, disabled-capability API denial, trusted issuer reward, idempotent retry, purchase/equipment and re-login persistence.
- [Private integration validation, run 41191112491](https://github.com/fgna/square/actions/runs/41191112491): API/Web builds and tests, isolated PostgreSQL regressions, baseline task-history migration, economy data seeding and repeat-migration preservation of wallet balance, ledger, purchases, inventory and equipment.
- [Release-history gate, run 41191112557](https://github.com/fgna/square/actions/runs/41191112557): required changelog entry.

The Playwright workflows start their own ephemeral PostgreSQL, Redis, real API/Web
processes and headless Chromium. They do not need the operator's server, and
never use live member accounts. Full consumer-owned **task completion → reward**
integration must be verified in the consuming application, which decides
eligibility and invokes the issuer; Square's generic issuer cannot independently
validate a math answer. In Turbo Mathe, that adapter lives in
`plugins/turbo-mathe/api/index.ts`. Do not claim this part passed merely
because the Square issuer endpoint is exercised.

Publication, real-data migration, rollback/restore and the deployment security
gates remain subject to separate authorization and proof. This section records
verified candidate evidence only and is not a release approval.
