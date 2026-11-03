#!/usr/bin/env python3
"""Build a community-owned APK using this pinned Square checkout. No publishing."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
from urllib.parse import urlsplit


def read_config(path):
    config = json.loads(path.read_text(encoding="utf-8"))
    required = {"name", "applicationId", "url", "versionCode", "versionName", "resources"}
    if not isinstance(config, dict) or set(config) != required:
        raise ValueError("Config must contain exactly: " + ", ".join(sorted(required)))
    for key in required - {"versionCode"}:
        if not isinstance(config[key], str) or not config[key].strip():
            raise ValueError(f"{key} must be a non-empty string")
    if not re.fullmatch(r"[A-Za-z_][A-Za-z0-9_]*(\.[A-Za-z_][A-Za-z0-9_]*)+", config["applicationId"]):
        raise ValueError("Invalid applicationId")
    url = urlsplit(config["url"])
    if (url.scheme != "https" or not url.hostname or url.username is not None
            or url.password is not None or url.path not in ("", "/") or url.query or url.fragment
            or (url.port is not None and not 1 <= url.port <= 65535)):
        raise ValueError("url must be an HTTPS origin without credentials, path, query or fragment")
    if type(config["versionCode"]) is not int or not 1 <= config["versionCode"] <= 2100000000:
        raise ValueError("versionCode must be an integer between 1 and 2100000000")
    resources = (path.parent / config["resources"]).resolve()
    for relative in ("drawable/ic_launcher_foreground.xml", "values/colors.xml"):
        if not (resources / relative).is_file():
            raise ValueError(f"Missing branding resource: {relative}")
    config["resources"] = str(resources)
    return config


def build(config_path, project, variant, output):
    config = read_config(config_path)
    if variant == "release":
        signing = ("KEYSTORE_PATH", "KEYSTORE_PASSWORD", "KEY_ALIAS", "KEY_PASSWORD")
        if not all(os.environ.get(key) for key in signing):
            raise ValueError("Release requires all four signing environment variables; see README")
        if not Path(os.environ["KEYSTORE_PATH"]).is_absolute():
            raise ValueError("KEYSTORE_PATH must be absolute")
        if not Path(os.environ["KEYSTORE_PATH"]).is_file():
            raise ValueError("KEYSTORE_PATH must point to an existing keystore")
    properties = [
        f'-PcommunityName={config["name"]}',
        f'-PcommunityAppId={config["applicationId"]}',
        f'-PcommunityUrl={config["url"]}',
        f'-PcommunityVersionCode={config["versionCode"]}',
        f'-PcommunityVersionName={config["versionName"]}',
        f'-PcommunityResDir={config["resources"]}',
    ]
    # Use argv, never a shell; signing secrets stay in the inherited environment.
    subprocess.run([str(project / "gradlew"), "testDebugUnitTest",
                    "assemble" + variant.capitalize(), *properties], cwd=project, check=True)
    source = project / "app/build/outputs/apk" / variant / f"app-{variant}.apk"
    if not source.is_file():
        raise ValueError("Gradle did not produce the expected APK")
    output.mkdir(parents=True, exist_ok=True)
    name = f'{config["applicationId"]}-{config["versionCode"]}-{variant}.apk'
    target = output / name
    shutil.copyfile(source, target)
    digest = hashlib.sha256(target.read_bytes()).hexdigest()
    target.with_suffix(".apk.sha256").write_text(f"{digest}  {name}\n", encoding="utf-8")
    print(f"APK: {target}\nSHA-256: {digest}")
    return target


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--config", type=Path, required=True)
    parser.add_argument("--variant", choices=("debug", "release"), default="debug")
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()
    config_path = args.config.resolve()
    try:
        build(config_path, Path(__file__).resolve().parent, args.variant,
              (args.output or config_path.parent / "dist").resolve())
    except (ValueError, OSError, subprocess.CalledProcessError) as error:
        parser.exit(1, f"Build failed: {error}\n")


if __name__ == "__main__":
    main()
