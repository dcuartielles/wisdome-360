#!/usr/bin/env python3
"""Tell Claude Code (or a person) whether the site needs publishing.

Used by the SessionStart and UserPromptSubmit hooks in .claude/settings.json.
Prints nothing when there is nothing to publish (so the hook stays silent),
otherwise one short block saying what is waiting and to run /publish.

    python scripts/publish_status.py           # full report (SessionStart)
    python scripts/publish_status.py --quiet   # one line, only if something is waiting

Signals checked:
  1. Entries under "## Pending" in .publish-queue.md (written by whoever changed files,
     including Claude sessions working on this folder from the cloud, which never run git here).
  2. Uncommitted changes in the working tree.
  3. Local commits not yet pushed to origin.
  4. No origin remote yet (first push not done).
  5. claude-setup/ differs from .claude/ (hooks and commands not installed or out of date).

GPL-3.0. Standard library only.
"""
import filecmp
import os
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
QUEUE = os.path.join(ROOT, ".publish-queue.md")
SETUP = os.path.join(ROOT, "claude-setup")   # source of truth, editable from the cloud
LIVE = os.path.join(ROOT, ".claude")         # what Claude Code reads; only writable locally


def setup_out_of_date():
    """Files in claude-setup/ missing from .claude/ or different there."""
    stale = []
    for base, _, files in os.walk(SETUP):
        for f in files:
            src = os.path.join(base, f)
            rel = os.path.relpath(src, SETUP)
            dst = os.path.join(LIVE, rel)
            if not os.path.exists(dst) or not filecmp.cmp(src, dst, shallow=False):
                stale.append(rel.replace(os.sep, "/"))
    return stale


def git(*args):
    try:
        r = subprocess.run(["git", *args], cwd=ROOT, capture_output=True, text=True, timeout=20)
        return r.returncode, r.stdout.rstrip()
    except Exception as e:  # git missing, timeout
        return 1, str(e)


def pending_entries():
    if not os.path.exists(QUEUE):
        return []
    out, on = [], False
    with open(QUEUE, encoding="utf-8") as f:
        for line in f:
            s = line.rstrip("\n")
            if s.startswith("## "):
                on = s.strip().lower() == "## pending"
                continue
            if on and s.lstrip().startswith("- "):
                out.append(s.strip()[2:])
    return out


def main():
    quiet = "--quiet" in sys.argv
    queue = pending_entries()

    code, porcelain = git("status", "--porcelain")
    dirty = [l for l in porcelain.splitlines() if l.strip()] if code == 0 else []

    code, remotes = git("remote")
    has_origin = code == 0 and "origin" in remotes.split()

    ahead = None
    if has_origin:
        if not quiet:  # keep the per-prompt hook fast and offline
            git("fetch", "--quiet", "origin")
        code, n = git("rev-list", "--count", "@{u}..HEAD")
        ahead = int(n) if code == 0 and n.isdigit() else None

    reasons = []
    stale = setup_out_of_date()
    if stale:
        reasons.append("Claude Code setup not installed or out of date (" + ", ".join(stale)
                       + "): copy claude-setup/ into .claude/, then restart Claude Code so the hooks load")
    if not has_origin:
        reasons.append("the repository has never been pushed (no origin) — run /first-push")
    if queue:
        reasons.append(f"{len(queue)} queued change(s) in .publish-queue.md")
    if dirty:
        reasons.append(f"{len(dirty)} uncommitted file(s)")
    if ahead:
        reasons.append(f"{ahead} commit(s) not pushed")
    if has_origin and ahead is None:
        reasons.append("no upstream branch set (push with -u)")

    if not reasons:
        return 0

    if quiet:
        print("PUBLISH PENDING: " + "; ".join(reasons) + ". Tell David and offer to run " + ("/first-push" if not has_origin else "/publish") + ".")
        return 0

    print("=== Wisdome 360 site: publishing status ===")
    for r in reasons:
        print(" - " + r)
    if queue:
        print("Queued changes:")
        for q in queue:
            print("   * " + q)
    if dirty:
        print("Uncommitted files (first 15):")
        for l in dirty[:15]:
            print("   " + l)
    print("Next: tell David what is waiting and offer to run "
          + ("/first-push" if not has_origin else "/publish")
          + ". Do not push without his go-ahead in this session.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
