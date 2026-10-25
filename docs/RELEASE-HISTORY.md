# Release history workflow

Square's release notes are written in English. For every user-visible change, add a **new** JSON file under `changes/` in the same PR as the code. Example:

```json
{
  "title": "Manage event reminders",
  "category": "improved",
  "audience": "members",
  "description": "Members can update reminders from the event details.",
  "pr": 123
}
```

Choose one category: `new`, `improved`, `fixed`, or `removed`. Use a unique filename and concise language. Include important bug fixes, removed behavior and breaking changes, not only new features. An entry is only a candidate for release publication until the containing commit is included in a published release.

A GitHub Actions gate checks runtime-code pull requests for an entry. For internal-only work without a user-facing impact, add a **new, uniquely named** `changes/no-user-facing-<issue-or-pr>.md` in that PR with a brief explanation. An edit to an existing entry or exemption does not satisfy the gate; each PR must add a new file. Editors should review claims before a release.

Generate a draft from a prior published tag to the release commit:

```bash
node scripts/release-history.mjs generate v1.0.0 HEAD
```

The generator reads **newly added** entries between the refs using Git, so the output is repeatable and covers all commits in that range. At release time compare the latest published tag with the new tag, verify the draft and publish the reviewed text in the GitHub release. Preserve historical release notes; never rewrite earlier versions because newer changes were merged. Publishing releases and changing an existing release description require explicit approval.

The first release announcement remains at [v1.0.0](whats-new/v1.0.0.md). The repository's first release is a **source release**, not proof of production deployment readiness. A future in-app release history can consume the reviewed versioned Markdown output without any per-user last-visit tracking.

## Preparing and publishing a source release

Use the GitHub Actions **Publish Square source release with history** workflow on the `main` branch, enter a new `vX.Y.Z` tag, and leave **publish = false** to review the generated, downloadable release-notes artifact. When the notes and release are approved, rerun that same workflow for the same tag with **publish = true**. The workflow selects the latest version tag, runs the history regression suite, and generates release notes from entries since that tag. It refuses to publish if there are no recorded user-facing changes, if the tag already exists, or if the baseline is not an ancestor of `main`.

Publishing with this workflow creates the GitHub tag and release with the generated notes in one operation. The `publish` switch is the explicit approval required for release publication. Do not create release tags manually. **GitHub cannot prevent administrators from using other GitHub release interfaces to bypass a workflow**, so protecting the release process organizationally requires branch protection and limiting release permissions or using a protected environment in addition to this workflow.

The release workflow publishes **source releases**, not deployed production instances. It does not assert deployment or fresh-install acceptance.
