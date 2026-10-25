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

The three optional color overrides are the initial MVP. A visual editor,
contrast-aware palette generation and additional theme controls are follow-up
work and need separate acceptance. Administrators must check legibility of
their chosen combinations before deployment.
