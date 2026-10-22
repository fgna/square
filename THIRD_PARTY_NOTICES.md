# Third-party and prior-license notices

## Incorporated source code (MIT)

Portions of the source were previously distributed under the following MIT license. Preserve this notice in redistributions of those portions. The overall neutral Core is intended to be distributed under Apache-2.0 after its release checks are satisfied.

```text
MIT License

Copyright (c) 2026 Community Platform Contributors

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## Package dependencies

Dependencies installed by pnpm are not relicensed by the Core's Apache-2.0 designation. Keep their own licenses and required notices when distributing bundled binaries or dependency source. Generate a version-specific inventory from the lockfile-resolved installation with `pnpm licenses list --json` and review exceptional/nonpermissive entries before a release. This document does not assert a complete dependency-license inventory.

## Reviewed dependency exceptions (inventory dated 2026-10-22)

This section records exceptions reported by a local `pnpm licenses list --json`
against an installed dependency tree. It is not a substitute for a complete
versioned release SBOM or for preserving license texts when redistributing
third-party binaries.

- **BlueOak-1.0.0:** `jackspeak`, `minimatch`, `minipass`,
  `package-json-from-dist`, `path-scurry`. Permissive license; a copy
  or link to its text is required on distribution:
  https://blueoakcouncil.org/license/1.0.0
- **CC-BY-4.0:** `caniuse-lite` browser-support data. Attribution:
  Data from https://caniuse.com/ via https://github.com/browserslist/caniuse-lite,
  licensed under https://creativecommons.org/licenses/by/4.0/ .
- **LGPL-3.0-or-later (package metadata):**
  `@img/sharp-libvips-linux-x64` and
  `@img/sharp-libvips-linuxmusl-x64`. Before distributing Linux
  containers or binaries including these packages, preserve their licenses
  and verify the corresponding-source/relinking obligations of the *actual*
  packaged versions. The upstream libvips project also publishes LGPL
  licensing information; do not infer these two packages' exact conditions
  solely from the upstream project label.
- **Python-2.0 (installed inventory):** `argparse`. Preserve its installed
  version's license/copyright terms when redistributing it; do not use the
  current upstream version as evidence of the installed version's metadata.
- **Undeclared in installed metadata:** `pause@0.0.1`. The installed package has no `license` field or LICENSE file. Independent third-party software notices for this exact version identify it as MIT, Copyright (c) 2012 TJ Holowaychuk (see https://www.oxygenxml.com/InstData/ContentFusion/7.1/kit/third-party-components-pdfs/third-party-components-config-server.pdf). Preserve the corresponding MIT notice if bundled; confirm against the upstream v0.0.1 source prior to binary distribution. This metadata gap does not block the source-only repository release.

The source-only repository does not intentionally vendor dependencies.
The license of each installed or bundled package remains its own. Recheck
against pinned versions for each actual distributable artifact.
