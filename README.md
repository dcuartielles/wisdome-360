# Wisdome 360

Course site for making work for the **Wisdome Malmö** dome with open tools: a one-week module for EDT 26 (master) and TEI 26 (bachelor), Malmö University, 9–13 November 2026.

**Site:** https://dcuartielles.github.io/wisdome-360/

Logistics, groups, readings and submission are on Canvas. This repository holds the technical material: how the dome works, the setup wizard, the Dome Simulator, workflows, examples, problems and the delivery spec.

## Build the site locally

```bash
python3 -m venv .venv && . .venv/bin/activate     # Windows: .venv\Scripts\activate
pip install -r requirements.txt
mkdocs serve                                      # http://127.0.0.1:8000
```

Pushing to `main` publishes the site through GitHub Actions (`.github/workflows/pages.yml`). In the repository settings, set **Pages → Source** to **GitHub Actions** once.

## Publishing

Only the local Claude Code agent (or David) commits and pushes. Anyone else who changes files, including Claude sessions working on this folder from claude.ai, adds a line under `## Pending` in `.publish-queue.md` (git-ignored) instead of running git.

The Claude Code hooks and commands live in `claude-setup/` and are copied into `.claude/` (git-ignored) on each computer; the status script says when that copy is missing or out of date. When Claude Code starts in this folder, a hook runs `scripts/publish_status.py` and reports anything waiting: queued entries, uncommitted files, unpushed commits. Then:

- `/first-push`: once, creates the GitHub repository, pushes and turns on Pages.
- `/publish`: runs `scripts/preflight.py` (strict build, no videos or files over 95 MB, credits for new media), commits, pushes and watches the deploy.

See `CLAUDE.md` for the rules.

## Layout

```text
docs/
  index.md, week.md        Start here, the week day by day
  setup/                   setup page + wizard.html (standalone, no libraries)
  tools/                   dome-simulator.html (standalone, no libraries)
  workflows/               Track A and Track B
  examples/                EX-01 … EX-10 (Python examples as notebooks, rendered by mkdocs-jupyter)
  reference/               venue, where to put things
  problems.md, delivery.md, changes.md, credits.md
```

Large files (example videos, tool downloads) go on GitHub Releases, not in the repository.

## Licences

Text and media we made: CC BY-SA 4.0. Code: GPL-3.0. Imported material keeps its own licence; see [LICENSE.md](LICENSE.md) and [Credits](docs/credits.md).
