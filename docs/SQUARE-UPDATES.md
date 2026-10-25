# Checking for Square platform updates (operator preflight)

Square-based instances must pin the reviewed Square source revision and instance-content revision separately. See [the instance repository guide](THIRD-PARTY-REPOSITORY-README.md). This command is a **read-only discovery step**, not an updater or production-deployment approval.

From the Square checkout, run:

```bash
node scripts/check-square-update.mjs --current 1.0.0
```

Alternatively, for an instance pinned to a tagged Square release in a deployment-owned staging-pair file:

\`\`\`bash
node scripts/check-square-update.mjs --staging-pair /absolute/path/to/staging-pair.json
\`\`\`

This mode reads the pair's Core checkout and pinned SHA, confirms that its checked-out HEAD matches the SHA, and identifies the installed version from exactly one stable release tag pointing to that commit. The checkout must have the release tag locally. It fails closed for untagged commits, mismatched revisions or ambiguous tags; it does not assert which revision is running in production. The deployment operator is responsible for supplying the accepted deployed pair and checking it matches the live instance.

Supply the version actually installed by your deployment, not the version in an arbitrary local checkout. By default the tool reads up to the latest 100 GitHub release records from the public `fgna/square` GitHub API. It only displays newer, published stable versions, ordered oldest to newest, with links to their release notes. It never changes source code, instance data or service configuration. If the API fails, the command fails rather than treating the check as successful. Version tags must follow `vMAJOR.MINOR.PATCH` or `MAJOR.MINOR.PATCH`. An offline release listing can be supplied with `--releases-file path.json` (GitHub release-list JSON format).

Before adopting a release:
1. Read **all** listed intervening release notes and assess breaking changes; an available update is not evidence of compatibility.
2. Pin the candidate Square Git SHA and retain the instance-content SHA in the deployment-owned staging pair.
3. Run `node scripts/validate-staging-pair.mjs /absolute/path/to/staging-pair.json` and required staging/browser checks. A failed check blocks promotion.
4. Confirm database migration and backup/restore procedures independently. Keep the previously accepted pair for recovery.
5. Only the instance operator authorizes promotion. End users do not see a Square platform update prompt.

Automatic update PRs, production deployment, migration rollback and exhaustive release-history pagination are outside this first step. The Square release tag identifies the platform version, while instance-specific applications such as Turbo Mathe manage their own releases separately.

Related: [Issue #37](https://github.com/fgna/square/issues/37).
