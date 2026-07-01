# Implementation Plan: Fix Missing Icons in Deployed Environment

**Branch**: `006-fix-csp-icons` | **Date**: 2026-07-01 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/006-fix-csp-icons/spec.md`

## Summary

The CloudFront `ResponseHeadersPolicy` CSP string in `aws-infra/stacks/app-stack.ts` (line 166) is missing a `font-src` directive and the `style-src` directive does not include external CDN origins. This blocks the Tabler Icons webfont (`cdn.jsdelivr.net`) and Inter font (`fonts.googleapis.com` / `fonts.gstatic.com`) from loading in the deployed environment while they work fine locally (no CSP on localhost). The fix is a single-line edit to the CSP string: add `font-src 'self' https://cdn.jsdelivr.net https://fonts.gstatic.com` and extend `style-src` with `https://cdn.jsdelivr.net https://fonts.googleapis.com`.

## Technical Context

**Language/Version**: TypeScript (SST / Pulumi infra stack)

**Primary Dependencies**: `@pulumi/aws` CloudFront `ResponseHeadersPolicy`

**Storage**: N/A

**Testing**: Visual verification via browser DevTools Network tab on the deployed dev URL; `curl -I` to confirm CSP header value

**Target Platform**: AWS CloudFront (all stages: dev, staging, prod)

**Project Type**: Infrastructure configuration

**Performance Goals**: No change to response times

**Constraints**: Must not weaken any existing CSP directive (no new wildcard origins, no `'unsafe-eval'`)

**Scale/Scope**: Single line change in one file

## Constitution Check

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Shared-First Architecture | ✅ Pass | Infra-only; no shared/ changes |
| II. Security at the Boundary | ✅ Pass | CSP is being tightened relative to the current broken state; no wildcard origins added; no existing directive removed or weakened |
| III. Behavior Coverage Over Line Coverage | ✅ Pass | Infrastructure change with no testable code path; verified by visual inspection and curl |
| IV. No Speculative Code | ✅ Pass | Exactly one line changes; no abstractions |
| V. Accessibility and Internationalisation | ✅ Pass | N/A |

**Gate result**: All principles pass. No violations to justify.

## Project Structure

### Documentation (this feature)

```text
specs/006-fix-csp-icons/
├── plan.md       ← this file
├── research.md   ← Phase 0 (no unknowns; inlined below)
└── tasks.md      ← Phase 2 output (/speckit-tasks)
```

### Source Code

```text
aws-infra/stacks/app-stack.ts   ← single line edit (line 166)
```

No `data-model.md`, `contracts/`, or `quickstart.md` — this feature has no data model, no API contracts, and no integration scenarios beyond a browser load test.

## Phase 0: Research (inlined — no unknowns)

All CDN origins are known from `web/index.html`:

| Resource | CDN Origin | Directive needed |
|---|---|---|
| Tabler Icons CSS | `https://cdn.jsdelivr.net` | `style-src` |
| Tabler Icons woff2 | `https://cdn.jsdelivr.net` | `font-src` |
| Inter CSS | `https://fonts.googleapis.com` | `style-src` |
| Inter woff2 | `https://fonts.gstatic.com` | `font-src` |
| CoinGecko coin images | `https://coin-images.coingecko.com` | `img-src` |

**Decision**: Add `font-src 'self' https://cdn.jsdelivr.net https://fonts.gstatic.com` as a new directive, append `https://cdn.jsdelivr.net https://fonts.googleapis.com` to the existing `style-src` value, and add `img-src 'self' https://coin-images.coingecko.com` as a new directive.

**Alternatives considered**:
- Bundling Tabler Icons and Inter locally (avoids CDN dependency entirely) — deferred; scope of this fix is minimal; bundling is a separate improvement.
- Using `font-src *` — rejected; would weaken the CSP. Named origins only.

## Implementation

**File**: `aws-infra/stacks/app-stack.ts`, line 166

**Before**:
```
default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self' https://cognito-idp.us-east-1.amazonaws.com https://*.amazoncognito.com ${backendApiUrl.value}
```

**After**:
```
default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://fonts.googleapis.com; font-src 'self' https://cdn.jsdelivr.net https://fonts.gstatic.com; img-src 'self' https://coin-images.coingecko.com; connect-src 'self' https://cognito-idp.us-east-1.amazonaws.com https://*.amazoncognito.com ${backendApiUrl.value}
```

## Complexity Tracking

No constitution violations — no complexity justification needed.
