---
name: load-context
description: Locate and load a context-handoff.md written by the save-context skill, verify it isn't stale against the repo's current state, and orient a brand-new chat so work can resume immediately.
argument-hint: "Optional: a branch name, feature slug, or explicit path to a context-handoff.md — otherwise auto-detected from the current branch"
compatibility: Works in any git repository; pairs with the save-context skill's default output locations
metadata:
  author: bruno
---

## User Input

```text
$ARGUMENTS
```

If non-empty, treat it as either: an explicit path to a handoff file, a branch name, or a feature slug (e.g. `023-position-closing`) to resolve one for. If empty, auto-detect from the current branch (step 1).

## Goal

This is the counterpart to the `save-context` skill. Where `save-context` writes a project-state snapshot before a chat ends, this skill finds that snapshot at the start of a new chat, confirms it's still accurate, and gets to work — without the user needing to remember or paste a file path.

Do NOT treat the handoff file as gospel. It is a snapshot from whenever it was last generated; the repo may have moved since. Verify, don't just recite.

## Execution Steps

### 1. Resolve which handoff file to load

If `$ARGUMENTS` is an explicit path (contains a `/` or ends in `.md`) and it exists, use it directly and skip to step 2.

Otherwise:
- `git branch --show-current` to get the current branch.
- If `.specify/scripts/bash/check-prerequisites.sh` exists, run `check-prerequisites.sh --paths-only --json` (bash) to resolve `FEATURE_DIR` for the current branch. Look for `<FEATURE_DIR>/context-handoff.md`.
- If that doesn't exist, check `.specify/context-handoffs/<branch-slug>.md` (the `save-context` skill's non-spec-kit fallback location; slugify the branch name the same way — replace `/` with `-`).
- If `$ARGUMENTS` gave a feature slug instead of a path, check `specs/<slug>/context-handoff.md` directly.
- If nothing is found at any of these locations, glob for `**/context-handoff.md` and `.specify/context-handoffs/*.md` repo-wide. If exactly one exists, use it. If several exist and none match the current branch, list them with their branch/date (read the `_Generated <date> from branch \`<branch>\`_` line of each) and ask the user which one to load via AskUserQuestion.
- If truly nothing is found anywhere, say so plainly and stop — do not fabricate a handoff or guess at project state from nothing.

### 2. Load and read the handoff

Read the resolved file in full.

### 3. Verify freshness against the live repo

Do not trust the handoff's claims blindly — cheaply re-check the ones most likely to have changed:
- `git log --oneline -10` and `git status` — compare against the handoff's "Current State" / "Files Modified" sections. If there are commits or uncommitted changes the handoff doesn't account for, note this as drift.
- If the handoff references a PR number, run `gh pr view <number> --json state,mergedAt,comments` (if `gh` is available) to check whether it has since merged, closed, or picked up review comments — this changes what "next step" actually means.
- If the handoff references specific files/functions as the basis for next steps, do a quick sanity check (`Glob`/`Grep`, not a full read) that they still exist under the names given — don't assume a memory-style claim is still true.
- If the handoff names other open plan items or dependencies, no need to re-verify those unless the current objective depends on them.

### 4. Orient and proceed

Give the user a short summary (not a re-print of the whole document):
- What the objective is and how far along it is (from the handoff's "Current Objective" / "Current State").
- Any drift found in step 3, stated plainly (e.g. "the PR this handoff refers to has since merged" or "there are 3 commits since this was generated — here's what they touched").
- The next concrete action, pulled from the handoff's "TODO" section (adjusted for any drift found).

Then proceed directly into that next action rather than waiting to be re-prompted — the whole point of this skill is to resume work, not just summarize it. If the drift found in step 3 invalidates the TODO (e.g. the PR already merged, or the described next step no longer applies), say so and ask how to proceed instead of blindly executing a stale instruction.

## Notes

- If both a `save-context` and `load-context` skill exist and the user asks to "pick up where I left off," "resume," or similar without naming a file, this skill is the right one to run — no need to ask which skill they mean.
- This skill never writes or modifies `context-handoff.md` itself — that's `save-context`'s job. If significant new work happens in this session, remind the user (once, near the end, not repeatedly) that running `/save-context` again would keep the handoff current for whatever comes after.
