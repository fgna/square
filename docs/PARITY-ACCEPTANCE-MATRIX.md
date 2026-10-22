# Original → neutral Core: functional acceptance matrix
Date: 2026-10-12. Status: **OPEN — parity has not been accepted**.

## Binding baseline and evidence rules

- Functional reference: the privately reviewed functional baseline (working original), including generic UX, routes, API semantics and member/admin workflows. No branded method text, private assets, secrets or user data are copied.
- Candidate: `fgna/community-platform-core@migration/neutral-full-platform`, draft PR #9.
- Existing independent demo: `https://192.168.1.121:4443` (private LAN/WireGuard, locally issued Caddy certificate; not a public release).
- **Code present ≠ parity verified.** `CONFIRMED` only with observed end-to-end use in the independent environment; `PARTIAL` means a narrower UI/API check exists; `UNVERIFIED` means implementation may exist without live proof; `BLOCKED` means a known missing/broken requirement. Each confirmed row needs date, revision, environment, actual result and any privacy-safe evidence.
- Screenshots, typechecks and unit tests prove only what they actually exercise. Never mark a complete flow verified because its landing page renders.
- Do not modify original production, import production data, run production migrations, reset demo DB or restart unrelated applications.

## MVP-1: usable neutral browser community

| ID | Original workflow to reproduce | Core evidence so far | State | Minimal browser acceptance | Tracker |
| --- | --- | --- | --- | --- | --- |
| A01 | Login / session / reload / logout | Member login and authenticated mobile navigation shown; reload/cookie renewal and logout not proven as one full flow | PARTIAL | Sign in as existing demo member → reload twice → feed still authenticated → log out → protected page requires login | #18 |
| A02 | Feed / discussion / comment | Feed module/routes structurally present; no creation or readback observed | UNVERIFIED | Post a neutral discussion, reload, comment, reload, verify authorship and permissions | #18 |
| A03 | Member directory / profiles | Member count 3 shown in admin; member directory workflow unverified | PARTIAL | Open member list, one profile and follow/unfollow, reload confirms expected state | #18 |
| A04 | Messages | Source routes present; no independent message send/receive demonstration | UNVERIFIED | Send one message between two demo members; recipient reads it, reload persists | #18 |
| A05 | Learning groups | Routes/modules appear preserved; no member/admin flow demonstrated | UNVERIFIED | Create group, invite/join other member, post message, verify membership | #18 |
| A06 | Courses / lessons / progress | Member/admin UI code present, admin shows zero courses; no learner progress demonstration | UNVERIFIED | Admin creates/publishes neutral course + lesson → member opens and completes → progress remains after reload | #18 |
| A07 | Events / RSVP / recordings | Admin shows zero events; routes present; RSVP and playback unverified | UNVERIFIED | Admin creates event → member RSVP → status persists and admin sees attendee; check recording only if original flow supports it | #18 |
| A08 | Journal | Mobile view rendered and simplified free-text 'Meine Gedanken' user-accepted; persistence/history not independently shown | PARTIAL | Enter thoughts → save → navigate away/reload → date/history readback matches input | #18 |
| A09 | Assessment | Five neutral dimensions and 10 DE/EN statements configured; mobile UI accepted; no full result/history readback proof | PARTIAL | Answer all questions in DE → submit → result → reload and view history; EN question presentation verified separately | #18 |
| A10 | Dashboard / profile / settings | Authenticated dashboard and settings displayed on mobile; write/read settings not verified | PARTIAL | Change non-sensitive profile preference, reload and verify; dashboard remains usable | #18 |
| A11 | Admin bootstrap / access | Admin provisioned in pre-existing demo and user confirmed real /admin login and assessment overview (2026-10-12) | CONFIRMED (access only) | Preserve evidence of role-restricted admin access; separately test member denied admin | #18 |
| A12 | Admin users / roles / categories | Stats 3 users and navigation shown; category CRUD page restored in code; writes/permissions not verified | PARTIAL | Admin open users and categories, create/edit category, verify readback; member cannot invoke admin API | #18 |
| A13 | Admin content / moderation | Routes/pages present; actions unverified | UNVERIFIED | Admin moderates seeded neutral discussion and reverses action; both member/admin views agree | #18 |
| A14 | DE/EN / method copy | Bilingual catalogs/audits/typecheck; German admin screenshot shows English assessment question text | PARTIAL | Switch DE ↔ EN on relevant member/admin screens and questions, no missing translation IDs or mixed-language questions | #18 |
| A15 | Privacy/account rights | Original generic privacy flows present in code, no live test | UNVERIFIED | Check privacy settings, own-data export and deletion behavior in disposable test account | #18 |
| A16 | Offline/notifications/secondary flows | Generic implementation not yet compared with original in an executable matrix | UNVERIFIED | Inventory original flows and add rows only for demonstrated scope-relevant gaps | #18 |

**Browser MVP acceptance gate:** A01 and A02 end-to-end, basic A11, and no blocking crash in member-facing A03/A06/A07/A08/A09. Full generic functional parity additionally requires observed core flows A03–A15 or explicit evidence-backed documented exclusions.

## MVP-2: independently operable platform (not required for MVP-1 browser smoke, required for full migration)

| ID | Original capability | Core current state | Release/parity gate | Issue |
| --- | --- | --- | --- | --- |
| O01 | Fresh database install and upgrading | **BLOCKED**: migration P3018, Post.type ordering; local demo uses isolated db push only | Fresh clean disposable migrate deploy and reviewed existing-install upgrade strategy | #16 |
| O02 | Production-style deployment / backups / restore | **BLOCKED**: reviewed generic runtime/recovery and security suite not complete | Dedicated instances, health/secrets, backup and verified restore | #11 |
| O03 | Neutral installable Android client | **BLOCKED**: original wrapper not reviewed/copied as deployable Core source; temporary adapter not parity | Neutral signed APK, same-origin trusted HTTPS, actual install/login/update test | #17 |
| O04 | Content ownership and security/release review | **BLOCKED**: no independent production approval | Rights/privacy/secrets/asset review and deployment tests | #6 / #11 |
| O05 | Generic method pack integration | **PARTIAL**: neutral five-dimension pack in live demo, pack revision lifecycle not accepted | Validated independent method pack, DE/EN parity, errors fail safely, no branded leakage | #13 |

## Runbook: how to advance one row

1. Compare **the original, working UX and API contract** for that exact row; record any differences without assuming all original content is reusable.
2. Exercise the minimal workflow on the **existing** Core demo, using only disposable neutral data; record revision/URL/real result.
3. If it works, mark the row confirmed with evidence. If it fails, identify **one** observed defect, fix it in Git in the smallest existing delivery issue and rerun only that workflow plus its necessary regression.
4. Do not implement feature enhancements as parity fixes. New admin assessment authoring (#19) and selectable locale administration (#20) are deferred backlog; they do not supersede the read-only neutral pack or core flows.
5. Stop additional tests/technical detours after two steps without measurable MVP acceptance movement. Return to the highest-priority unfinished user workflow.

## Evidence ledger

- 2026-10-12: Android screenshots of authenticated Core dashboard, journal, assessment and settings; user explicitly confirmed simplified journal UI. This proves rendering, **not** persistence.
- 2026-10-12: User successfully ran versioned default-admin bootstrap and confirmed admin login and /admin/assessment. Admin dashboard displayed three members, zero posts/courses/events.
- 2026-10-12: User pulled `e9d9326`, ran `bash scripts/dev-pnpm.sh --filter @community/web typecheck` successfully (`tsc --noEmit`). This is static validation, not browser acceptance.
- Pending: one real A01→A02 browser smoke (member login, reload, post/comment and logout). Until observed, MVP-1 is OPEN.

This matrix supersedes older file-count estimates and any narrative implying full parity from unit tests or page presence. See `docs/FUNCTIONAL-PARITY-GAPS.md` for the initial structural audit and `fgna/project-tracker#53` for outcome management.
