# Community color customization

Square provides the built-in themes `executive-glass`, `corporate-light`, and `high-contrast`.

Instance maintainers can optionally add `branding` to their **external**
`content/community.json` (the example here is an excerpt, not a complete manifest):

```json
{
  "branding": {
    "theme": "corporate-light",
    "colors": {
      "primary": "#245A81",
      "secondary": "#745DA8",
      "accent": "#BB7733"
    }
  }
}
```

The selected theme supplies backgrounds, text colors, effects, layout and all
unmodified values. Colors must be six-digit hexadecimal strings. The existing
user theme selector continues to work; overrides apply to whichever built-in
theme is selected. Existing saved user theme preferences take precedence over
the instance's default theme.

Run `bash scripts/dev-instance-pack-check.sh /absolute/path/to/content`
before deployment. The web process must use the same
`COMMUNITY_CONTENT_DIR`. Do not add customer branding to the public Core repo.

The `high-contrast` theme deliberately ignores custom color overrides to preserve its accessible palette. For other themes, Square derives dark or light foreground tokens for colored controls. Administrators must still review text and background contrast across the full experience.

The three optional color overrides are the initial MVP. A visual editor,
contrast-aware palette generation and additional theme controls are follow-up
work and need separate acceptance. Administrators must check legibility of
their chosen combinations before deployment.

## Isolated browser acceptance

An optional Playwright smoke test is provided at
`apps/web/e2e/community-branding.spec.ts`. Use only a disposable local instance
with an external content pack configured with theme `corporate-light` and
primary color `#245A81`. The existing `scripts/dev-instance-up.sh` demo
launcher forces the neutral example pack, so it cannot be used unchanged to
verify these external branding overrides.

Run the smoke from `apps/web` once an isolated instance is running:

```bash
SQUARE_THEME_TEST_URL=http://127.0.0.1:4300/login pnpm exec playwright test e2e/community-branding.spec.ts
```

The test checks initial colors, reload persistence, and the high-contrast
user preference. It is an opt-in browser acceptance test, not part of CI's
default jsdom/unit suite. Use a fresh browser context with no prior saved
theme preference and confirm the content pack used by the web process.
