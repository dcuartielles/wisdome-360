#!/usr/bin/env python3
"""Checks to run before every push. Exits non-zero if the push should not happen.

    python scripts/preflight.py

1. mkdocs build --strict succeeds (broken links, bad nav, missing files).
2. No file over 95 MB (GitHub refuses files over 100 MB) and no video files in the repo
   (videos go on GitHub Releases).
3. Media in docs/ that is new since the last push and not mentioned in docs/credits.md
   is listed as a warning: if we didn't make it, it needs a credit before it goes public.
4. docs/changes.md was touched if any page under docs/ changed (warning only).

GPL-3.0. Standard library only, plus mkdocs from requirements.txt.
"""
import os
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MEDIA = {".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg", ".mp3", ".wav", ".ogg", ".pdf"}
VIDEO = {".mp4", ".mov", ".mkv", ".webm", ".avi"}
LIMIT = 95 * 1024 * 1024


def run(cmd):
    return subprocess.run(cmd, cwd=ROOT, capture_output=True, text=True)


def changed_since_push():
    """Paths changed vs origin's branch, plus untracked and uncommitted ones."""
    paths = set()
    r = run(["git", "diff", "--name-only", "@{u}"])
    if r.returncode != 0:  # nothing pushed yet: everything counts
        r = run(["git", "ls-files"])
    paths.update(p for p in r.stdout.splitlines() if p)
    r = run(["git", "ls-files", "--others", "--exclude-standard"])
    paths.update(p for p in r.stdout.splitlines() if p)
    return sorted(paths)


def main():
    errors, warnings = [], []

    r = run([sys.executable, "-m", "mkdocs", "build", "--strict", "--quiet"])
    if r.returncode != 0:
        errors.append("mkdocs build --strict failed:\n" + (r.stderr or r.stdout)[-3000:])

    tracked = run(["git", "ls-files", "--cached", "--others", "--exclude-standard"]).stdout.splitlines()
    for p in tracked:
        full = os.path.join(ROOT, p)
        if not os.path.isfile(full):
            continue
        ext = os.path.splitext(p)[1].lower()
        if os.path.getsize(full) > LIMIT:
            errors.append(f"{p} is over 95 MB: put it on GitHub Releases")
        elif ext in VIDEO:
            errors.append(f"{p} is a video: put it on GitHub Releases and link to it")

    changed = changed_since_push()
    credits = open(os.path.join(ROOT, "docs", "credits.md"), encoding="utf-8").read()
    for p in changed:
        if p.startswith("docs/") and os.path.splitext(p)[1].lower() in MEDIA:
            if os.path.basename(p) not in credits:
                warnings.append(f"{p}: new media. If we didn't make it, add it to docs/credits.md "
                                f"with source, author and licence before publishing.")

    pages = [p for p in changed if p.startswith("docs/") and p.endswith(".md") and p != "docs/changes.md"]
    if pages and "docs/changes.md" not in changed:
        warnings.append("pages changed but docs/changes.md didn't: add an entry if students would notice")

    for w in warnings:
        print("WARNING: " + w)
    for e in errors:
        print("ERROR: " + e)
    if errors:
        print("Preflight FAILED: do not push.")
        return 1
    print("Preflight OK" + (" (with warnings above)" if warnings else "") + ".")
    return 0


if __name__ == "__main__":
    sys.exit(main())
