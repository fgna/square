# Square Android (experimental)

Minimal native Android shell for a Square HTTPS instance. Migrated from the former
Community Platform WebView design, with the existing `com.community.app` application ID
retained for potential update continuity. Existing installed APKs also require a matching
signing certificate to update in place.

The web app owns authentication through its normal cookies. This wrapper has no JavaScript
token bridge, no native login, no push notifications and no offline-content guarantee.
Only the configured HTTPS origin is allowed within the WebView. Other HTTPS links open
in the system browser. Switching servers clears WebView cookies and storage globally.

## Debug build

Use JDK 17 and Android SDK platform 35. The original Gradle 8.11.1 wrapper
(script, JAR and distribution properties) is included. No global Gradle install
is required.

```sh
cd apps/mobile-android
./gradlew testDebugUnitTest assembleDebug
adb install -r app/build/outputs/apk/debug/app-debug.apk
```

For a LAN server such as `https://192.168.1.121:3443`, install and verify the
local CA on the test device first. Only debug builds trust user-installed CAs;
release builds retain platform TLS verification. Never bypass certificate errors.

If the instance cannot be loaded, the app shows the reason instead of a blank
page, with "Try again" and (in the generic app) "Change server". A LAN server
with Caddy's `tls internal` needs its root certificate
(`caddy-data/caddy/pki/authorities/local/root.crt`) installed on the device under
Settings → Security → Encryption & credentials → Install a certificate → CA
certificate. Accepting a browser warning in Chrome does not make the app trust it.

Release tasks fail unless all four signing environment variables are supplied:
`KEYSTORE_PATH`, `KEYSTORE_PASSWORD`, `KEY_ALIAS`, `KEY_PASSWORD`.
No keystores or credentials belong in Git. No public APK distribution is enabled.

## Acceptance still pending

- Generate and test the APK in an Android SDK environment.
- Verify login, reload/session persistence, logout, URL switching and external links
  on a device, including reinstall/update signing compatibility.
- Confirm production APK signing, versioning and release distribution separately.

Tracks [Square #59](https://github.com/fgna/square/issues/59).

## White-label APK for an independent community

Build from the same sources with an independent Android application ID, launcher
name and pinned HTTPS origin. Example (replace the URL with the actual Turbo Mathe
HTTPS origin before running):

```sh
cd apps/mobile-android
./gradlew testDebugUnitTest
./gradlew assembleDebug \
  -PcommunityName="Turbo Mathe" \
  -PcommunityAppId="de.turbomathe.app" \
  -PcommunityUrl="https://YOUR-TURBO-MATHE-DOMAIN"
```

The resulting `app/build/outputs/apk/debug/app-debug.apk` installs as a separate
Android app, opens the configured instance directly, and does not display the
generic server URL setup screen. The standard build without properties remains
the shared Square app. Use a distinct and stable package ID per community;
changing it creates a new installation. Ensure a trusted HTTPS certificate.

**Brand artwork:** for a community-specific launcher icon, replace
`app/src/main/res/drawable/ic_launcher_foreground.xml` and the background
color in `app/src/main/res/values/colors.xml` in the community's build
checkout (or add a dedicated Android product flavor). The old Community icon
remains the default until a branded asset is supplied. The build properties
alone do not customize the icon yet.

**Release:** supply signing credentials via the documented environment variables
and use `assembleRelease`. Keep the same signing key, application ID and
incrementing versionCode for updates. No public APK distribution is configured.
