# Candidate update compatibility preflight

For a newer, **operator-selected** Square release, prepare a clean, separate Core checkout at its tagged release commit and a clean instance-content checkout. Pin both reviewed SHAs in an absolute-path staging pair following [the staging guide](THIRD-PARTY-STAGING.md).

From the **candidate Core checkout** (not the currently running production instance):

```bash
node scripts/check-square-candidate.mjs --current 1.0.0 --candidate-pair /absolute/path/to/staging-pair.json
```

The command first runs the existing pinned Core/content revision validator and instance-pack compatibility preflight. Then it requires a single stable Square release tag at the pinned candidate Core commit that is newer than the installed version. Any failure prevents a successful preflight. The operator must supply the actual installed version, and the candidate pair must point at the checkout running the validator. This command performs no cloning, database migration, deployment or automatic rollback.

After PASS, the operator still must review intervening release notes, verify database migrations and backups, complete isolated API/Web/browser staging acceptance, and explicitly approve deployment. PASS is a **static content compatibility gate**, not a guarantee of plugin/runtime compatibility or production safety.

Use `node --test scripts/check-square-candidate.test.mjs` for unit coverage. Related: #37 and [release discovery](SQUARE-UPDATES.md).

For the operator procedure, write freeze, backup and rollback decisions, see [independent instance upgrade and recovery](SQUARE-UPGRADE-RECOVERY.md).
