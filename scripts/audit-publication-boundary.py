#!/usr/bin/env python3
"""Pre-publication inventory. This is a blocking triage aid, never release approval.

Usage: python3 scripts/audit-publication-boundary.py /path/to/private-denylist.txt
The denylist lives OUTSIDE the repository: one literal case-insensitive term per line.
Review hits, binary assets, licenses, rights and historical refs independently.
"""
import pathlib
import re
import subprocess
import sys

def git(*args):
    return subprocess.check_output(["git", *args])

def main():
    if len(sys.argv) != 2:
        sys.exit("Usage: audit-publication-boundary.py /absolute/private-denylist.txt")
    denylist = pathlib.Path(sys.argv[1]).resolve()
    root = pathlib.Path(git("rev-parse", "--show-toplevel").decode().strip()).resolve()
    if not denylist.is_file() or denylist.is_relative_to(root):
        sys.exit("Provide an existing denylist OUTSIDE the repository")
    terms = [line.strip().casefold() for line in denylist.read_text(encoding="utf-8").splitlines()
             if line.strip() and not line.lstrip().startswith("#")]
    if not terms:
        sys.exit("Refusing empty denylist")
    failures = 0
    binary = []
    paths = git("ls-files", "-z").split(b"\0")
    for raw in filter(None, paths):
        name = raw.decode("utf-8", errors="replace")
        path = root / name
        if not path.is_file():
            print("MISSING TRACKED FILE:", name)
            failures += 1
            continue
        data = path.read_bytes()
        if b"\0" in data:
            binary.append(name)
            continue
        content = data.decode("utf-8", errors="replace").casefold()
        for term in terms:
            if (re.search(re.escape(term) + r"(?![-\w])", name.casefold()) or
                re.search(re.escape(term) + r"(?![-\w])", content)):
                print("DENYLIST MATCH:", name, "(term withheld)")
                failures += 1
                break
    # All refs matter, including stale branches/tags. Never print private addresses.
    commits = git("log", "--all", "--format=%H%x00%ae%x00%ce%x00%B%x00").decode(
        "utf-8", errors="replace").split("\0")
    for i in range(0, len(commits) - 3, 4):
        sha, author, committer, message = commits[i:i+4]
        if not sha.strip():
            continue
        for address in (author, committer):
            if address and not address.casefold().endswith("@users.noreply.github.com"):
                print("REVIEW COMMIT EMAIL:", sha[:12], "(address withheld)")
                failures += 1
                break
        if any(term in message.casefold() for term in terms):
            print("REVIEW COMMIT MESSAGE:", sha[:12])
            failures += 1
    print("Tracked files:", len(paths) - 1)
    print("Binary/non-text files requiring manual review:", len(binary))
    for path in binary:
        print("BINARY REVIEW:", path)
    print("Blocking findings:", failures)
    print("Manual review of binaries, rights, licenses, generated content and historical blobs still required.")
    return 1 if failures or binary else 0

if __name__ == "__main__":
    sys.exit(main())
