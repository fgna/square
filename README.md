# Square

**Open-source software for independent communities.** Square brings members, conversations, events, courses and shared learning together in a customizable web platform.

[![License: Apache 2.0](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](LICENSE)
[![Release](https://img.shields.io/github/v/release/fgna/square)](https://github.com/fgna/square/releases)

Square is built with a **Next.js web app**, a **NestJS API**, **Prisma/PostgreSQL** and a plugin interface. Each community can keep its identity, content and operational data separate from the reusable application.

## What Square includes

- Member accounts, profiles, feed posts, comments and reactions
- Events, RSVPs, recordings and notifications
- Courses, learning groups, messages and community administration
- Configurable assessment and journal features
- Plugin interfaces and example plugins
- German and English translations
- A synthetic example content pack to explore the instance contract

Some capabilities require additional configuration or external services. The sample content is illustrative and not a production community.

## Try the isolated local demo

**Requirements:** Linux, Docker Engine with Compose v2, Node.js 22, Corepack and curl. The launcher is for a disposable development instance, **not a production deployment**.

```bash
git clone https://github.com/fgna/square.git
cd square
bash scripts/dev-instance-up.sh
```

The launcher provisions isolated local services and development credentials, and starts the web app and API. It may require a local network/TLS configuration and uses a disposable demo database. Check the launcher output for the exact URLs and instructions.

To stop the demo without deleting its database volume:

```bash
bash scripts/dev-instance-down.sh
```

For the smoke procedure, see [Isolated runtime smoke](docs/ISOLATED-RUNTIME-SMOKE.md). **A complete fresh-install end-to-end acceptance is still a separate milestone**; a passing typecheck or unit test does not establish production readiness.

## Project structure

| Path | Purpose |
| --- | --- |
| `apps/web/` | Next.js web application |
| `apps/api/` | NestJS API and Prisma schema |
| `packages/shared/` | Shared data types and utilities |
| `packages/plugin-sdk/` | Plugin type interfaces |
| `examples/neutral-method-pack/` | Synthetic bilingual example content |
| `examples/plugins/` | Plugin examples |
| `docs/` | Instance contracts, deployment boundaries and verification |

## Build and verification

Node.js 22 and pnpm (via Corepack) are used for development. A wrapper is provided for environments where NVM is not already initialized.

```bash
bash scripts/dev-pnpm.sh --filter @community/core-api exec prisma generate
bash scripts/dev-pnpm.sh --filter @community/core-api typecheck
bash scripts/dev-pnpm.sh --filter @community/web typecheck
bash scripts/dev-pnpm.sh test:plugins
bash scripts/dev-pnpm.sh test:i18n
```

These commands validate code and static content contracts; they do not deploy an instance or test a production migration.

## Running your own community

Square's application source is public. Real community branding, domain-specific content, credentials, database, backups and deployment configuration should live **outside** this repository. Review:

- [Independent instance contract](docs/THIRD-PARTY-INSTANCE-CONTRACT.md)
- [Guide for separate instance repositories](docs/THIRD-PARTY-REPOSITORY-README.md)
- [Deployment boundaries](docs/DEPLOYMENT-BOUNDARY.md)

Do not use the isolated demo launcher against a live database.

## Status and contributing

[Square v1.0.0](https://github.com/fgna/square/releases/tag/v1.0.0) is the first public **source release**, not a claim of production readiness. Issues and changes for Square should be tracked in [this repository](https://github.com/fgna/square/issues). Before submitting a change, open an issue that explains the intended user outcome and acceptance criteria.

## License

Square is licensed under the [Apache License, Version 2.0](LICENSE). See [NOTICE](NOTICE) for copyright attribution and [third-party notices](THIRD_PARTY_NOTICES.md) for retained upstream and dependency notices.

Copyright 2026 Freya Gnam and Peter Creutzfeldt.
