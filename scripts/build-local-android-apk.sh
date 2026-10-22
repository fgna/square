#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
[[ "${COMMUNITY_LAN_IP:-192.168.1.121}" == "192.168.1.121" ]] || { echo "This prototype supports only 192.168.1.121." >&2; exit 1; }
for command in git python3 java; do command -v "$command" >/dev/null || { echo "Missing $command" >&2; exit 1; }; done
if [[ -z "${ANDROID_HOME:-${ANDROID_SDK_ROOT:-}}" ]]; then
  for candidate in "$HOME/Android/Sdk" "$HOME/android-sdk" /opt/android-sdk /usr/local/lib/android/sdk; do
    if [[ -d "$candidate/platforms" && -d "$candidate/build-tools" ]]; then
      export ANDROID_HOME="$candidate"
      break
    fi
  done
fi
[[ -n "${ANDROID_HOME:-${ANDROID_SDK_ROOT:-}}" ]] || { echo "Android SDK missing. Install SDK platform 36 and build-tools 36.0.0; set ANDROID_HOME." >&2; exit 1; }
export ANDROID_HOME="${ANDROID_HOME:-$ANDROID_SDK_ROOT}"
[[ -d "$ANDROID_HOME/platforms/android-36" ]] || { echo "Install Android SDK platform 36" >&2; exit 1; }
[[ -d "$ANDROID_HOME/build-tools/36.0.0" ]] || { echo "Install Android SDK build-tools 36.0.0" >&2; exit 1; }
echo "Using Android SDK: $ANDROID_HOME"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
[[ -n "${ANDROID_WRAPPER_SOURCE_DIR:-}" && -d "${ANDROID_WRAPPER_SOURCE_DIR}/gradle/wrapper" ]] || { echo "Set ANDROID_WRAPPER_SOURCE_DIR to a reviewed, licensed Android wrapper checkout (apps/mobile-android)." >&2; exit 1; }
echo "Copying approved local Android wrapper into disposable workspace..."
cp -a -- "${ANDROID_WRAPPER_SOURCE_DIR}" "$WORK/mobile-android"
ANDROID="$WORK/mobile-android"
[[ -s "$ANDROID/gradle/wrapper/gradle-wrapper.jar" ]] || { echo "Missing Gradle wrapper JAR" >&2; exit 1; }
python3 - "$ANDROID" <<'PY'
from pathlib import Path
import sys
p=Path(sys.argv[1])
web=p/'app/src/main/java/com/community/app/WebViewActivity.kt'
code=web.read_text()
old='value.scheme.equals("https", true) && !value.host.isNullOrBlank() &&'
new='value.scheme.equals("https", true) && !value.host.isNullOrBlank() &&'
assert code.count(old)==1, "WebView origin guard changed; review required"
code=code.replace(old,new)
old='two.scheme.equals("https", true) && two.host?.equals(one.host, true) == true &&'
new='two.scheme.equals(one.scheme, true) && two.host?.equals(one.host, true) == true &&'
assert code.count(old)==1, "WebView same-origin guard changed; review required"
web.write_text(code.replace(old,new))
manifest=p/'app/src/debug/AndroidManifest.xml'
manifest.write_text('''<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android">
 <application android:networkSecurityConfig="@xml/network_security_config" />
</manifest>
''')
strings=p/'app/src/main/res/values/strings.xml'
content=strings.read_text().replace('https://community.example.com','https://192.168.1.121:4443')
strings.write_text(content)
PY
echo "Building test-only Android APK using existing Gradle wrapper..."
(cd "$ANDROID" && bash ./gradlew testDebugUnitTest assembleDebug)
APK="$ANDROID/app/build/outputs/apk/debug/app-debug.apk"
[[ -s "$APK" ]] || { echo "No debug APK generated" >&2; exit 1; }
TARGET="$ROOT/apps/web/debug-apk"
mkdir -p "$TARGET"
install -m 0644 "$APK" "$TARGET/community.apk"
(cd "$TARGET" && sha256sum community.apk > community.apk.sha256)
echo "Ready for local HTTPS demo only: $TARGET/community.apk"
echo "Restart only local demo to enable the download link."
