# Tasks: Fix Missing Icons in Deployed Environment

**Input**: Design documents from `specs/006-fix-csp-icons/`

**Prerequisites**: plan.md ✅, spec.md ✅

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: No setup required — infrastructure-only single-line edit.

*(No tasks — skip to Phase 3)*

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: No foundational work required — the change is isolated to one line in one file.

*(No tasks — skip to Phase 3)*

---

## Phase 3: User Story 1 — Icons and fonts visible in production (Priority: P1) 🎯 MVP

**Goal**: Update the CloudFront CSP response headers policy to allow Tabler Icons and Inter font CDN origins, so icons and custom fonts render in the deployed environment.

**Independent Test**: Load the deployed dev URL in a browser — all Tabler Icons glyphs visible on auth and settings pages; body text uses Inter font; browser DevTools Network shows CDN font/CSS requests returning 200; `curl -I <url>` shows updated `Content-Security-Policy` header.

### Implementation for User Story 1

- [x] T001 [US1] Update the CSP string in aws-infra/stacks/app-stack.ts to add `font-src 'self' https://cdn.jsdelivr.net https://fonts.gstatic.com` and append `https://cdn.jsdelivr.net https://fonts.googleapis.com` to `style-src`
- [x] T002 [US2] Update the CSP string in aws-infra/stacks/app-stack.ts to add `img-src 'self' https://coin-images.coingecko.com`

**Checkpoint**: After this change is deployed, all icons and fonts should be visible in the deployed environment.

---

## Phase 4: Polish & Cross-Cutting Concerns

*(No additional polish tasks — single-line fix with no cross-cutting impact)*

---

## Dependencies & Execution Order

- **T001**: No dependencies — can start immediately.

### Parallel Opportunities

None — single task.

---

## Implementation Strategy

### MVP (User Story 1 Only)

1. Edit `aws-infra/stacks/app-stack.ts` line 166 — add `font-src` directive and extend `style-src`
2. Commit and push to branch `006-fix-csp-icons`
3. Open PR to `develop`; pipeline deploys to dev
4. Verify icons visible on deployed dev URL

---

## Notes

- No backend or frontend code changes required
- Fix applies to all CloudFront stages (dev, staging, prod) since they share the same `cspPolicy` construct
- Visual verification is the acceptance test; no automated test possible for CDN header policy
