# Feature Specification: Security Hardening

**Feature Branch**: `chore/security-audit`

**Created**: 2026-06-26

**Status**: Draft

**Input**: User description: "Security audit — restrict CORS origins from wildcard to the frontend URL env var, add bandit and pip-audit to backend CI, add eslint-plugin-security to web with a working ESLint flat config, add npm audit to web CI, document accepted Amplify localStorage token storage risk in backend/AGENTS.md, suppress confirmed-false-positive bandit B608 findings with nosec comments"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - CORS Restricted to Known Origin (Priority: P1)

The API currently accepts cross-origin requests from any website (`*`). After this change, only
the configured frontend URL is allowed to make requests. Any other origin receives a CORS
rejection without reaching the application logic.

**Why this priority**: An open CORS policy allows any malicious website to make authenticated
requests on behalf of a logged-in user (CSRF-style attacks). This is the highest-risk item
and must be fixed before any new feature work is deployed.

**Independent Test**: Open a browser DevTools console on a non-frontend origin, send a
cross-origin request to the API, and confirm the preflight returns a 403 or the
`Access-Control-Allow-Origin` header is absent/mismatched.

**Acceptance Scenarios**:

1. **Given** a request from the configured frontend origin, **When** a CORS preflight is sent,
   **Then** the response includes the correct `Access-Control-Allow-Origin` header and the
   request proceeds.
2. **Given** a request from an unknown origin (e.g. `http://evil.com`), **When** a CORS
   preflight is sent, **Then** the response does not include a permissive
   `Access-Control-Allow-Origin` header and the request is blocked by the browser.
3. **Given** no `FRONTEND_ORIGIN` environment variable is set (local dev), **When** the API
   starts, **Then** it defaults to `http://localhost:5173` so local development still works.

---

### User Story 2 - Backend Code Scanned for Vulnerabilities in CI (Priority: P1)

Every CI run automatically scans the backend Python source code for known vulnerability
patterns and checks all Python dependencies for published CVEs. If a high or medium severity
issue is found, the pipeline fails before any deployment proceeds.

**Why this priority**: No security scanning currently exists. A vulnerability in deployed code
or a dependency could expose user data. Catching issues in CI is far cheaper than post-deploy.

**Independent Test**: Introduce a deliberate high-severity pattern into a test file, push the
branch, and confirm the CI pipeline fails at the security scan step before reaching deployment.

**Acceptance Scenarios**:

1. **Given** the CI pipeline runs, **When** the backend source contains no HIGH or MEDIUM
   security issues, **Then** the scan step passes and deployment continues.
2. **Given** the CI pipeline runs, **When** the backend source contains a confirmed HIGH
   vulnerability pattern, **Then** the scan step fails and deployment is blocked.
3. **Given** the CI pipeline runs, **When** all backend dependencies are free of known HIGH/MEDIUM
   CVEs, **Then** the dependency check step passes.
4. **Given** source lines that trigger false-positive scan warnings due to a verified-safe coding
   pattern, **When** those lines are annotated as accepted false positives, **Then** the scan
   still exits 0 and the annotation is visible for future reviewer audit.

---

### User Story 3 - Frontend Code and Dependencies Scanned in CI (Priority: P1)

Every CI run automatically checks the frontend JavaScript/TypeScript source for security
anti-patterns and checks all frontend npm dependencies for published high-severity CVEs.
Findings block deployment the same way backend scans do.

**Why this priority**: Frontend code runs in the user's browser. Security anti-patterns
(e.g. `eval`, unsafe HTML injection) and vulnerable dependencies represent direct user risk.

**Independent Test**: Add a rule violation to a source file, push, and confirm CI fails at the
linting step. Also run `npm audit` against the lockfile and confirm high-severity findings
block the run.

**Acceptance Scenarios**:

1. **Given** the CI pipeline runs, **When** frontend source contains no security anti-patterns,
   **Then** the security lint step passes.
2. **Given** the CI pipeline runs, **When** a security anti-pattern is introduced into source,
   **Then** the security lint step fails and deployment is blocked.
3. **Given** the CI pipeline runs, **When** all frontend dependencies have no high-severity CVEs,
   **Then** the dependency audit step passes.
4. **Given** a rule that generates only false positives for all legitimate usages in the
   codebase, **When** that rule is disabled with a documented rationale, **Then** remaining
   rules still run and the scan exits 0.

---

### User Story 4 - Token Storage Risk Documented (Priority: P2)

The chosen authentication library stores session tokens in browser localStorage by default.
This is a known, accepted risk. After this change, the decision is documented in the
developer reference so future contributors understand the threat, the mitigations in place,
and what to watch for when making frontend changes.

**Why this priority**: Without documentation, future developers may unknowingly introduce
code that increases the risk (e.g. `eval`, unsafe HTML) without realising it removes the
existing mitigations. Documentation is a low-effort, permanent guard.

**Independent Test**: Read `backend/AGENTS.md` and confirm it contains a section explaining the
localStorage risk, the XSS threat model, current mitigations, and guidance for future changes.

**Acceptance Scenarios**:

1. **Given** a developer reads the backend developer guide, **When** they look for token
   storage guidance, **Then** they find a clear explanation of the risk, the accepted
   mitigations, and what constraints must be maintained.
2. **Given** a developer is about to add `eval()` or unsafe HTML rendering, **When** they
   consult the guide, **Then** the documentation warns them that this would remove a key
   mitigation.

---

### Edge Cases

- What happens when `FRONTEND_ORIGIN` contains a trailing slash or extra whitespace?
  The API fails at startup with a descriptive error (see FR-011); it never reaches request
  handling in a misconfigured state.
- What if a dependency audit finds a CVE in a transitive (indirect) dependency that has no
  fix available? The audit step should document accepted CVEs rather than silently suppressing
  the entire check.
- What if a new bandit rule flags code added after this PR? The CI will catch it on that
  future PR, not retroactively here.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The API MUST reject cross-origin requests from origins not matching the
  configured frontend URL.
- **FR-002**: The allowed origin MUST be read from an environment variable so it can differ
  between local development, staging, and production without code changes.
- **FR-003**: The local development default for the allowed origin MUST be
  `http://localhost:5173` when no environment variable is set.
- **FR-004**: The CI pipeline MUST run a static security scan on the backend Python source on
  every push to `develop`.
- **FR-005**: The CI pipeline MUST check backend Python dependencies for known CVEs on every
  push to `develop`.
- **FR-006**: The CI pipeline MUST run a security-focused linter on frontend source code on
  every push to `develop`.
- **FR-007**: The CI pipeline MUST check frontend npm dependencies for high-severity CVEs on
  every push to `develop`.
- **FR-008**: Source lines confirmed as false positives MUST be individually annotated, with
  the suppression visible to code reviewers in the diff.
- **FR-009**: The developer guide MUST document the accepted localStorage token storage risk,
  the XSS threat model, existing mitigations, and guidance for future contributors.
- **FR-010**: Accepted CVEs (dependencies with no available fix) MUST be listed in the PR
  description with the CVE identifier and justification. No code-level suppression file is
  required.
- **FR-011**: The API MUST refuse to start if `FRONTEND_ORIGIN` is missing, empty, or
  obviously malformed (lacks a URL scheme, contains trailing whitespace, or is not a valid
  origin). The startup error MUST name the offending value and the expected format.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Zero CI pipelines pass that include a confirmed HIGH- or MEDIUM-severity
  security finding in either backend source or frontend source.
- **SC-002**: Zero CI pipelines pass that include a high-severity CVE in backend or frontend
  dependencies (unless the CVE is explicitly documented as accepted with a justification).
- **SC-003**: The API returns no permissive `Access-Control-Allow-Origin: *` header in any
  environment (verifiable by inspecting response headers in dev, staging, and prod).
- **SC-004**: All false-positive suppressions are individually annotated and listed in the
  PR description so reviewers can audit them.
- **SC-005**: The token storage risk section exists in the developer guide and is findable
  within 30 seconds by a developer unfamiliar with the codebase.

## Clarifications

### Session 2026-06-26

- Q: Should MEDIUM-severity static analysis findings also block CI, or only HIGH? → A: MEDIUM and HIGH both block CI — SC-001 updated to match US2.
- Q: Where must an accepted CVE be documented for it to be auditable by a reviewer? → A: PR description only — no code-level suppression file or dedicated doc needed.
- Q: Should the app validate FRONTEND_ORIGIN at startup or use it as-is? → A: Fail fast at startup — raise a clear error if value is missing or obviously malformed (no scheme, trailing slash, whitespace).

## Assumptions

- The `FRONTEND_ORIGIN` environment variable already exists in AWS SSM for dev and prod
  stages; no new SSM parameters need to be created.
- Local development uses the Vite dev server at `http://localhost:5173` by default.
- The false-positive bandit B608 findings are all instances of a hardcoded constant
  (not user input) interpolated into SQL — verified before this spec was written.
- Dependency audits may surface issues in transitive dependencies with no available fix;
  those are out of scope for this item and will be tracked separately.
- Mobile (`mobile/`) has no backend or ESLint configuration and is unaffected by this item.
