# Functional parity gap review — original community vs neutral Core

> **Current acceptance source (2026-10-12):** [Original-to-Core functional acceptance matrix](ORIGINAL-CORE-ACCEPTANCE.md). This file preserves historical findings; the matrix supersedes outdated provisional states below. Do not infer that previously unverified journeys have passed.

Date: 2026-10-11. **Structural audit plus first independent Linux/LAN smoke; not a completed feature-by-feature E2E audit.**

## Scope and evidence
Compared Git tree of the privately reviewed functional baseline (638 blobs) against
`fgna/community-platform-core@migration/neutral-full-platform` (522 blobs).
Also inspected selected source, the Core README and screenshots/HTTP+API logs
from the independent instance on `192.168.1.121`.

**Equivalence target:** Preserve all generic community functionality, member
and admin workflows, Android app support and operability. Protected, branded
method content must stay outside generic Core; substitute configurable
private method packs and preserve user-facing behavior rather than copying
old wording, seeds or proprietary score definitions.

## Findings

| Capability | Evidence | Status / closure condition |
| --- | --- | --- |
| Sign in/register, identity, roles | Backend/Web modules present; initial registration/login appears to work in browser | **Partial**: protected calls turned 401 after navigation/reload. Confirm cookie/session refresh in same-origin HTTPS and true clean login/logout/reload. |
| Feed, members, posts, messages, groups | Most original modules/routes retained; Prisma queries reached API | **Code present, E2E not proven**: test create/read/update/post permissions, membership and messaging. 401 currently blocks trusted parity claim. |
| Courses, lessons, progress, events, RSVP, recordings | Original modules/routes retained | **Code present, E2E not proven**: test empty-state, create/publish/enroll/RSVP/admin operations. |
| Dashboard, challenges, goals, notifications | Modules retained; dashboard mobile screenshot | **Partial**: raw translation keys resolved in stages, API dashboard calls returned 401 after refresh. |
| Categories administration | Neutral admin CRUD page restored from generic original, with branded placeholder strings replaced and full DE/EN admin copy | **Code now restored**: browser and permission checks still pending; API/back-end interactions not yet certified. |
| Assessment questions administration | Original `apps/web/src/app/(admin)/admin/assessment/page.tsx` omitted because it hardcodes a branded six-dimension method; pack/admin backend was changed | **Functional gap by design**: deliver neutral instrument/pack configuration UI and access controls, not original proprietary fields. |
| Assessment and journal | New pack validators/loaders and bilingual Focus/Recovery synthetic pack present; first assessment page rendered | **Partial**: complete question-submit-result/history, journal persistence, switching method packs, translations and safe failure modes under private active instance. |
| DE/EN UI | Many missing namespaces discovered only after live browser smoke (`landingUI`, `nav`, `dashboard`, `assessment`, `getAppUI`, `privacyNotice`); targeted additions made | **Partial**: comprehensive useTranslations coverage audit is required, not additional ad-hoc key repair. Synthetic example translations must not override platform auth/nav. |
| Android wrapper and download | 32 Android files in original; **zero** in neutral Core. Legacy wrapper has Gradle/JDK setup, WebView origin protection and signing scripts. Core route returns 404 without APK | **Major gap**: reviewed neutral reusable Android wrapper, trusted LAN HTTPS, build/sign/publish, on-device install and update checks. Current temporary Android source adapter is not release equivalence. Track #17. |
| HTTPS/LAN | Old deployment has Nginx/proxy/certbot and LAN Android CA procedures; Core recently added local Caddy 3443 prototype | **Unverified**: Caddy proxy reachability, local CA trust on browser/Android, same-origin API, no unintended public listeners; official production HTTPS still missing. |
| Fresh database migrations | Original has 50 Prisma-related files; Core 43. Excluded original migration adds `Post.type` plus branded seed categories; separate journal+assessment seed migrations also excluded | **Blocker**: fresh `prisma migrate deploy` fails P3018 when later backfill expects `Post.type`. Isolated dev uses `db push`, not a solution for upgrade/production. Track #16. |
| Backups, restore, deployments | Original has 17 scripts, Core only four; `backup.sh`, `restore.sh`, `preflight-production.sh`, `publish-android-apk.sh`, Nginx templates missing | **Major operations gap**: restore safe generic, secret-aware deployment/backup and release flow. Track #11. |
| Security, privacy, rights | Core independent history and neutral synthetic examples; partial pattern scan, no full signoff | **Release blocker**: repeat independent privacy/licensing/asset analysis and deployment-specific adversarial tests, #6/#11. |
| Automated tests | Local API 399/399, Web 134/134 on earlier revision; focused bilingual integration 7/7; hosted Actions quota exhausted | **Useful but insufficient**: latest HTTPS/Auth/UI changes untested and browser readiness is not proven. |

## Source-layout observations (not functional test results)

- `apps/api/src/`: original 207 blobs / core 215; seven original files missing including branded `assessments/growth-canon.ts` and five original test files plus categories test.
- `apps/web/src/`: original 205 / core 211; original admin category and admin assessment pages omitted. The branded radar was replaced with generic radar.
- `apps/mobile-android/`: original 32 / core 0.
- `apps/api/prisma/`: original 50 / core 43, including three deliberate seed-bearing migration exclusions and missing `migration_lock.toml`.
- `scripts/`: original 17 / core 4; `docs/`: original 18 / core 2; `nginx/`: original 3 / core 0.
- File counts alone **do not** prove parity; this report identifies clear omissions and risk areas, not an exhaustive UI/REST matrix.

## Priority and acceptance strategy

P0: Restore reliable authenticated browsing/reload after HTTPS transition, and
validate actual page-to-API traffic from mobile. Then check main member routes
against old repository using a short, repeatable smoke matrix.

P0: Fix schema migration history with clean database `migrate deploy` while
keeping branded seed data outside Core. Add reviewed neutral Android APK and
test same-origin HTTPS & installer flow, without compromising release security.

P1: Verify restored generic admin categories CRUD and implement *configurable* assessment pack
management (not the old branded hardcoded editor). Audit all UI translation
namespaces against source uses and resolve remaining gaps.

P1: Restore necessary neutral backup/restore, deployment and security gates.

**Non-goals:** importing original repo history, proprietary questionnaires,
old customer test data, secrets, debug APK as public release, production merge
or infrastructure changes. Keep PR #9 draft until explicitly accepted.

## Work completed after initial audit (2026-10-11)

- Added private-LAN HTTPS gateway (Caddy `tls internal`) and localhost-only API/Web binding. HTTPS `/health` and `/login` must pass before launcher declares success. Pending independent Android/browser CA trust and authenticated refresh test.
- Reused old Android wrapper through a temporary sparse checkout; HTTPS-only debug builder outputs to gitignored directory for local instance. Build and on-device install still pending. No release distribution.
- Restored generic `/admin/categories` CRUD page and bilingual labels, eliminating hard-coded branded sample placeholder. Admin permission and live data verification pending.

## Auth recovery change (2026-10-11)

- The Axios 401 handler previously gated refresh on Zustand `isAuthenticated`. Immediately after page reload, persisted store hydration may not have finished, even when a valid httpOnly refresh cookie exists. Removed this precondition: on protected API 401, the server-side refresh cookie now determines whether renewal is possible.
- Explicitly exempted login, registration and OAuth sign-in 401 responses from refresh attempts. Invalid credentials remain visible on the login form rather than triggering a spurious redirect.
- Added regression tests for public login 401 and protected request 401 with `isAuthenticated: false`.
- **Verification outstanding:** the new tests and application typecheck have not yet been executed on an independent checkout, and the root cause of the observed LAN 401s remains to be confirmed by a live cookie/HTTPS trace. Do not mark browser authentication parity complete solely from this code change.

## Neutral assessment administration (2026-10-12)

- Added `/admin/assessment` read-only instrument overview. It fetches the active instance-specific assessment questions through existing pack-mode administration endpoints, grouped by dimension, and provides a clear DE/EN message that edits belong in the external validated content pack. No branded questionnaire or DB-question editor was copied into Core.
- Corrected a security gap: `AssessmentsController` previously declared `@Roles('ADMIN')` on admin endpoints but its class only used `JwtAuthGuard`, with no global RolesGuard in `AppModule`. Added `RolesGuard` after JWT auth and a regression test that verifies the role annotations and attached guard.
- **Validation pending:** independent API/Web tests and builds on this new revision, plus browser/admin access checks (admin allowed; regular member forbidden). This implementation restores read-only visibility, **not** a full GUI for authoring, validating or activating method packs.

## Bilingual audit triage (2026-10-12)

- Local run on `52f993e`: API admin security 4/4, API typecheck/build, Web 142/142, Web typecheck/build all PASS; new `/admin/assessment` route emitted in Next build.
- Initial translation inventory printed 218 `missing` records and 27 dynamic calls. This number includes false positives from interpolated template expressions, e.g. ``t(`feed.forum.tabs.${key}`)``; it is not a verified defect count. Audit script now classifies interpolated template literals separately (commit `69b862b`).
- Confirmed platform-owned journal status strings were absent from both generic catalogs. Added `journal.methodConfigLoading` and `journal.methodConfigError` in German and English (commits `1be2cc6`, `63fd8a7`).
- `assessment.scale`, `assessment.dimensions`, and related method-owned messages are governed by the external content-pack validator; automated fixes must not invent questionnaire/method copy or weaken pack completeness validation.
- **Still required:** rerun the corrected inventory and inspect remaining static missing keys plus dynamic calls; execute latest tests/builds; validate runtime browser sessions and permissions. No production release.

## Generic missing translation keys (2026-10-12)

Linux source inventory found 128 reported missing occurrences (duplicates across locales and call sites) and 70 dynamic expressions. Reviewed and supplied missing neutral UI copy in both languages for navigation, privacy notice, goals, explore categories, journal controls/states and AI category landing. The previous assessment UI also referenced nested `assessment.scale.na` and `assessment.scale.${n}`, but the validated method-pack contract defines `assessment.scale` as a scalar. Replaced the unavailable option with a separate neutral label and numeric choices with their actual numerical values, avoiding fabricated method-specific scale explanations. No questionnaire copy or external pack ownership transferred into Core. Latest branch requires local audit/build rerun; no browser E2E sign-off.

## Axios session regression coverage correction (2026-10-12)

The original two added 401 tests were erroneously declared inside `vi.mock('axios', ...)`, not inside the executed Vitest suite. Previous reports of 4 passing API-client tests therefore did **not** validate incorrect-credential 401 handling or initial reload refresh behavior. Commit `8abfdb7` relocates them into the registered `api-client` suite. Expect six tests after the next independent local run; until confirmed, session recovery remains unverified.
