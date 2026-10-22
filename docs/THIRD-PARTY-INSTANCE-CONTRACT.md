# Third-party private repository → neutral Core content contract (v1)

Status: **developer preflight and staging integration only**. This document does
not approve production deployment or provide a private-repository connector.
Relevant issues: #21 (this contract), #22 (staging), #23 (update/rollback),
#13 (runtime loader), #11 (deployment), #16 (safe migrations).

## Roles and ownership

- **Core repository:** generic application, route/UI/API and schema contracts,
  validators, examples and deployment entrypoints.
- **Third-party private repository:** licensed instance content, branding,
  method/journal/assessment definitions and their localized display strings.
- **Deployment repository/workflow:** independently pins the reviewed Core SHA
  and private content SHA, securely checks out the private repo, mounts its
  chosen `content/` directory read-only and supplies secrets at runtime.
- **Runtime storage:** customer/member records, database credentials, OAuth
  secrets, backups, JWT keys, mail tokens and uploaded private data. Never in
  Core Git, sample packs or the instance-content repository.

No private GitHub credentials are required by Core. The preflight never clones
or pushes either repo, and never reports private text or file contents.

## Required content layout

```text
third-party-private-repo/
  content/
    community.json
    assessments/definition.json
    journal/definition.json
    journal/de.json
    journal/en.json
    i18n/de/method.json
    i18n/en/method.json
```

Reference schema and neutral synthetic data:
`examples/neutral-method-pack/`. Mandatory `community.json` contract:
`schemaVersion: 1`, unique `id`, instance `version`,
`platformCompatibility: "^1.0.0"`, `locales: ["de","en"]`,
`assessment: { instrumentId, instrumentVersion, definition }`,
`journal: { definition, translations: { de, en } }`.

The manifest's assessment identity/version must match its definition. Dimension
IDs are stable, unique identifiers and each must have enough rateable questions,
recommendation categories and complete bilingual dimension labels, short labels
and suggestions. Journal categories, fields and prompt IDs require localized
names/text. Do not reuse existing IDs to silently change historical assessment
semantics: new instruments require new revisions and preservation of old answers.

In each `i18n/{de,en}/method.json`, `assessment.scale` supports either the
legacy nonempty string or an object with exactly six nonempty string labels:
`"1"`, `"2"`, `"3"`, `"4"`, `"5"`, and `"na"`. No additional keys or
missing levels are accepted. Both locales use the same validation. This
preflight allowance does not imply that every UI consumer renders individual
labels; runtime presentation needs separate verification.

The `assessment.bands` translation likewise accepts a legacy nonempty string or\nan object with exactly the nonempty string keys `strength`, `solid` and `develop`.\nBoth locale catalogs must satisfy the same shape.\n\n`method.json` holds only the method-owned assessment/journal texts listed in
`METHOD_TRANSLATION_KEYS`, no more and no fewer. A method text may use fewer
placeholders than the Core text it replaces, never other ones.

## Instance texts (`i18n/{de,en}/overrides.json`)

Optional. An instance can replace any existing Core UI text with its own
wording, so that the platform speaks the language of its community (terms,
tone, culture). The Core's own texts stay neutral; the overrides apply to this
instance only, after the Core and method texts. Same nesting as the Core
catalogs, e.g. `{ "nav": { "feed": "Forum" } }`.

Guard rails, checked by `scripts/validate-instance-pack.mjs` before deployment
and by the web app at start (an invalid file stops the instance's pages, as
with method texts):

- only keys the Core already has, no new keys;
- only placeholders the Core text uses (`{name}`, `{count, plural …}`); fewer is fine;
- plain text: no HTML, no links; rich-text tags only if the Core text has them;
- at most 2000 characters per text;
- every replaced key in both languages;
- protected texts stay as in the Core (`PROTECTED_KEYS` in
  `apps/web/src/i18n/instance-text-rules.mjs`): the enforced password rules,
  the data rights and the confirmations of irreversible account deletion.

The pack check prints how many Core texts an instance replaces.
Both locales must be complete before activation. Other language packs and
enabled-language admin selection remain separate scope (#20), not silently
accepted by this v1 contract.

## Check a third-party checkout independently

From the Core checkout after Node 22 is available:

```bash
bash scripts/dev-instance-pack-check.sh /absolute/path/to/third-party-private-repo/content
node --test scripts/validate-instance-pack.test.mjs
```

The first command is **read-only** and prints `PASS` or error codes (no
private strings). Run it against a synthetic copy in CI and against an
operator-supplied local private checkout when permitted. Unknown manifest
compatibility, missing catalogs, instrument mismatches and paths escaping
the content root fail closed. Only canonical absolute directories and regular
JSON files inside the root are accepted.

This command is an **additional preflight**, not a substitute for existing
runtime validation in the API/Web loaders (#13), live browser acceptance (#18),
database migrations (#16) or deployment review (#11). No private pack bytes
are bundled into the generic Core repository or generic build artifact.

## Boundary for #22/#23

The deployment operator supplies **two immutable commit identifiers**:
the pinned Core SHA and the pinned third-party private content SHA. A staging
runner can checkout those separately, validate the private content locally,
mount the same reviewed content version for both API and Web, then run the
user-facing smoke. Failed preflight must leave the active deployment unchanged.
Publishing, rollback, secret management and CI access policies are implemented
in subsequent issues, not in #21.
