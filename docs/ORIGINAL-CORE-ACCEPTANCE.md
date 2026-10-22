# Original-to-Core functional acceptance matrix

**Reference:** the privately reviewed functional baseline (working original).
**Candidate:** `fgna/community-platform-core@migration/neutral-full-platform`.
**Outcome:** `fgna/project-tracker#53`; delivery `fgna/community-platform-core#18`.
**Evidence cut:** 2026-10-12, through Core commit `e9d9326`.

This matrix is the acceptance checklist, not a claim that similarly named
modules or successful typechecks establish functional parity. Compare visible
behavior and persisted effects in the original before certifying each Core
journey. Do not copy the original's private content, credentials or user data.

**Evidence states:** `PASS` = personally observed runnable end-to-end behavior
with a saved result and reproduction notes; `PARTIAL` = some live browser
evidence but full acceptance not observed; `UNVERIFIED` = source or route
present without a verified complete user journey; `GAP` = known functional
difference or blocked condition; `OUT-OF-SCOPE` = deliberately separate
release gate. Evidence must include checkout commit, URL/environment, actor
role, steps and observed saved/reloaded result. A screenshot of a page alone
never establishes successful persistence.

## Phase A — independent browser MVP (must pass first)

| ID | Original generic journey to reproduce | Core evidence as of cutoff | State | Acceptance in Core |
| --- | --- | --- | --- | --- |
| A01 | Member registration/login and post-login dashboard | LAN/WireGuard HTTPS login and authenticated screens observed on Android | PARTIAL | Login, close/reopen or reload, protected dashboard/feed remains authenticated |
| A02 | Feed: create post, find it, comment/react, revisit | Routes/modules present; not actually tried end-to-end in independent demo | UNVERIFIED | New post and comment persist after reload; author permissions apply |
| A03 | Member logout and rejection of authenticated routes | No complete live sequence documented | UNVERIFIED | Logout revokes session; protected page redirects; stale refresh cannot restore session |
| A04 | Admin login, open admin area, inspect instrument | User confirmed Admin login and screenshots of dashboard and assessment list; generated demo admin script verified | PARTIAL | Admin can enter; regular member is denied; admin actions persist |
| A05 | Generic DE/EN rendering | Screenshot shows German controls; pack questions in admin showed English | PARTIAL | Switch locale; visible generic UI and assessment questions match chosen installed locale |

**Phase A stopping condition:** A01–A05 pass or a precise blocker with an
issue and reproduction is recorded. No editor, language-management feature or
cosmetic extension is needed for this gate.

## Phase B — original member/admin feature parity

| ID | Original workflow | Core evidence | State | Live acceptance |
| --- | --- | --- | --- | --- |
| B01 | Members: directory, profiles, follow/unfollow | Web/API code present | UNVERIFIED | Both actors can browse, follow and reload reflected state |
| B02 | Private messaging | Web/API code present | UNVERIFIED | Sender sends, recipient receives, conversation reloads |
| B03 | Learning groups: list, join/create, communicate | Web/API code present | UNVERIFIED | Create/join/message or explicitly verified equivalent original workflow |
| B04 | Courses: admin publish, member lesson, saved progress | Web/API code present | UNVERIFIED | Member progress persists and matches original semantics |
| B05 | Events: admin create, member RSVP, refresh | Web/API code present | UNVERIFIED | RSVP and attendee state persist; cancellation works |
| B06 | Recordings and discovery | Code present | UNVERIFIED | Relevant original discovery/playback flows work |
| B07 | Journal: write thoughts, save, reopen date | Android journal UI shown; user accepted simplified form | PARTIAL | Text persists on reload; own entries private; earlier content preserved |
| B08 | Assessment: 5-dimension sample, submit, result/history | 5-dimension sample pack and admin 10-question list visible | PARTIAL | Submitted ratings persist, results/history display consistently for same version |
| B09 | Dashboard goals/challenges, notifications | UI present and visible | PARTIAL | Changes and notifications work after reload |
| B10 | Admin users/roles/activation | Admin dashboard visible; summary links added, typechecked | PARTIAL | Manage user role and active state with correct permissions and audit |
| B11 | Admin categories CRUD | Neutral screen restored; route/code present | UNVERIFIED | Create/edit/delete non-branded category and verify member visibility |
| B12 | Admin content moderation/reports | API/UI code present | UNVERIFIED | Report, review, moderate, audit trail persist |
| B13 | Admin settings/branding | Screens present | UNVERIFIED | Save permitted setting, reload, verify affected member UI |
| B14 | Account settings/privacy/export/delete | Code present | UNVERIFIED | User controls and export/delete behavior match safe original generic flows |
| B15 | Mobile responsive navigation | Android screenshots show member/admin views | PARTIAL | No blocking clipping or unreachable actions in principal flows |

**Phase B closure:** compare each original journey's route, role and observed
behavior; test only the smallest necessary Core workflow, fix demonstrated
regressions and record proof. The old branded assessment editor is **not**
copied: neutral editing is a separate method-pack capability (#19), not
permission to alter old members' answers. Admin supported-language selection
(#20) is a new enhancement, not required to claim original DE/EN parity.

## Phase C — full independently deployable parity (separate release gates)

| ID | Gate | Core status | Issue |
| --- | --- | --- | --- |
| C01 | Fresh PostgreSQL `prisma migrate deploy` and safe upgrade | GAP: known migration order failure; demo uses isolated `db push` | #16 |
| C02 | Generic deployment, backup, restore and secure secrets | GAP: original deployment scripts absent/not replaced | #11 |
| C03 | Neutral installable Android app and trusted HTTPS | GAP: no independently accepted neutral APK/client | #17 |
| C04 | Content/asset rights, security/privacy and release acceptance | UNVERIFIED: independent signoff missing | #6 |
| C05 | External instance pack and runtime neutrality | PARTIAL: active synthetic pack shown; full separate instance acceptance open | #13, #8 |

**Do not merge draft PR #9 or claim production readiness** from Phase A/B
alone; those gates are distinct from the already-running LAN demo.

## Next smallest execution sequence

1. A01 → A03: on the **existing** `https://192.168.1.121:4443` demo,
   run one member session: login, hard reload, feed post, comment/reaction,
   hard reload, logout and protected-route retry. Capture result and revision.
2. A04 → A05: with separate admin/member accounts, verify denial/access,
   German and English language behavior. Fix the already observed English
   assessment-question text on a German admin page if reproducible.
3. B01 → B15: check original-first feature workflows one by one, recording
   successes and only opening fix issues for reproduced mismatches.
4. C01 → C05: complete independent installation and release gates after
   browser workflows are demonstrated. Never touch original production.

## Change control

- Keep #19 (new assessment editing workflow) and #20 (admin language chooser)
  outside the current MVP sprint. Fix original parity first.
- Any new change must name the row ID it advances and have a short proof.
- Two consecutive steps without a new accepted row or a reproduced blocker:
  stop investigation and choose the next highest-value unverified workflow.
- Update this matrix and tracker #53 after each verified row; no speculative
  `PASS` and no exhaustive regression suites in place of working UX.
