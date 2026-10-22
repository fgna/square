# Migration-first cutover plan (2026-10-12)

**Status: execution started, not approved for production.** Keep PR #9 in draft.
The objective is a reproducible, isolated neutral installation with a verified
and reversible import, not additional cosmetic feature parity.

## Binding execution order

1. **P0 #16 / #15 — clean Prisma install.** Identify the entire ordering
   chain, not only the first failing SQL statement. Choose and review a
   compatibility-safe baseline strategy. Verify `prisma migrate deploy` in a
   disposable empty PostgreSQL, schema parity with `schema.prisma`, existing
   installation upgrade compatibility, and failure recovery. Never rewrite
   applied migrations without an explicit versioned compatibility decision.
   `prisma db push` remains a disposable demo workaround, not acceptance.
2. **P0 #11 — isolated deployment.** Actual API/Web containers, healthchecks,
   separate Postgres/Redis, secrets, TLS, volumes, backups and restore drill.
   Compose config validation and adversarial Docker-secrets tests must pass.
3. **P0 #18 — authenticated HTTPS acceptance.** Login, refresh after reload,
   logout, admin denial and legitimate admin access, members, feed, messages,
   groups, courses, RSVP, journal/assessment, settings and privacy. Capture
   positive and negative evidence; no inferred acceptance from unit tests.
4. **P0 — migration rehearsal.** On independently owned **disposable** target
   only: snapshot source with explicit read authorization, deterministic mappings
   for users/content/relationships, count and referential-integrity comparison,
   media checksums, dry-run report, idempotency and rollback. Never mutate the
   source or make a real cutover without a separate authorization gate.
5. **P1 #17 — Android delivery**, once the new origin and auth endpoints are
   stable. Validate build/signing/install separately.

## Current hard blocker: historical migration ordering

`20260621000002_add_course_notes_and_has_introduced` performs a backfill
filtered by `Post.type = 'INTRODUCTION'`. The isolated empty-database rehearsal
proved that `Post.type` was **not yet present** at that point and failed with
P3018 / SQLSTATE 42703. This file is historical and must not be silently
edited; doing so would change Prisma migration checksums on existing sites.
The immediate engineering task is to inventory the full dependency chain and
decide between a reviewed clean-install baseline and a compatibility-safe
transition. No production database is available or needed for this analysis.

## Acceptance evidence, not assumptions

- Existing local web check: static i18n key audit 0 missing, parity 0, targeted
  notification 5/5 and web typecheck PASS at `b2186fd`.
- API individual cases previously passed but full API suite remains blocked by
  absent *real* deployment files required by #11.
- Successful local `db push`, a generated schema, successful web build, and
  unit tests do **not** establish clean `migrate deploy`, deploy safety,
  import integrity or authenticated browser parity.

Track each gate's verified revision, commands, output, environment, data safety,
and unresolved limitations in the corresponding GitHub issue before advancing.

## Verified source-order finding — 2026-10-12

On independent Linux at `30589af`, read-only inventory scanned 41 migrations and found the `INTRODUCTION` backfill in `20260621000002_add_course_notes_and_has_introduced` but **no `Post.type` DDL definition**. The scanner flags `backfillBeforeDefinition: true`, consistent with the earlier clean PostgreSQL P3018 / SQLSTATE 42703. This means the historical chain is unsuitable for a fresh installation without a reviewed remedy; it does **not** prove all other migration issues are absent. Never mutate the historical file to make it pass on new installations: this alters migration checksums for existing deployments.

Next: design a separate **fresh-install baseline** generated from the reviewed current schema (retaining upgrade history for existing installations), validate real Prisma migrate deploy on a disposable clean DB and compare schema, then test existing-install upgrade compatibility. Avoid `db push` as production remediation. Do not deploy until #11 security is independently checked.

## Review-only baseline candidate generator (2026-10-12)

`scripts/generate-fresh-baseline-candidate.sh [output-directory]` creates a new
**unapplied SQL candidate** using Prisma 6 `migrate diff --from-empty
--to-schema-datamodel ... --script`. It requires Node 22 and Corepack, writes
only to a previously nonexistent directory outside the historical migrations,
records input/output SHA256, and does not connect to any DB. It is intentionally
not a deploy operation. The default directory under `.local-community` must
remain ignored/private and must be generated on the isolated Linux test host.

This candidate alone does **not** solve the existing-install migration ledger.
The next engineering gate is to compare candidate SQL with real production
schema semantics and preserve existing Prisma `_prisma_migrations` history.
A separate freshly initialized migration namespace/history may be required for
new instances; mixing a new baseline with the 41 applied legacy files is not
approved. Test on a disposable PostgreSQL with deliberate, unrelated credentials.
Never use `prisma migrate resolve` to fake a completed migration.

## Immediate priority override — existing LAN demo restoration (2026-10-12)

The user clarified that the immediate deliverable is **the previously launched
isolated Community test installation working again, including the UI**. This
supersedes the earlier clean-install production migration critical path for
short-term execution. Restore and repair the existing test installation first:
check running services/ports and HTTPS, diagnose login/401 and broken rendered
pages, fix functional blockers, run only focused checks, and then revisit
production `migrate deploy`, baseline, deployment hardening, and data cutover.

**Safety:** never touch other community containers, do not delete volumes or
secrets, do not run `docker compose down -v`, do not blindly re-run the current
`dev-instance-up.sh` over running processes (it rejects occupied ports and
uses schema push), and do not infer UI correctness from builds or unit tests.
Current-state reconnaissance must be read-only before any restart or schema
operation. User will supply direct UI screenshots or a concise status output
only if a repair cannot be fully verified through code inspection.
