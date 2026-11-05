---
description: Cut the next release of the Wisdome 360 site (tag + GitHub release) from the "not released yet" section of docs/changes.md
---

Cut a release of the site. Stop at the first failure and say what failed.

How versions work here:
- The **top section of `docs/changes.md`** is always `## vX.Y.Z — not released yet`. Every change published with `/publish` gets a line there. That section is the next release.
- A release is an **annotated git tag** `vX.Y.Z` on `main` plus a **GitHub release** with the same tag, a name (e.g. "protoclass"), and the notes from that section.
- After a release, the next version gets a new empty "not released yet" section. Bump the last number (v0.0.2 → v0.0.3) unless David asks for something else.

Steps:

1. **Clean and pushed.** `git status` must be clean and `main` equal to `origin/main` (`git fetch`, then `git rev-list --count origin/main..main` = 0). If not, run `/publish` first, or stop and ask.
2. **Read the section.** Take the top `## vX.Y.Z — not released yet` section of `docs/changes.md`. If it has no entries, say there is nothing to release and stop.
3. **Ask David** for the release name (one word or a short phrase) and confirm the version: "Release vX.Y.Z "name" with these notes?" Show the notes. Wait for a yes.
4. **Edit `docs/changes.md`:**
   - Change the heading to `## vX.Y.Z "name" — YYYY-MM-DD` (today).
   - Change its first line from "Changes since … They are already on this site." to one plain sentence describing the release.
   - Add a new section at the top: `## vX.Y.(Z+1) — not released yet` with the line "Changes since vX.Y.Z, *name*. They are already on this site." and no entries yet.
5. **Preflight**, then commit: `Release vX.Y.Z "name"`, and push.
6. **Tag and release:**
   ```bash
   git tag -a vX.Y.Z -m "vX.Y.Z \"name\""
   git push origin vX.Y.Z
   gh release create vX.Y.Z --title "vX.Y.Z \"name\"" --notes-file notes.md --verify-tag
   ```
   `notes.md` is the section's entries (as Markdown), plus one line at the end: "Site: https://dcuartielles.github.io/wisdome-360/". Write it to a temporary file outside the repository.
7. **Check** with `gh release view vX.Y.Z` and report the release URL in one line.

Never move or delete an existing tag, and never edit a published release's tag. If a release needs fixing, make a new patch release.
