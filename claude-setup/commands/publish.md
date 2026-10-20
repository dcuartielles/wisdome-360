---
description: Check, commit and push changes to the Wisdome 360 site, then confirm the deploy
---

Publish the waiting changes to the site. Stop at the first failure and say what failed.

1. **See what is waiting.** Run `python scripts/publish_status.py`, `git status` and `git diff --stat`. Read `.publish-queue.md`. If nothing is waiting, say so and stop. If there is no `origin`, stop and suggest `/first-push`.
2. **Sync first.** `git pull --ff-only`. If it can't fast-forward, stop and explain: someone pushed from elsewhere, and David decides how to merge.
3. **Look at the changes.** Briefly list what changed. Flag anything that breaks the rules in CLAUDE.md: imported media without a credit, a video or a large file, a PDF reading, anything naming students.
4. **Preflight.** Run `python scripts/preflight.py` with the venv's Python. If it fails, stop. Show any warnings to David.
5. **What changed page.** If students would notice the change and `docs/changes.md` has no entry for it, add a dated line (newest first, plain language).
6. **Confirm.** Show David the commit message you will use (one summary line plus a bullet per queued entry) and wait for a yes, unless he has already said "publish" for exactly these changes in this session.
7. **Commit and push:** `git add -A`, `git commit`, `git push`. Never force-push.
8. **Watch the deploy.** `gh run list --limit 1`, then `gh run watch <id> --exit-status`. On failure, show `gh run view <id> --log-failed` and report.
9. **Clear the queue.** In `.publish-queue.md`, move the published entries from `## Pending` to the top of `## Published`, prefixed with today's date and the short commit hash. Leave any entry you didn't publish under Pending.
10. **Report** in two lines: what went live, with the site link to the most relevant page.
