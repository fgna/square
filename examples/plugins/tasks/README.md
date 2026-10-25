# Generic task plugin prototype

This is a neutral Square Web/API plugin for solving numeric, single-choice and multiple-choice tasks, backed by
Square's shared `data.tasks` attempt store. The example API serves all three response types.

## Available example routes

- `GET /api/p/tasks/tasks` returns three public neutral tasks (numeric, single choice, multiple choice) without answer keys.
- `GET /api/p/tasks/tasks/first` retains the initial numeric task endpoint.
- `POST /api/p/tasks/attempts` validates and grades against its server-side answer.
  A signed-in Square member is derived from `CurrentUser('id')`.
- `GET /api/p/tasks/attempts` returns at most 100 attempts for that signed-in member.

An SQL migration creates the attempt table with a unique member/idempotency key,
an owner-scoped index and cascading user deletion. The plugin store rejects
same-key conflicting payloads. Do not expose member IDs or answer keys in the client.

## Still incomplete

- `POST hints/reveal` and server-owned hint state. This sample task deliberately
  has `hintCount: 0`, so the UI does not offer a hint for this task.
- Account data export, disposable database migration execution and browser smoke.
- API and Web typechecks, production builds and focused application tests passed CI run #45; an isolated real-database migration and browser login/logout verification are still required.
- Resuming/visually listing history in the Web UI after returning, although
  the authenticated `GET attempts` endpoint now exists.
- Error-handled retry preservation across uncertain network failures.

This example is **not production-ready**. No database migration or browser end-to-end test has been executed in this GitHub-editing session.

## Disposable migration check

Run `bash scripts/test-task-attempts-postgres.sh` from the repository root on a Docker-equipped development machine. The script starts a **new container with no persistent volume**, assigns a random localhost port, runs Prisma migrations against that container only, checks the TaskAttempt table and constraints, then removes the container even on failure. Do not substitute production credentials or run migrations against a live Square instance. Passing this smoke does not validate the browser workflow.
