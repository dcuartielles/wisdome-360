---
description: Create the GitHub repository, push the site for the first time and turn on GitHub Pages
---

Put the Wisdome 360 site on GitHub for the first time. Do the steps in order and stop at the first failure, saying what failed.

1. **Check the state.** Run `git status`, `git log --oneline -5` and `git remote -v`. If `origin` already exists, stop: tell David the first push is done and suggest `/publish`.
2. **Check the tools.** Run `gh auth status`. It must be logged in as `dcuartielles` with the `repo` and `workflow` scopes. If not, ask David to run `gh auth login` (or `gh auth refresh -s workflow`) himself, and wait. If `gh` isn't installed, give him the install link (https://cli.github.com) and the manual route at the end of this file.
3. **Preflight.** Set up the venv if `.venv` is missing (see CLAUDE.md), then run `python scripts/preflight.py` with the venv's Python. Stop if it fails.
4. **Commit what is waiting.** If `git status` shows changes, read `.publish-queue.md`, commit everything with a message that summarises the queued entries, and move them from `## Pending` to `## Published` with today's date and the commit's short hash.
5. **Confirm with David.** Say: "This creates the public repository dcuartielles/wisdome-360 and publishes the site at https://dcuartielles.github.io/wisdome-360/. Go ahead?" Wait for yes.
6. **Create and push:**
   ```bash
   gh repo create dcuartielles/wisdome-360 --public \
     --description "Making work for the Wisdome Malmö dome with open tools: EDT/TEI 26, Malmö University" \
     --homepage https://dcuartielles.github.io/wisdome-360/ \
     --source . --remote origin --push
   ```
7. **Turn on Pages, built by Actions:**
   ```bash
   gh api -X POST repos/dcuartielles/wisdome-360/pages -f build_type=workflow
   ```
   If it says Pages already exists, run the same call with `-X PUT`.
8. **Watch the deploy.** `gh run list --limit 1`, then `gh run watch <id> --exit-status`. If the build fails, show the failing step's log (`gh run view <id> --log-failed`) and fix it only if the fix is obvious; otherwise report.
9. **Check it's live.** Fetch https://dcuartielles.github.io/wisdome-360/ and https://dcuartielles.github.io/wisdome-360/setup/wizard.html and confirm both return 200. The first deploy can take a minute or two to appear.
10. **Report** in three lines: repository URL, site URL, and anything left to do (e.g. the Releases page is still empty).

## Manual route (no gh)

1. On github.com create an **empty** public repository `wisdome-360` (no README, no licence, no .gitignore).
2. `git remote add origin https://github.com/dcuartielles/wisdome-360.git`
3. `git push -u origin main`
4. Repository → Settings → Pages → Source: **GitHub Actions**.
5. Repository → Actions: watch "Publish site" finish, then open the site URL.
