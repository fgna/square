# Generic task plugin prototype

This directory contains a generic Square plugin manifest and a WebPlugin quiz UI for
number, single-choice, and multiple-choice answers. The UI deliberately contains no
correct answers, mathematical learning rules, or learner profile logic.

**Integration status: incomplete.** The UI expects a future authenticated,
durable plugin API. Do not activate this plugin in production until implemented.

## Expected scoped API

The Square WebPlugin API client is scoped to `/api/p/tasks` and inherits Square
member authentication. The following routes must be implemented server-side:

- `GET tasks/first`: a public task definition from the versioned task contract;
  excludes `expected`, `correctOptionIds` and unrevealed hint text.
- `POST attempts`: validates task ID/version, response and idempotency key;
  derives member ID from Square's `CurrentUser('id')`, validates the response
  against a server-side answer key and inserts an immutable attempt transactionally.
  Return `{correct, hintsUsed}`; retry with the same key returns the same attempt.
- `POST hints/reveal`: identifies the logged-in member and task, advances
  server-owned hint usage, returns only the next hint. The client never supplies
  a trusted hint count.
- `GET attempts`: restores this member's own history after reload/login.

The plugin API context currently exposes only `data.journal`, which must not
be repurposed for quiz attempts. The durable general-purpose storage contract,
delete/export integration, authorization tests and live browser flow remain
part of [Square #19](https://github.com/fgna/square/issues/19).

## Validation

Source-only contract tests: `node --test packages/plugin-sdk/src/tasks.test.mjs`.
These tests have **not yet been run** for this branch; there is no backend
or executable browser acceptance yet.
