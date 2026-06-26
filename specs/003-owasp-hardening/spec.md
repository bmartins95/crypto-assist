# Feature Specification: OWASP Top 10 Hardening

**Feature Branch**: `chore/owasp-hardening`

**Created**: 2026-06-26

**Status**: Draft

**Input**: User description: "OWASP Top 10 hardening — cross-user isolation tests, coin_id input validation to prevent SSRF, Content-Security-Policy header on CloudFront, pin GitHub Actions to commit SHAs, and auth-failure security logging"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Cross-User Data Isolation (Priority: P1)

An authenticated user can only ever see and modify their own portfolio data. No authenticated user, regardless of what identifiers they supply in a request, can read or modify another user's operations, exit prices, or export.

**Why this priority**: This is the most direct user-trust violation possible — a user seeing another user's financial data. It must be verified by tests before any other security work. OWASP A01: Broken Access Control.

**Independent Test**: Populate the system with data owned by User A. Issue identical read requests authenticated as User B. Assert every response is empty. Assert every protected endpoint returns an authentication error when called without credentials.

**Acceptance Scenarios**:

1. **Given** User A has portfolio operations in the system, **When** User B requests the list of operations, **Then** the response is empty — none of User A's records are returned.
2. **Given** User A has exit prices in the system, **When** User B requests exit prices, **Then** the response is empty — no cross-user data leaks.
3. **Given** User A has portfolio data, **When** User B requests the data export, **Then** the response contains only User B's data (empty if User B has none).
4. **Given** any protected endpoint exists, **When** a request arrives with no authentication credentials, **Then** the response is an authentication error (not data, not a server error).

---

### User Story 2 - Safe External Identifier Handling (Priority: P1)

When a user requests price data for assets in their portfolio, the system validates each asset identifier before using it to retrieve external prices. Malformed identifiers are rejected at the API boundary with a clear error; only well-formed identifiers reach external data sources.

**Why this priority**: A crafted identifier could cause the system to make outbound requests to unexpected hosts, leaking credentials or exposing internal infrastructure. OWASP A03: Injection / A10: Server-Side Request Forgery.

**Independent Test**: Send a price request with a malformed identifier (one containing path separators, protocol schemes, or excessive length). Assert the request is rejected with a validation error. Send a well-formed identifier and assert normal price retrieval proceeds.

**Acceptance Scenarios**:

1. **Given** a price request with an identifier containing a path separator (e.g. `../evil`), **When** the system processes the request, **Then** it returns a validation error — no outbound price lookup is made.
2. **Given** a price request with an empty identifier, **When** the system processes the request, **Then** it returns a validation error.
3. **Given** a price request with an identifier exceeding the maximum length, **When** the system processes the request, **Then** it returns a validation error.
4. **Given** a price request with a well-formed identifier (lowercase letters, digits, hyphens, within length limit), **When** the system processes the request, **Then** price data is retrieved normally.

---

### User Story 3 - Authentication Failure Visibility (Priority: P1)

When a request to a protected endpoint fails authentication — whether because credentials are absent or invalid — the event is recorded with enough context to detect patterns of unauthorized access attempts.

**Why this priority**: Without logging, brute-force and credential-stuffing attempts are invisible until after a breach. Logging auth failures enables detection and response. OWASP A09: Security Logging and Monitoring Failures.

**Independent Test**: Send a request to a protected endpoint with no credentials. Send a request with a malformed token. Verify that both events produce log entries containing the request path and user agent, and that no token value appears in any log entry.

**Acceptance Scenarios**:

1. **Given** a request with no Authorization header arrives at a protected endpoint, **When** the system rejects it, **Then** a warning-level log entry is written containing the request path and the requester's user-agent string.
2. **Given** a request with an invalid or expired token arrives at a protected endpoint, **When** the system rejects it, **Then** a warning-level log entry is written — the token value itself is never included in the log.
3. **Given** a successful authenticated request, **When** the request is processed, **Then** no warning is logged for authentication.

---

### User Story 4 - Browser Security Policy (Priority: P2)

The web application instructs browsers to load resources only from approved origins. This prevents injected scripts or styles from loading external content even if an XSS vector were found.

**Why this priority**: Completes the XSS mitigation documented in Item 2 (token storage accepted risk). Without a Content-Security-Policy header, the documented mitigations are incomplete. OWASP A05: Security Misconfiguration.

**Independent Test**: Fetch the root page of the deployed web application. Inspect the response headers. Confirm a Content-Security-Policy header is present and restricts `default-src`, `script-src`, `style-src`, and `connect-src` to approved origins.

**Acceptance Scenarios**:

1. **Given** the web application is deployed, **When** a browser fetches any page, **Then** the response includes a `Content-Security-Policy` header.
2. **Given** the CSP header is present, **When** a page attempts to load a script from an unapproved external origin, **Then** the browser blocks the load.
3. **Given** the CSP header is present, **When** Amplify's authentication flows make requests to the Cognito endpoints, **Then** those requests are permitted (Cognito endpoints are in the approved `connect-src` list).

---

### User Story 5 - CI/CD Supply Chain Integrity (Priority: P2)

The automated deployment pipeline uses verified, pinned versions of third-party build actions. A tag that is later moved or replaced on an external repository cannot silently substitute a different version into the pipeline.

**Why this priority**: Mutable version tags mean a compromised upstream action repository could inject malicious code into every future deploy without any change to this repository. OWASP A08: Software and Data Integrity Failures.

**Independent Test**: Inspect the pipeline configuration. Every third-party action reference must use a full-length commit hash, not a mutable version tag. A human-readable version comment alongside each hash confirms the intended version.

**Acceptance Scenarios**:

1. **Given** the pipeline configuration is inspected, **When** each third-party action step is reviewed, **Then** all action references specify a full 40-character commit SHA — no mutable version tags (e.g. `@v4`, `@main`) are present.
2. **Given** pinned SHAs are in place, **When** a third-party action's mutable tag is moved to a different commit, **Then** the pipeline continues to use the original pinned commit — the change has no effect.
3. **Given** a SHA-pinned action is used, **When** a developer reads the pipeline config, **Then** a comment on each pinned line identifies the human-readable version tag the SHA corresponds to.

---

### Edge Cases

- What happens if a user submits a price request mixing valid and invalid identifiers? The entire request is rejected — no partial lookups.
- What if a coin identifier contains only valid characters but is entirely numeric? Accepted — numeric-only identifiers are valid per the allowed pattern.
- What if an auth failure log entry would expose a user's email or ID from the token payload? The token is never decoded for logging; only the request path and user-agent are recorded.
- What if the CSP `connect-src` blocks a future third-party integration? The CSP must be updated in a separate branch alongside the integration.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Every protected endpoint MUST return an authentication error when called without valid credentials — never data belonging to any user.
- **FR-002**: Every protected endpoint MUST return only data owned by the authenticated user — data belonging to other users MUST NOT appear in any response.
- **FR-003**: Asset identifier inputs at the price endpoint MUST be validated against an allowed character set (lowercase letters, digits, and hyphens only) and a maximum length before any external lookup is performed.
- **FR-004**: Any asset identifier that fails validation MUST result in an HTTP 400 response with a descriptive error message — no partial processing of mixed valid/invalid requests.
- **FR-005**: Every authentication failure — missing credentials or invalid/expired token — MUST produce a warning-level log entry containing the request path and the requester's user-agent.
- **FR-006**: Authentication failure log entries MUST NOT contain the token value, user password, or any credential material.
- **FR-007**: The web application MUST serve a `Content-Security-Policy` response header on every page that restricts `default-src`, `script-src`, `style-src`, and `connect-src` to approved origins including Cognito authentication endpoints.
- **FR-008**: All third-party actions referenced in the CI/CD pipeline configuration MUST be pinned to a specific immutable commit SHA.
- **FR-009**: Each SHA-pinned action reference in the pipeline configuration MUST include an inline comment identifying the corresponding human-readable version tag.

### Key Entities

- **Protected Endpoint**: Any API route that requires a valid authentication token to respond with data. A request without credentials must receive an error response.
- **Asset Identifier**: A string provided by the client that identifies a tradable asset for price lookup. Subject to format validation before use.
- **Authentication Failure Event**: An instance of a request reaching a protected endpoint with absent or invalid credentials. Must be logged at warning level.
- **Content-Security-Policy**: A response header instructing the browser which resource origins are permitted. Scope: all pages of the web application.
- **Pinned Action Reference**: A CI/CD step referencing a third-party action by its full commit SHA rather than a mutable tag.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: For every protected endpoint, a request authenticated as User B that targets User A's data returns an empty result — verified by automated tests covering all three scoped endpoints (`/api/ops`, `/api/exit-prices`, `/api/export`).
- **SC-002**: A request to `/api/prices` with any malformed identifier returns HTTP 400 — verified by automated tests covering path-separator injection, empty string, and oversized value.
- **SC-003**: Every request to a protected endpoint without valid credentials produces a warning log entry — verified by the cross-user isolation tests exercising the 401 path.
- **SC-004**: The deployed web application returns a `Content-Security-Policy` header — verified by a `curl -I` check against the CloudFront distribution.
- **SC-005**: Zero third-party action references in the pipeline configuration use a mutable version tag — verifiable by inspection of the pipeline configuration file.
- **SC-006**: All existing automated tests continue to pass after these changes — `bandit`, `pip-audit`, `npm run lint`, and `npm audit --audit-level=high` all exit 0.
- **SC-007**: Test coverage on changed backend modules (`prices.py`, `dependencies.py`) reaches ≥90%.

## Assumptions

- Item 2 (Security Audit) is merged to `develop` before this branch is opened — the bandit, pip-audit, and ESLint tooling established there is a prerequisite.
- The CloudFront distribution for the dev environment is accessible so CSP header delivery can be verified with `curl -I`.
- GitHub Actions for `actions/checkout`, `actions/setup-python`, and `actions/setup-node` are the only third-party actions in the pipeline — no other external actions require pinning.
- The Cognito authentication domain for the dev environment is under `amazoncognito.com` — this domain must be explicitly allowed in the CSP `connect-src` directive.
- No new npm or pip packages are needed; all hardening work uses existing language features and the infrastructure already in place.
- The `aws-infra` repository is accessible for the CloudFront CSP change; if it is not, that task must be deferred and documented.
