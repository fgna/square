import contextlib
import hashlib
import importlib.util
import io
import json
import os
from pathlib import Path
import subprocess
import tempfile
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location("build_community", Path(__file__).parents[1] / "build-community.py")
builder = importlib.util.module_from_spec(spec)
spec.loader.exec_module(builder)


class CommunityBuildTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)
        self.config_path = self.root / "community/android/community.json"
        self.config_path.parent.mkdir(parents=True)
        self.resources = self.config_path.parent / "res"
        for name in ("drawable/ic_launcher_foreground.xml", "values/colors.xml"):
            target = self.resources / name
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_text("<resources/>")
        self.config = dict(name="Example Community", applicationId="org.example.community",
                           url="https://community.example.com", versionCode=7, versionName="1.2",
                           resources="res")
        self.project = self.root / "square/apps/mobile-android"
        self.output = self.config_path.parent / "dist"
        self.save()

    def save(self):
        self.config_path.write_text(json.dumps(self.config))

    def build(self, variant="debug"):
        with contextlib.redirect_stdout(io.StringIO()):
            return builder.build(self.config_path, self.project, variant, self.output)

    def fake_gradle(self, command, **kwargs):
        self.assertEqual(kwargs, dict(cwd=self.project, check=True))
        self.assertIn(f"-PcommunityResDir={self.resources}", command)
        self.assertIn("-PcommunityVersionCode=7", command)
        self.assertIn("-PcommunityName=Example Community", command)
        variant = "release" if "assembleRelease" in command else "debug"
        target = self.project / "app/build/outputs/apk" / variant / f"app-{variant}.apk"
        target.parent.mkdir(parents=True)
        target.write_bytes(b"synthetic APK output")

    def test_external_resources_and_identity_are_passed_and_output_is_checksummed(self):
        self.config["name"] = 'Example $(touch unsafe); "Community"'
        self.save()
        # Literal argv preserves punctuation without executing a shell.
        with patch.object(builder.subprocess, "run") as run:
            run.side_effect = lambda command, **kwargs: self.make_apk()
            target = self.build()
        command = run.call_args.args[0]
        self.assertIn(f'-PcommunityName={self.config["name"]}', command)
        self.assertIn(f"-PcommunityResDir={self.resources}", command)
        self.assertIn("testDebugUnitTest", command)
        self.assertEqual(target.name, "org.example.community-7-debug.apk")
        digest = hashlib.sha256(b"synthetic APK output").hexdigest()
        self.assertEqual(target.with_suffix(".apk.sha256").read_text(), f"{digest}  {target.name}\n")
        self.assertFalse((self.root / "unsafe").exists())

    def make_apk(self):
        target = self.project / "app/build/outputs/apk/debug/app-debug.apk"
        target.parent.mkdir(parents=True)
        target.write_bytes(b"synthetic APK output")

    def test_invalid_origins_and_identity_fail_before_gradle(self):
        cases = [("url", value) for value in ("http://example.com", "https://a:b@example.com",
                 "https://example.com/path", "https://example.com?q=1", "https://example.com#x",
                 "https://example.com:0", "https://example.com:99999")]
        cases += [("applicationId", "../bad"), ("versionCode", 0), ("versionCode", True)]
        for key, value in cases:
            with self.subTest(key=key, value=value):
                saved = self.config[key]
                self.config[key] = value
                self.save()
                with patch.object(builder.subprocess, "run") as run:
                    with self.assertRaises(ValueError):
                        self.build()
                    run.assert_not_called()
                self.config[key] = saved

    def test_missing_branding_fails_before_gradle(self):
        (self.resources / "drawable/ic_launcher_foreground.xml").unlink()
        with patch.object(builder.subprocess, "run") as run:
            with self.assertRaisesRegex(ValueError, "Missing branding"):
                self.build()
            run.assert_not_called()

    def test_gradle_failure_does_not_publish_stale_output(self):
        self.make_apk()
        with patch.object(builder.subprocess, "run", side_effect=subprocess.CalledProcessError(1, "gradlew")):
            with self.assertRaises(subprocess.CalledProcessError):
                self.build()
        self.assertFalse(self.output.exists())

    def test_missing_apk_is_not_reported_as_success(self):
        with patch.object(builder.subprocess, "run"):
            with self.assertRaisesRegex(ValueError, "expected APK"):
                self.build()

    def test_release_requires_signing_without_exposing_secrets(self):
        with patch.dict(os.environ, {}, clear=True), patch.object(builder.subprocess, "run") as run:
            with self.assertRaisesRegex(ValueError, "signing environment"):
                self.build("release")
            run.assert_not_called()

    def test_release_passes_community_properties_and_copies_release_artifact(self):
        keystore = self.root / "signing.jks"
        keystore.write_bytes(b"fixture")
        env = dict(KEYSTORE_PATH=str(keystore), KEYSTORE_PASSWORD="test-store-secret",
                   KEY_ALIAS="example", KEY_PASSWORD="test-key-secret")
        with patch.dict(os.environ, env), patch.object(builder.subprocess, "run", side_effect=self.fake_gradle) as run:
            target = self.build("release")
        self.assertTrue(target.is_file())
        self.assertEqual(target.name, "org.example.community-7-release.apk")
        self.assertNotIn("test-store-secret", str(run.call_args))
        self.assertNotIn("test-key-secret", str(run.call_args))


if __name__ == "__main__":
    unittest.main()
