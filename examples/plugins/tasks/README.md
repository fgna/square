# Generic task plugin prototype

This is a neutral Square Web/API plugin for solving a numeric task, backed by
Square's shared `data.tasks` attempt store. Single-/multiple-choice contracts
and UI controls also exist, but this sample API serves only the numeric example.

## Available example routes

- `GET /api/p/tasks/tasks/first` returns one public numeric task without the answer.
- `POST /api/p/tasks/attempts` validates and grades against its server-side answer.
  A signed-in Square member is derived from `CurrentUser('id')`.
- `GET /api/p/tasks/attempts` returns at most 100 attempts for that signed-in member.

An SQL migration creates the attempt table with a unique member/idempotency key,
an owner-scoped index and cascading user deletion. The plugin store rejects
same-key conflicting payloads. Do not expose member IDs or answer keys in the client.

## Still incomplete

- `POST hints/reveal` and server-owned hint state. This sample task deliberately
  has `hintCount: 0`, so the UI does not offer a hint for this task.
- End-to-end choice tasks in the API, although the schemas, graders and UI exist.
- Account data export, migration execution, API typecheck, tests and browser smoke.
- Resuming/visually listing history in the Web UI after returning, although
  the authenticated `GET attempts` endpoint now exists.
- Error-handled retry preservation across uncertain network failures.

This example is **not production-ready**. No migrations have been applied,
and no runtime tests have been executed in this GitHub-editing session.
