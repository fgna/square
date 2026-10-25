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

Release tasks fail unless all four signing environment variables are supplied:
`KEYSTORE_PATH`, `KEYSTORE_PASSWORD`, `KEY_ALIAS`, `KEY_PASSWORD`.
No keystores or credentials belong in Git. No public APK distribution is enabled.

## Acceptance still pending

- Generate and test the APK in an Android SDK environment.
- Verify login, reload/session persistence, logout, URL switching and external links
  on a device, including reinstall/update signing compatibility.
- Confirm production APK signing, versioning and release distribution separately.

Tracks [Square #59](https://github.com/fgna/square/issues/59).
