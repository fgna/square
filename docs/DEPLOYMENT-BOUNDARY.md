# Deployment boundary (private core candidate)

**Status: not approved for production deployment.**

This repository is application source, not a complete self-hosted
deployment bundle. The previous branded repository's Docker Compose and
Dockerfiles were not migrated. No production compose is claimed.

## Mandatory before declaring a new instance deployable

- Review container build definitions and runtime non-root identities.
- Use isolated PostgreSQL and Redis credentials/data per instance;
  database migrations must run explicitly and be reversible.
- Require JWT_SECRET and JWT_REFRESH_SECRET; never fall back to defaults.
  Rotate secrets independently; prohibit credentials in log output.
- Provide database backup/restore drills with restricted secret files,
  no environment-variable password leakage in backup jobs.
- Verify TLS, network isolation, file uploads, allowed origins, email,
  OAuth callbacks, rate limits and basic account lifecycle.
- Use a canonical deployment-controlled COMMUNITY_CONTENT_DIR. Reject
  unexpected paths, symlinks, modified content and invalid manifests.
- Pin the reviewed core and private content revisions; document rollbacks.
- Obtain separate asset, text, license, privacy and security clearance.

## Current test gap

`apps/api/src/config/docker-secrets.adversarial.spec.ts` is an
adversarial test designed for a root `docker-compose.yml`. That artifact
does not exist in this neutral core, so this suite cannot collect.
The 399 independently executed API tests passing do not cover this
deployment security contract.

**Do not make this test pass by adding a dummy compose file.** Deliver
real deployable infrastructure in a dedicated, reviewed change, and
validate both the security assertions and the actual configuration.
