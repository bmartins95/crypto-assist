---
name: "speckit-autopilot"
description: "Run the full speckit pipeline with minimal intervention: specify → clarify (interactive) → plan → tasks → analyze → implement → PR. Pauses only for clarification questions, analyze findings, PR merges, DB changes, and server config changes."
argument-hint: "Describe the feature you want to build"
compatibility: "Requires spec-kit project structure with .specify/ directory"
metadata:
  author: "crypto-assist"
  source: "local"
user-invocable: true
disable-model-invocation: false
---

## User Input

```text
$ARGUMENTS
```

If `$ARGUMENTS` is empty, stop immediately and ask the user to describe the feature before proceeding.

## Autonomy Contract

**Proceed without asking** for:
- Writing or modifying any code under `C:\Users\bruno\Dev`
- Pushing commits to the feature branch
- Creating a GitHub PR
- Any technical or architectural decisions within the scope of the current plan
- Auto-answering `[NEEDS CLARIFICATION]` markers in `/speckit-specify` — resolve them using sensible defaults from the codebase, constitution, and AGENTS.md; never surface them to the user
- Auto-answering any prompts raised internally by sub-skills (specify, plan, tasks, implement) that fall outside the explicit pause categories below — resolve autonomously and continue

**Always pause and wait for the user** before:
- Merging any PR
- Modifying database schemas or running migrations in any environment
- Changing server or infrastructure configuration (e.g., SSM parameters, CloudFront, Cognito)
- The structured clarification questions in the Clarify step (Step 2) — these are the user's primary design input point
- Presenting consistency or coverage issues found in the Analyze step (Step 5) when they are CRITICAL or HIGH severity

No other pause points exist. If a sub-skill attempts to prompt for something not in the list above, resolve it autonomously without surfacing it to the user.

## Pipeline

Execute the following steps in order by invoking the corresponding pre-existing skill via the Skill tool. Do not re-implement the logic of any sub-skill — call it and wait for it to complete before moving to the next step.

### Step 0 — Constitution check (one-time setup)

Check whether `.specify/memory/constitution.md` exists.
- If it exists: skip this step and go to Step 1.
- If it does not exist: invoke the **speckit-constitution** skill and wait for it to complete before proceeding.

### Step 1 — Specify

Invoke the **speckit-specify** skill, passing `$ARGUMENTS` verbatim as the feature description.

Auto-resolve all `[NEEDS CLARIFICATION]` markers using context from the codebase, `AGENTS.md`, `PLAN.md`, and the constitution. Do not stop to ask the user. If the sub-skill pauses or surfaces a clarification question, answer it autonomously and continue.

Wait for the skill to complete and confirm the spec file and feature directory are created before proceeding.

### Step 2 — Clarify (interactive — the only interactive step)

Invoke the **speckit-clarify** skill.

**This is the only step that pauses the pipeline.** Present each clarification question to the user one at a time as the skill produces it, and wait for their response before continuing. Do not skip, merge, or auto-answer these questions.

Wait for the skill to complete (all questions answered and spec updated) before proceeding.

### Step 3 — Plan

Invoke the **speckit-plan** skill.

Proceed fully autonomously. The plan skill derives the tech stack from the constitution, the clarified spec, and the existing codebase. Do not stop for any input.

### Step 4 — Tasks

Invoke the **speckit-tasks** skill.

Proceed fully autonomously. The task list is generated with dependency order and `[P]` parallel markers. Do not stop for any input.

### Step 5 — Analyze (conditional pause)

Invoke the **speckit-analyze** skill.

After analysis completes:
- If no CRITICAL or HIGH issues are found: proceed to Step 6 automatically without pausing.
- If CRITICAL or HIGH issues are found: present only those findings to the user and wait for their decision (proceed as-is / fix first). Do not surface LOW or MEDIUM issues — resolve or ignore them autonomously.

### Step 6 — Implement

Invoke the **speckit-implement** skill.

Proceed fully autonomously through all tasks:
- Write code, push commits, and make implementation decisions without asking.
- Mark each task `[X]` in tasks.md as it completes.
- **Exception:** if a task requires a database migration or server configuration change, pause, present the specific change, and wait for approval. This is the only implementation pause point.

### Step 7 — Push and open PR

After implementation completes:

1. Push all commits on the feature branch (created by the `before_specify` git hook in Step 1) using `git push -u origin <branch>`.
2. Create a PR targeting `develop` using `gh pr create --base develop`. Use the feature short name from the spec as the PR title. The PR body must include: a brief feature summary, tech decisions from plan.md, and a test checklist drawn from tasks.md.
3. Do not merge the PR. Stop here.

## Completion Report

Report to the user:
- Feature directory and spec file path
- Branch name and PR URL
- Number of tasks completed
- Steps where the user was asked to intervene and what was decided
- Any items left pending (e.g., DB migrations awaiting approval)

## Done When

- [ ] Feature spec written and clarified (Steps 1–2)
- [ ] Plan and tasks generated (Steps 3–4)
- [ ] All in-scope implementation tasks completed and marked `[X]` (Step 6)
- [ ] Commits pushed to feature branch and PR opened against `develop` (Step 7)
- [ ] Completion reported to the user with PR URL
