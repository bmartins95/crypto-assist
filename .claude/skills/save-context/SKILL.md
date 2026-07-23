---
name: save-context
description: Generate a dense context-handoff document that captures the current state of the project (not the conversation), so work can resume in a brand-new Claude Code chat with minimal token spend.
argument-hint: "Optional focus note, e.g. 'focus on backend only' or a custom output path"
compatibility: Works in any git repository; produces richer output when a spec-kit specs/<feature>/ directory exists for the current branch
metadata:
  author: bruno
---

## User Input

```text
$ARGUMENTS
```

If non-empty, treat it as a steer: either a specific focus area to emphasize (e.g. "focus on the backend migration"), or an explicit output path/filename to use instead of the default location computed below.

## Goal

Produce a **project state snapshot**, not a conversation recap. A cold Claude instance reading only this document — plus the repo itself — must be able to continue the work immediately: what's done, what's in progress, what decisions were locked in and why, and exactly what to do next.

Do NOT:
- Narrate the back-and-forth of this session ("first I tried X, then the user said Y").
- Include reasoning that led nowhere, abandoned approaches, or resolved confusions.
- Re-derive or restate anything a fresh read of the code/docs would immediately reveal — link to it instead (`file:line`).
- Duplicate content already sitting in `CLAUDE.md`, `AGENTS.md`, or `docs/PLAN.md` — reference it by name instead of copying it in.

## Execution Steps

### 1. Establish position in the repo

Run these to ground the snapshot in fact, not memory:
- `git branch --show-current`
- `git status` (uncommitted work matters — a handoff that omits it strands the next session)
- `git diff` and `git diff --staged` (only summarize meaningfully-sized diffs; for large diffs, list changed files with a one-line description each rather than pasting the diff)
- `git log --oneline -15` (what actually landed recently, in this branch's own words — not your recollection of it)
- If available, run `.specify/scripts/bash/check-prerequisites.sh --paths-only --json` (bash) to resolve `FEATURE_DIR` for the current branch. If the script or `.specify/` directory doesn't exist, this is not a spec-kit-tracked feature — skip straight to step 3 using only git/plan/memory context.

### 2. Load feature artifacts (if `FEATURE_DIR` resolved)

Read what exists, skip what doesn't — do not fabricate missing sections:
- `spec.md` — user stories, functional requirements, edge cases
- `plan.md` — architecture/stack decisions, phases
- `tasks.md` — task list with completion markers
- `data-model.md`, `research.md`, `contracts/`, `quickstart.md` — if present
- `checklists/*.md` — note open items only, not the full checklist

Cross-reference the matching item in `docs/PLAN.md` (match by branch name) for the plan item's "Current state" / "Done when" criteria and any "Corrections learned during implementation" — these are exactly the kind of hard-won, non-obvious facts this handoff must preserve.

### 3. Reconstruct state from the conversation

From this session's actual history (not the repo), extract only what changes future action:
- Concrete decisions made and their stated rationale (architectural choices, scope cuts, naming, approach picked over alternatives)
- Corrections the user gave ("no, do it this way because...") — these are load-bearing constraints, not preferences to soften
- Facts discovered that weren't obvious from reading the code cold (a hidden constraint, a footgun, an API quirk, something that took real investigation to learn)
- Open questions the user hasn't answered yet
- Anything explicitly deferred or ruled out, and why (so it isn't re-proposed)

Discard: exploratory dead ends, restated requirements, pleasantries, anything superseded by a later decision in the same session.

### 4. Write the document

Default output path:
- If `FEATURE_DIR` resolved: `<FEATURE_DIR>/context-handoff.md` (overwrite on every run — this is a living snapshot, not a log; do not accumulate timestamped copies)
- Otherwise: `.specify/context-handoffs/<branch-slug>.md` at repo root (create the directory if needed)
- If `$ARGUMENTS` names an explicit path, use that instead of either default.

Use exactly this structure:

```markdown
# Context Handoff — <project/feature name>

_Generated <date> from branch `<branch>`_

## Project Overview
<2-4 sentences: what this project/feature is and why it exists>

## Current Objective
<Exactly what is being worked on right now — one paragraph, no ambiguity>

## Current State
**Implemented:**
- <bullet per completed piece, with file refs>

**Partially implemented:**
- <bullet per in-progress piece — state exactly what's missing to call it done>

**Not started:**
- <bullet per planned-but-untouched piece>

## Architecture
<Only components/files touched by or relevant to the current objective — not a full repo tour>
- Key files: `path:line` — one-line role
- Key modules/functions/classes and how they relate
- Folder structure only if it's non-obvious or newly introduced

## Important Decisions
- <Decision> — **Why:** <rationale>. <(link related decisions if relevant)>

## Important Context
- APIs/libraries in play and any non-default config
- Conventions/coding standards specific to this work (cite CLAUDE.md/AGENTS.md by section rather than quoting them)
- Assumptions being relied on
- Environment/deployment specifics needed to run or test this
- Useful commands (exact, copy-pasteable)
- Known constraints/gotchas discovered the hard way

## Files Modified
- `path` — why it changed (one line each; group by directory if long)

## Known Problems
- Bugs, tech debt, open questions, blockers — flag anything that blocks the next step explicitly

## TODO
1. <ordered, actionable, resumable-from-cold checklist>

## Next Prompt
<A single ready-to-paste prompt for a brand-new chat. It must:
- assume zero prior context beyond this document and the repo
- tell the new Claude to read this file first
- state the concrete next action to take>

---

## Handoff Quality
- **Context completeness:** <0-100%> — <what's missing, if anything>
- **Estimated size:** ~<N> tokens
- **Manually verify/add before starting the new chat:** <anything you couldn't confirm from tools alone — e.g. credentials, a decision still pending user input, external system state>
```

### 5. Compression pass

Before writing, apply these rules:
- Merge anything said twice into one bullet.
- Prefer bullets over prose everywhere except "Project Overview," "Current Objective," and "Next Prompt."
- Cut any sentence that would be true of any project in this stack (i.e. genuinely non-obvious content only).
- If a section would be empty, omit it entirely rather than writing "N/A".

### 6. Report

After writing the file, tell the user:
- The output path
- The completeness %, token estimate, and anything flagged for manual addition (pulled straight from the document's own "Handoff Quality" section — do not make the user open the file to find this)
