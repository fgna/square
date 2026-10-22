# Using Community Platform Core from a third-party private repository

This guide is for maintainers of an independently owned **third-party private
repository**. The private repository supplies licensed community content and
configuration; the public/neutral Core supplies the application. Neither
repository needs to merge into or fork the other.

**Current maturity:** content preflight (#21), two-Git-revision verification
(#22) and Web content activation tests have passed. A general staging launcher,
combined API+Web runtime acceptance, safe production database migrations and
deployment/recovery are **not yet delivered** (#22/#11/#16/#18). Do not replace
an existing production installation using this guide.

## How the mechanism works

```text
Core repository                   Third-party private repository
  Web / API / generic UI           content/community.json
  pack loader + validators         content/assessments/definition.json
  versioned application            content/journal/...
                                   content/i18n/de + en/method.json
           |                                   |
           +--------- deployment-owned -------+
                       revision pair
                     (two pinned SHAs)
                              |
                   local checked-out content
                      read-only mount
                              |
                   API + Web, same pack root
                              |
                isolated DB / Redis / storage
                (runtime user data stays here)
```

The Core never fetches a third-party private repository, requires no private
Git credentials and does not include its contents in the generic Git history.
A separate deployment operator/CI with least-privilege read access checks out
the chosen private commit. The Core and the private repo may be updated
independently, but a deployment always pins and validates **both** revisions.

## Step 1 — Prepare the private repository

Put the versioned *content*, not passwords or user data, into a private
repository. Its layout is:

```text
my-private-community/
  content/
    community.json
    assessments/definition.json
    journal/definition.json
    journal/de.json
    journal/en.json
    i18n/de/method.json
    i18n/en/method.json
```

Start with `examples/neutral-method-pack/` from Core as a **synthetic schema
reference only**. Replace example texts with material the repository owner
is licensed to use. `community.json` currently expects schemaVersion 1,
Core compatibility `^1.0.0`, locale packs DE and EN, and assessment
instrument ID/version matching the assessment definition. See
[the full instance contract](THIRD-PARTY-INSTANCE-CONTRACT.md).

Keep **in the private repo**: method questions, journal prompts, translation
catalogs, licensed branding and nonsecret instance configuration.

Keep **out of Git**: passwords, JWT/OAuth tokens, database dumps, member
records, uploads, backups and runtime secret files. The deployment owns
instance-specific database, Redis, TLS, storage and secrets.

## Step 2 — Validate the content checkout (available now)

Once Core and the private repository are independently checked out on the
same trusted machine, run from the **Core** checkout:

```bash
bash scripts/dev-instance-pack-check.sh /absolute/path/to/my-private-community/content
```

This read-only command checks the manifest, bilingual assessment/journal
content, required files and path safety. It prints a PASS message or error
codes without printing private method texts. It does not clone, publish,
start services or alter database data.

## Step 3 — Pin both Git revisions (available now)

Keep a deployment-owned JSON file, for example
`/absolute/path/to/staging-pair.json`:

```json
{
  "instanceId": "my-community-staging",
  "core": {
    "checkout": "/absolute/path/to/community-platform-core",
    "revision": "REPLACE_WITH_40_CHARACTER_CORE_GIT_SHA"
  },
  "content": {
    "checkout": "/absolute/path/to/my-private-community",
    "revision": "REPLACE_WITH_40_CHARACTER_CONTENT_GIT_SHA",
    "root": "content"
  }
}
```

The revision placeholders must be replaced by actual immutable 40-character
Git SHA-1 commit IDs (`git rev-parse HEAD` in each checkout). Both checkouts
must be clean and separate. This file contains no secrets and must not include
private content.

Validate the complete pair using the Core revision pinned above:

```bash
node scripts/validate-staging-pair.mjs /absolute/path/to/staging-pair.json
```

The validator refuses a wrong SHA, dirty worktree or incompatible private
pack. This is **only a validation gate**; it does not deploy the pair.

## Step 4 — Connect API and Web in isolated staging (integration pending)

The intended runtime setting is the same canonical content root for **both**
services:

```text
COMMUNITY_CONTENT_DIR=/absolute/read-only/mounted/content
```

This is a **server-controlled deployment setting**, never a user-supplied
HTTP parameter. Deployment tooling must mount a single reviewed content
version read-only for both services, and keep it outside the Core build
context. The API's content loader and the Web's server-side translation
loader inspect their own mounted directory. Both must report/verify the
same pack ID and instrument version before staging acceptance.

Do **not** mistake the old isolated demo launcher for this missing
integration: `scripts/dev-instance-up.sh` uses a dedicated local demo
schema and is **not** a general private-instance or production launcher.
The real deployment framework and joint runtime proof are tracked by
[#11](https://github.com/fgna/community-platform-core/issues/11),
[#13](https://github.com/fgna/community-platform-core/issues/13) and
[#22](https://github.com/fgna/community-platform-core/issues/22).

A future independent staging release must also pass the real browser
login→reload→feed→logout smoke, both languages, journal persistence and
assessment instrument identity. Never move customer or production data to
test this.

## Step 5 — Updating either repository

For a **Core-only change**, review a new Core commit and retain the
private content SHA. For a **content-only change**, review the private
content SHA and retain the Core SHA. In either case, create a proposed
*new pair*, run the two preflight checks and complete staging/browser
validation before promoting it.

Keep the previous accepted pair for rollback. Database schema changes and
stored assessment responses need a compatible migration/versioning plan:
changing the active instrument must never rewrite historical answers.
Automatic promotion and rollback are future scope
([#23](https://github.com/fgna/community-platform-core/issues/23)).

## Responsibility and status

| Responsibility | Owner | Current state |
| --- | --- | --- |
| Generic app, validators and interface | Core maintainers | Preflight available |
| Private content, translations and legal rights | Third-party private repo maintainer | Defined format; supplied externally |
| Review and pin both Git commits | Instance/deployment maintainer | Validator available |
| Read-only shared content mount in API and Web | Deployment maintainer | Full staging integration pending #22/#11 |
| Database safety, TLS, backup and rollout | Deployment maintainer | Release gates pending #16/#11 |
| Browser acceptance and rollback | Instance/deployment maintainer | Pending #18/#23 |

Further technical detail: [staging pair guide](THIRD-PARTY-STAGING.md),
[content contract](THIRD-PARTY-INSTANCE-CONTRACT.md),
[deployment boundary](DEPLOYMENT-BOUNDARY.md).

**The private repository can be maintained by any authorized developer.**
Core contributors need no access to that private repository to improve the
generic platform.
