# Pinned third-party staging integration (Core #22)

**Status: pre-deployment revision-pair gate implemented; full deploy pending #11/#16.**
This is not an alternative production Compose stack. The independently
owned private repository is checked out **outside Core** by its operator/CI.

## Contract

The deploy workflow owns a JSON file (not a secret, not included in Core):

```json
{
  "instanceId": "community-staging",
  "core": {
    "checkout": "/absolute/path/to/community-platform-core",
    "revision": "40-character-reviewed-core-commit-sha"
  },
  "content": {
    "checkout": "/absolute/path/to/third-party-private-repo",
    "revision": "40-character-reviewed-content-commit-sha",
    "root": "content"
  }
}
```

Use real 40-hex SHA-1 identifiers rather than branch/tag names. Core and
private content checkout must be **distinct and clean**, with HEAD matching
their pinned revisions. The validator also requires a canonical, contained,
non-symlinked content root and invokes the existing Core #21 preflight.
Do not include passwords, tokens, credentials or brand texts in the pair JSON.

Run from the pinned Core checkout:

```bash
node scripts/validate-staging-pair.mjs /absolute/path/to/staging-pair.json
```

Expected: content pack contract PASS followed by pinned pair PASS.
This is read-only: no clone, pull, git credentials, database, services or
deployment modifications. An incompatible update cannot be deployed under
the documented procedure because staging begins with this gate.

## Using the pair in a staging deployment

1. A deployment maintainer/CI, with **scoped read-only access only to the
   private repository**, checks out both exact reviewed SHAs. The private
   checkout must not be inside the Core tree or Core build context.
2. Verify the pair above. Fail closed and leave the current deployment
   unchanged on any validation failure.
3. The deployment from #11 binds the validated `content.root` as a
   **read-only volume** to both API and Web. Each server gets the same
   canonical `COMMUNITY_CONTENT_DIR` setting. Both use the pack's
   manifest/instrument identity; no fallback to Core example content is
   allowed when this variable is explicitly set.
4. Use a dedicated instance-specific DB, Redis, TLS origin, upload storage
   and separate secrets from the deployment's secret store. None of these
   values belong in the pack or manifest. Apply a reviewed migration plan
   (#16) before promoting a revision.
5. Smoke a disposable account: login→reload→feed→logout and DE/EN assessment,
   journal and admin permission. Record Core SHA, content SHA, environment and
   actual browser results before accepting the paired release.

**Current blockers:** #11 does not yet ship an approved production-capable
API/Web deployment, #16 fresh migrations are still broken, #18 browser
parity has not been accepted. This document deliberately does not present the
existing `dev-instance-up.sh` (hard-coded isolated demo with DB push) as a
general staging deployer.

## Revert or rollback

Keep the previously accepted **pair** of SHAs. Before promotion validate
both checkouts and pack again; if the candidate fails, no runtime change.
For a runtime rollback, restore the prior pair only through #11's verified
deployment/recovery procedure, ensuring #16's schema compatibility and
preserving member data. Do **not** silently rewind a database, reuse a
different assessment identity for stored answers or overwrite content-pack
versions. Automated rollout and rollback gates are tracked in #23.
