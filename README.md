# Community Platform Core

## License

The reusable Core is intended to be distributed under
[Apache License, Version 2.0](LICENSE) (`Apache-2.0`).
Retained prior-source and dependency licensing guidance is in
[THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
Public release remains gated by the final privacy and publication checks in Core issue #6.

## Node and pnpm without manual NVM setup

This repository pins Node 22 in `.nvmrc`. For commands from any shell,
including shells where NVM is not initialized, use the checked-in wrapper:

```bash
cd ~/Projects/community-platform-core
bash scripts/dev-pnpm.sh --filter @community/web typecheck
```

The wrapper checks the active Node version and Corepack, loads
`$HOME/.nvm/nvm.sh` and selects Node 22 only if needed, then runs the
requested pnpm operation. It does not install packages globally or alter
system-wide configuration. The full local-demo launcher
`bash scripts/dev-instance-up.sh` performs the same version selection.
Node 22 must already be installed via NVM if it is not otherwise available.

## Independent neutral platform

This repository contains a reusable community application and a synthetic demo instance.
Functional changes should preserve documented user flows, navigation, API contracts,
and the independent login → reload → feed → logout smoke path. Use only authorized,
non-identifying references and synthetic data when validating platform behavior.

Private instances keep branding, domain-specific methods, credentials, and deployment
configuration outside this repository. An existing deployment must not be modified
during isolated Core development.

Tracking: [project outcome #53](https://github.com/fgna/project-tracker/issues/53),
[Core delivery #18](https://github.com/fgna/community-platform-core/issues/18),
[parity evidence](docs/FUNCTIONAL-PARITY-GAPS.md).

Private, method-independent Next.js/NestJS platform candidate for separate community instances.

## Verified on an independent clean checkout (2026-10-11)

- API: Prisma generate, TypeScript validation and Nest build PASS.
- Web: TypeScript validation and Next production build PASS (46 generated pages).
- Web unit tests: **134/134 PASS** across 28 files.
- API executable unit tests: **399/399 PASS** across 51 files.
- One additional API Docker security test suite does **not collect**:
  no reviewed root `docker-compose.yml` exists in this core.
- Hosted GitHub integration workflow is **not yet green**.

## Integrating a third-party private repository

For maintainers who want to use this Core with separately versioned private
community content, see the **[third-party repository integration README](docs/THIRD-PARTY-REPOSITORY-README.md)**.
It explains what belongs in each repository, how to validate and pin both Git
revisions, the intended shared API/Web content mount, update workflows, and
which staging/production steps are not yet implemented.

## Ownership and instance separation

- **Core:** generic application functionality, interfaces and runtime.
- **Private instance repository:** domain, branding, method/content pack,
  instance-specific services and deploy secrets.
- **Core example content:** `examples/neutral-method-pack/` is synthetic
  bilingual content for testing, not authorized production material.
- **Getting started:** `examples/instance-starter/README.txt` explains
  which artifacts belong in a new private instance repository.
- **Deployment requirements and blockers:** `docs/DEPLOYMENT-BOUNDARY.md`.

An instance must pin a reviewed core revision and use its own database,
credentials, domains, backups and legally authorized content. The content
pack loader is fail-closed. Private web translations require explicit
server-side integration; setting `COMMUNITY_CONTENT_DIR` alone is not a
complete new-instance setup.

## Isolated local demo: administrator bootstrap

A fresh isolated local demo provisions exactly one administrator during
`bash scripts/dev-instance-up.sh`. The account is `admin@community.local`,
with a random password saved **only** in
`.local-community/admin-credentials.txt` (mode 0600, directory 0700).
The credentials file and database are local runtime state, not committed.
The bootstrap refuses production or any database other than
`127.0.0.1:5439/community_core_demo?schema=local_demo`.

For an **already running demo** installed before this feature, run the
versioned one-time command `bash scripts/dev-instance-admin.sh` after
`git pull`. If `.local-community/demo.env` does not exist, the script uses
only the running PostgreSQL container identified by the dedicated
`community-core-local-demo` Compose labels. It does not inspect API process
secrets or restart any services. It does **not** restart API/Web, run migrations, or reset data.
If any admin already exists, it changes nothing; use the existing admin
credentials. If the reserved email belongs to a non-admin account, it
fails rather than promoting that account. If the credentials file cannot
be safely created, the admin account is not inserted.

Log out of the member account, log in with the new administrator, and
navigate to `/admin`. Do not run the full demo launcher to add an admin
to an already-running installation (it intentionally refuses occupied ports).
The fixed-password legacy demo seed is not used.

## Architecture decision: templates live in core (2026-10-11)

**Decision:** Keep generic instance templates and synthetic examples **inside
this core repository** for the initial migration. Do not create or maintain
a separate `community-instance-template` repository yet.

- `apps/` and `packages/`: reusable platform application and shared code.
- `examples/neutral-method-pack/`: versioned, synthetic DE/EN method/content
  contract used to illustrate and validate the generic instance structure.
- `examples/instance-starter/`: neutral instructions for creating a new
  instance; not a deployable production instance.
- **Each real community:** its own **private, separate repository** for
  community-specific method content, assessment questions, journal prompts,
  translations, branding, configuration and deployment integration.
  Customer-specific instances must remain outside the generic core and its templates.
- **Runtime data and credentials:** stay outside Git and are isolated per
  instance (database, object storage, secrets and backups).

**Rationale:** Co-locating neutral templates with the core keeps example
schemas and code changes together, reduces repository and release overhead,
and speeds up the first independent migration. A dedicated public or private
template repository may be introduced later **only when** an independent
copy/installation/versioning workflow makes that useful.

**Migration acceptance:** A passing unit-test/build suite alone does not
show that an external instance is fully operational. The first independent
instance still needs isolated runtime checks, including external content
activation, login and core user flows. See
`docs/ISOLATED-RUNTIME-SMOKE.md` and issue #13.

## Quick start: isolated local demo (first field test)

The goal is a straightforward, independently runnable local demo. On a Linux
machine with Docker Engine + Compose v2, Node 22, Corepack and curl, use the
**migration branch** until PR #9 is accepted:

```bash
git clone --branch migration/neutral-full-platform https://github.com/fgna/community-platform-core.git
cd community-platform-core
bash scripts/dev-instance-up.sh
```

If you already have a clean checkout, simply pull that branch and run the
same start script. **This is an initial implementation, not yet proven by
a real end-to-end user installation.** Please report its terminal output
and any failure before relying on it.

**Fresh-install migration caveat:** The 41 historical Prisma migrations currently fail on an empty database at `20260621000002` because `Post.type` does not yet exist. The isolated demo launcher temporarily uses `prisma db push` in the separate `local_demo` PostgreSQL schema; this is strictly for disposable development data and does not validate production migrations. See [Issue #16](https://github.com/fgna/community-platform-core/issues/16).\n\nThe script installs frozen pnpm dependencies, generates development-only
secrets in gitignored `.local-community/demo.env`, starts isolated Docker
PostgreSQL 16 and Redis 7 via `docker-compose.local.yml`, synchronizes the schema of the **disposable local demo database** via
`prisma db push` (the historical migration order currently fails on a fresh
PostgreSQL database; see issue #15), and starts the Nest API and Next Web app as local processes.
The external synthetic bilingual pack is loaded from
`examples/neutral-method-pack/`. Logs stay in `.local-community/`.

- Web on the host: `http://127.0.0.1:4300`
- **Web on your local network:** `https://192.168.1.121:4443` (private LAN CA; trust required)
- API health (server-side only): `http://127.0.0.1:4301/health`; LAN HTTPS proxy: `https://192.168.1.121:4443/health`
- Local PostgreSQL: port 5439 (loopback only)
- Local Redis: port 6389 (loopback only)

Web and API bind to loopback; only the Caddy HTTPS proxy listens on the trusted LAN. PostgreSQL and Redis also remain loopback-only. Browser API requests use the same HTTPS origin and a local server-side Next.js rewrite. No cleartext HTTP API ports need to be exposed to the LAN. The
script verifies that the default `192.168.1.121` is assigned to the host;
for another host use `COMMUNITY_LAN_IP=192.168.1.50 bash scripts/dev-instance-up.sh`.
If a Linux firewall is enabled, allow TCP 4300 and 4301 **only from your
trusted local subnet**, and never port-forward these ports to the internet.
Caddy creates a **private local certificate authority**. The browser will not trust it automatically. Export its public root certificate using the command printed by the launcher, verify the file came from your own Caddy container, and install it only on devices you control. This is **not publicly trusted HTTPS**. Use disposable accounts and non-sensitive synthetic content.

Smoke-check the running demo:

```bash
bash scripts/smoke-isolated-instance.sh http://127.0.0.1:4301 http://127.0.0.1:4300
```

Stop the demo without deleting its private database volume:

```bash
bash scripts/dev-instance-down.sh
```

The startup refuses occupied ports. **Do not** pass a real community's
database URL or reuse its secrets. The script is for isolated local
evaluation; it is not a complete secure production container deployment.
See #11 (container security), #15 (production migration history), and
`docs/DEPLOYMENT-BOUNDARY.md` for remaining production gates.

### Production boundary

The one-command demo is strictly for isolated local evaluation. A real
community instance still requires its own private content repository,
separate durable database and backups, secret management, network/TLS
configuration and an explicit production deployment review. Existing independent production installations must remain unchanged.

## Android APK distribution (required before migration acceptance)

**Decision (2026-10-11):** Every independently installed community must
be able to offer a **real installable Android APK** through its own
`/get-app` screen. The neutral Core keeps shared Android tooling and
build instructions, while every instance supplies its own URL, name,
branding and release assets.

**Current status:** APK publication is **not yet available** for this
Core instance. The existing `/api/download-app` route correctly returns
404 when no APK has been provisioned. The UI checks APK availability and
must never offer a dead download. See [Issue #17](https://github.com/fgna/community-platform-core/issues/17).

The first test APK will target the **isolated local** community
`https://192.168.1.121:4443`; it will be a development/testing artifact,
not a publicly trusted release. Browsers on the same LAN already reach the
website. A neutral Android wrapper, a reproducible Android build, APK
hosting, and installation on an Android phone still need validation.

For real users outside the trusted local network, require HTTPS,
a separate reviewed and securely signed release APK, an update strategy
and a rights/security review. Never distribute branded or debug APKs as a neutral production release. Build artifacts and signing materials
remain out of the Core Git repository.


### Android debug build using the existing wrapper (not yet device-verified)

The development-only script `scripts/build-local-android-apk.sh` currently depends on external Android wrapper sources. Review that dependency and its licensing before using or distributing any generated APK. It places local debug artifacts outside tracked source at `apps/web/debug-apk/community.apk`. The build requires Java 17 and a configured Android SDK and has **not yet been run** successfully in the new Core instance.

```bash
bash scripts/build-local-android-apk.sh
```

After a successful build, restart the isolated Core demo to enable the guarded `/api/download-app` endpoint. Import/trust the LAN Caddy root CA in the Android **test device** before expecting its HTTPS WebView to work. This is a developer preview, **not** a publicly distributable or release-signed APK. It does not automatically update apps or create a production signing key.

## Release restrictions

This is **draft, not release-ready**. Do not deploy as a complete application,
merge into a production branch, or assert clearance of assets, texts,
privacy, security or third-party rights solely from the automated checks.
Existing production environments are outside the scope of this draft.
