# Independent instance upgrade and recovery

This is an operator-controlled procedure for separately maintained Square instances.
It combines [release discovery](SQUARE-UPDATES.md), the [candidate gate](SQUARE-CANDIDATE-GATE.md)
and a disposable PostgreSQL recovery rehearsal. A static PASS is not deployment approval.

## Record the accepted instance

Keep a deployment-owned record outside the Square checkout containing:

- Instance ID and application release version, separately from the Square platform release.
- Accepted Core/content Git SHAs and the installed stable Square release tag, using a pinned staging pair.
- Immutable API/Web build or image identifiers, configuration revision, plugin revisions and upload-storage snapshot identifiers.
- Migration history, database engine version, backup location, recovery operator and maintenance window.

Record secret-store references only; never commit secret values or member backups.
Check the running build matches this record. An arbitrary local checkout is not evidence of the deployed version.

## Review and rehearse a candidate

1. Run release discovery with the accepted pair and read every intervening release note. Review API/plugin contracts,
   database migrations and storage changes. An instance release and a Square release have different versions.
2. Create separate clean candidate Core and instance-content checkouts at reviewed SHAs. Retain the accepted pair.
   Run the candidate gate from the candidate Core checkout. A rejection ends the attempt before any runtime or data change.
3. In an isolated environment with separate database, Redis, uploads, secrets and origin, restore a representative backup.
   Disable outbound mail, scheduled jobs, payment callbacks and other external side effects. Protect copied personal data.
4. Build API/Web against the same pair and read-only content directory. Run instance-owned plugin/API contract checks.
   Review each pending migration; use `prisma migrate deploy`, never `db push`, `migrate reset` or unreviewed generated SQL.
5. Compare accounts, content, progress, instance settings, upload references and extension state before/after migration.
   Exercise login/reload/logout, permissions, extension routes and background jobs against this exact candidate build.
6. Rehearse recovery into an empty database and separate storage location. Confirm the prior build can use the restored
   schema and data. Record exact SHAs/builds, checks and recovery duration; a failed check blocks promotion.

## Production promotion

Production deployment requires separate operator authorization after the rehearsal succeeds.
Use the instance repository's reviewed deployment commands, rather than treating this document as a generic deployer.

1. Enter maintenance mode and stop all writers, including workers and integrations. Keep ordinary members off the instance.
2. Take a consistent database backup plus uploads/object-storage snapshot and deployment configuration record.
   Verify backup readability and retain the previous build and pinned pair. A database dump alone does not back up uploads or secrets.
3. Apply the reviewed migration plan once, then start the candidate API/Web/workers in the documented order.
   Verify health, schema migration status, permissions and representative instance functionality before reopening writes.
4. Record the newly accepted pair/build/application version only after all gates pass. No member update prompt is required.

## Recovery decision

- **Candidate rejected before migration:** keep the accepted deployment running; no data restore is needed.
- **Application failure with an explicitly backward-compatible schema:** the prior build may be redeployed only when that
  exact build/schema combination was tested. A Git checkout alone does not establish schema compatibility.
- **Migration failure, partial migration or incompatible schema:** retain maintenance mode, stop every writer and preserve
  the failed database for diagnosis. Restore the pre-upgrade dump into a new empty database and restore the matching upload
  snapshot/configuration. Start the prior accepted build/pair against those restored stores, validate, then switch traffic.
  Never fix this by merely rewinding source or editing `_prisma_migrations` to claim success.

A pre-upgrade restore loses writes made after the snapshot. The write freeze prevents this during the maintenance window.
If the instance was already reopened, agree a recovery point and reconcile later writes before recovery; do not silently
discard them. A forward repair is a separately reviewed migration, not an automatic retry loop.

## Reproducible disposable acceptance

With Node 22, Git history including the baseline below, Docker and lockfile-pinned workspace dependencies installed:

```bash
node --test scripts/check-square-update.test.mjs scripts/check-square-candidate.test.mjs scripts/check-square-candidate.integration.test.mjs scripts/validate-staging-pair.test.mjs scripts/validate-instance-pack.test.mjs
node scripts/test-square-upgrade-recovery.mjs
```

The first command uses synthetic stable tags in temporary, independent Git repositories. It accepts a compatible pack,
rejects a committed incompatible pack, preserves extension source, and revalidates the previous accepted pair.
Those synthetic tags are not published Square releases.

The second command accepts no target URL. It creates a uniquely named PostgreSQL 16 container with an ephemeral loopback
port, no host mounts or existing data volume, and synthetic member data. It applies the actual Prisma migration history
from reviewed main commit `d493469abf751bd0b7a951cd2428252d22a78351`, then the candidate checkout's migrations.
It compares credentials/accounts, posts, course progress, task attempts, settings and a separate extension schema.
It then injects a partially applied failing migration and requires a failed exit before restoring a real `pg_dump`
archive to a second empty database. Recovered data, migration history and baseline schema must match.
The temporary container/volume and files are removed on normal exit or test failure.

This is a real migration/backup recovery test between source revisions, not a published-release upgrade or a full
API/Web/browser deployment test. Upload snapshots, instance-owned plugin runtime behavior, production recovery commands
and actual deployment approval must be verified for each instance. Keep #37 open until the remaining operator acceptance
has been recorded; passing this harness alone does not accept an independent instance's production rollout.
