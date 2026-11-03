# Community-owned Android build

Copy this directory into a separate community repository and replace the synthetic
name, application ID, HTTPS origin and artwork. Do not add real community identity
or signing files to Square. The Android shell remains maintained in Square.

The community owns `android/community.json` and `android/res/`. The latter contains
the adaptive icon foreground VectorDrawable and the `ic_launcher_background` color.
Both debug and release builds overlay these resources without rewriting Square's
tracked resources. A following unbranded build uses the original Square artwork.
The shell's setup and load-error titles use the configured app name too.

## Pin and build

Prerequisites: Linux, Python 3, git, JDK 17 and Android SDK 35. The Square Gradle
wrapper supplies Gradle; no global Gradle installation is needed.

From the community repository root, create the ignored checkout once:

```sh
git clone https://github.com/fgna/square.git .local-square-android
```

Choose a reviewed full Square commit containing this build contract and store it
in `android/square-revision.txt`. Commit that file alongside the identity/artwork.
Never use a moving branch or silently follow upstream `main`. Then build:

```sh
SQUARE_REV="$(cat android/square-revision.txt)"
test "${#SQUARE_REV}" = 40
git -C .local-square-android fetch origin "$SQUARE_REV"
git -C .local-square-android checkout --detach "$SQUARE_REV"
test "$(git -C .local-square-android rev-parse HEAD)" = "$SQUARE_REV"
python3 .local-square-android/apps/mobile-android/build-community.py \
  --config "$PWD/android/community.json" --variant debug
```

The helper runs unit tests and the requested build with the same community
properties. It copies the APK into `android/dist/` with the application ID,
versionCode and variant in the name and writes an adjacent SHA-256 checksum.
The APK file is not a source file and must not be committed.

## Release and download

Supply `KEYSTORE_PATH` (absolute path), `KEYSTORE_PASSWORD`, `KEY_ALIAS` and
`KEY_PASSWORD` through the operator's protected environment. Never commit signing
material. Run the same helper with `--variant release`. A missing signing
configuration fails before starting Gradle. Keep the application ID and signing
key stable, and increase `versionCode` for every distributed update.

Before distribution, verify APK identity, icon, public HTTPS trust, login/logout,
process restart, session separation from another installed community app, and
installation of a newer version over the previous APK. Verify the release signing
certificate using the Android SDK's `apksigner verify --print-certs` and record its
fingerprint, Square commit, community commit, APK version and SHA-256 in release
notes. No build command here publishes an APK or deploys the community.

After approval, attach the release APK and checksum to a versioned release in the
community repository. Download URLs must work for the intended recipients without
repository credentials. If the repository is private, publish the same bytes and
checksum on the community's public HTTPS download host; never expose a GitHub
token in the download URL. Keep secrets and signing files private.

The community website's admin-configured download entry is tracked separately in
Square #79. This build contract supports the APK identity and artifact that the
website links to; it does not implement that website setting.
