# Feature Specification: Fix Missing Icons in Deployed Environment

**Feature Branch**: `006-fix-csp-icons`

**Created**: 2026-07-01

**Status**: Draft

**Input**: User description: "Fix missing icons in deployed CloudFront environment caused by CSP blocking external font/style CDNs."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Icons and fonts visible in production (Priority: P1)

A user visiting the deployed app (auth page, dashboard, settings) sees all icons and custom fonts rendered correctly — the same experience they get when running the app locally.

**Why this priority**: Icons are non-functional in the deployed environment right now. The auth page buttons have no icons, the settings cards have no section icons, and the Inter font may also be absent. This is a P1 regression visible to all users.

**Independent Test**: Open the deployed dev URL and verify the auth page shows the Bitcoin icon in the title, the Google and email icons inside the login buttons, and Tabler icons on the settings page. Fonts should render in Inter, not the system fallback.

**Acceptance Scenarios**:

1. **Given** a user loads the deployed auth page, **When** the page finishes loading, **Then** the Tabler Icons webfont glyphs (Bitcoin icon, envelope icon, Google icon) are visible and not shown as empty boxes or missing characters.
2. **Given** a user loads the deployed settings page, **When** the page finishes loading, **Then** section header icons (sun, currency, message, alert-triangle) are rendered correctly.
3. **Given** the browser dev tools Network tab is open, **When** the auth page loads, **Then** the Tabler Icons CSS and woff2 font file requests return 200 (not blocked).
4. **Given** a user loads the deployed app, **When** the page renders, **Then** body text uses the Inter typeface, not the system fallback sans-serif.

---

### Edge Cases

- What happens if `cdn.jsdelivr.net` is unreachable? Icons fall back to missing glyphs (acceptable — this is an external CDN; no code change required for this case).
- What if a future icon CDN or font CDN is added? The CSP must be updated in the same PR as the new CDN reference.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The deployed CloudFront distribution MUST serve a `Content-Security-Policy` response header that permits stylesheets from `cdn.jsdelivr.net` and `fonts.googleapis.com`.
- **FR-002**: The CSP MUST permit web fonts from `cdn.jsdelivr.net` and `fonts.gstatic.com`.
- **FR-003**: The CSP MUST NOT weaken any existing directive beyond what is required to allow the listed CDN origins (no new `'unsafe-eval'`, no wildcard origins).
- **FR-004**: All other existing CSP directives (`default-src`, `script-src`, `connect-src`) MUST remain unchanged.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Every Tabler Icons glyph visible locally is also visible on the deployed dev environment — zero missing-glyph placeholders on the auth and settings pages.
- **SC-002**: The Inter font renders on the deployed environment, matching the local appearance.
- **SC-003**: No new CSP violations appear in the browser console after the fix is deployed.
- **SC-004**: `curl -I <deployed-url>` shows a `Content-Security-Policy` header that includes both `font-src` and the updated `style-src` with the CDN origins.

## Assumptions

- The only file requiring change is `aws-infra/stacks/app-stack.ts` — no web source files need modification.
- The Tabler Icons webfont is loaded from `cdn.jsdelivr.net` and the Inter font from `fonts.googleapis.com` / `fonts.gstatic.com`, as declared in `web/index.html`.
- The fix applies to all environments (dev, staging, prod) since they share the same `cspPolicy` construct in the stack.
- No new npm or pip packages are required.
