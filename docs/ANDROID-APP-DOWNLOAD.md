# Community Android app download

Administrators configure the website download entry under **Admin → Settings →
Android app download**. Enter a public HTTPS APK URL, enable the switch and save.
The setting is disabled on new and upgraded instances until an administrator opts
in. Disabling hides the link while preserving the URL for later use.

The entry appears on the landing and sign-in pages (including plugin auth frames)
and in the signed-in user's existing app menu, outside the Android WebView. The
public `/get-app` page explains installation before login. It links directly to
the configured URL, without proxying files, fetching the URL on the server or
requiring a cross-origin HEAD request. When disabled, the page offers no APK link.
The previously build-time `NEXT_PUBLIC_APK_URL` setting is no longer used by this
page. Operators must explicitly configure the admin setting after upgrading.

## Operator setup

1. Build and verify a signed **release** APK from the community repository using
   the reviewed Square Android shell. Keep the application ID and signing key
   stable and increase versionCode for updates. APK hosting does not certify app
   readiness or replace device acceptance.
2. Store APK and SHA-256 in a versioned community release. If its repository is
   private, use a public HTTPS download host for the same files. Never include
   access tokens or credentials in the public URL.
3. Test the URL from a signed-out browser. It must deliver the intended APK to
   members without repository access, with a suitable content type/download
   filename. Also check any host redirects and the APK signing certificate.
4. Apply the normal reviewed Prisma migration and regenerate the Prisma client
   before starting the updated API. This change adds two PlatformSettings columns;
   it does not repair the separate historical fresh-install migration chain.
5. Configure and enable the download in admin settings. Test it from `/login`
   without a session and through the signed-in member menu.

Existing deployments that have not migrated cannot run the new API code. Roll
back application code first if needed; the additive columns can remain in place.
No database reset or automatic release/deployment is part of this feature.

## Acceptance

- Save URL with the switch off: no public entry and no draft URL in public branding.
- Enable and save: `/login` and `/get-app` work without a session; the link opens
  the configured APK URL and instructions identify the current community origin.
- Reload admin settings and verify persistence; replace the URL and verify the new link.
- Disable and save: the public link disappears. Another visitor's open page can
  retain its cached configuration until the next branding refetch (up to five
  minutes under the existing cache policy). Disabling a link does not revoke an
  already downloaded APK or remove the externally hosted asset.
- Reject HTTP, malformed/credential-bearing URLs and enabling an empty URL.
- A member or anonymous caller must not be able to PUT `/api/admin/settings`.

Focused checks:

```sh
node --experimental-strip-types --test scripts/android-app-download.test.mjs
bash scripts/dev-pnpm.sh --filter @community/core-api exec prisma generate
bash scripts/dev-pnpm.sh --filter @community/core-api test -- src/admin/android-app-download.spec.ts
bash scripts/dev-pnpm.sh --filter @community/web test -- src/components/common/android-app-link.spec.tsx src/middleware.spec.ts
bash scripts/dev-pnpm.sh --filter @community/core-api typecheck
bash scripts/dev-pnpm.sh --filter @community/web typecheck
```

Related: #79 (this website capability), #66 (community APK ownership/build),
#59 (Android shell acceptance). Setting a URL never uploads or signs an APK.
