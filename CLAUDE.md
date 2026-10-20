# Wisdome 360: course site

Public course site for the Wisdome Malmö dome module (EDT 26 + TEI 26, Malmö University, 9–13 Nov 2026). MkDocs Material, built and deployed to GitHub Pages by `.github/workflows/pages.yml` on every push to `main`.

- Repository: https://github.com/dcuartielles/wisdome-360 (public, owner David Cuartielles)
- Site: https://dcuartielles.github.io/wisdome-360/
- This folder sits inside David's working folder `10 - Wisdome 360 projection`, which is a **separate** git repo that ignores `wisdome-360/`. Never commit files from the parent folder here, and never run git commands against the parent repo from here.

## Who changes what

Two kinds of agents work on this folder:

1. **Cloud Claude sessions** (claude.ai, linked to this computer) edit content here, but **never run git in this folder**: the bridge can't delete files, so git leaves lock files behind. Instead, they append one line per change under `## Pending` in `.publish-queue.md`.
2. **You, Claude Code running locally in this folder**, are the only one who commits and pushes, and the only one who can write `.claude/`. You find out there is something to publish from the hooks (below), from `.publish-queue.md`, or from `git status`.

## First thing in every session

If no publishing status was reported when this session started, the hooks aren't installed: run `python scripts/publish_status.py` yourself and act on it.

**Installing the hooks and commands.** Cloud sessions can't write to `.claude/`, so the source of truth is `claude-setup/`. When the status says the setup is missing or out of date, tell David, and with his OK copy it over, keeping the folder structure:

```bash
mkdir -p .claude && cp -r claude-setup/. .claude/     # PowerShell: Copy-Item -Recurse -Force claude-setup\* .claude\
```

Then ask him to restart Claude Code so the hooks load. Never edit `.claude/` directly: change `claude-setup/` and copy again.

## When to publish

Once installed, the hooks in `.claude/settings.json` run `scripts/publish_status.py`:
- at **session start**, a full report;
- on **every prompt**, one line, only when something is waiting.

If the status says something is waiting, tell David in one or two lines what is waiting, and offer `/publish` (or `/first-push` if there is no `origin` yet). **Push only when David says so in this session.** A queued entry is not permission to push.

## Commands

- `/first-push`: create the GitHub repository, push, turn on Pages, check the site is live. Once only.
- `/publish`: preflight checks, commit, push, watch the deploy, move queue entries to Published.

## Rules for every push

- Run `python scripts/preflight.py` first. If it fails, stop and report; don't push around it.
- Never force-push, never rewrite published history, never push to a branch other than `main` without being asked.
- Videos and anything over 95 MB go on **GitHub Releases**, not in the repository (`gh release upload`).
- **Licences.** Text and media we made: CC BY-SA 4.0. Code: GPL-3.0. Anything imported keeps its own licence and must be listed in `docs/credits.md` (source, author, licence, link) before it is published. If an item's licence doesn't allow public redistribution (e.g. the EX-10 UltraKey dove clip), don't publish it: link to the source instead. If unsure, ask David.
- Student-visible changes get a dated line in `docs/changes.md`, newest first.
- Never add readings or other copyrighted PDFs: those live on Canvas only.
- Never publish anything about individual students (names, groups' work, photos) without David's go-ahead.

## Local setup (once per computer)

```bash
python -m venv .venv
# Windows: .venv\Scripts\activate    macOS/Linux: . .venv/bin/activate
pip install -r requirements.txt
mkdocs serve        # preview at http://127.0.0.1:8000
```

Use the venv's Python for `scripts/preflight.py`, because it runs mkdocs. Versions are pinned on purpose: MkDocs 2.0 drops plugins, so don't upgrade mkdocs or mkdocs-material without asking.

## Layout

```text
docs/index.md, week.md       Start here, the week
docs/setup/wizard.html       setup wizard (standalone HTML, no libraries)
docs/tools/                  Dome Simulator (standalone HTML)
docs/workflows/              Track A, Track B
docs/examples/               examples (Python ones as .ipynb via mkdocs-jupyter)
docs/reference/              venue, comfortable zone
docs/problems.md, delivery.md, changes.md, credits.md
scripts/                     publish_status.py, preflight.py
claude-setup/                hooks (settings.json) and /first-push, /publish: copied into .claude/
.publish-queue.md            hand-off list from cloud sessions (git-ignored)
```
