# Research: Security Hardening

**Branch**: `chore/security-audit` | **Date**: 2026-06-26

## Decision 1 — FR-011: Startup validation of `FRONTEND_ORIGIN`

**Decision**: Use pydantic v2 `@field_validator('frontend_origin', mode='before')` in `Settings`.

**Rationale**: `Settings` is a `pydantic_settings.BaseSettings` subclass. Pydantic validators run at instantiation time. `get_settings()` is called at module-level in `main.py` (inside `app.add_middleware(...)`), so a validation error raised there becomes a startup crash with a clear `ValidationError` message — exactly what FR-011 requires. No additional framework mechanism needed.

**Validator logic**:
```python
from pydantic import field_validator

@field_validator('frontend_origin', mode='before')
@classmethod
def validate_frontend_origin(cls, v: str) -> str:
    v = v.strip()
    if not v:
        raise ValueError('FRONTEND_ORIGIN must not be empty')
    if not (v.startswith('http://') or v.startswith('https://')):
        raise ValueError('FRONTEND_ORIGIN must include a scheme (http:// or https://)')
    if v.endswith('/'):
        raise ValueError('FRONTEND_ORIGIN must not have a trailing slash')
    return v
```

**Alternatives considered**:
- `pydantic.AnyUrl` / `pydantic.HttpUrl`: rejected because Pydantic v2 `HttpUrl` normalises the value and may strip ports or alter the string, breaking the exact-match CORS comparison.
- Custom startup event handler (`@app.on_event('startup')`): rejected — `app.on_event` is deprecated in FastAPI; validator achieves the same with less code.
- No validation (FR-003 default covers local dev): rejected — FR-011 explicitly requires fail-fast behaviour in deployed environments.

**Test cases required** (pytest):
- Valid: `http://localhost:5173` → passes
- Valid: `https://example.cloudfront.net` → passes
- Invalid: `""` → `ValueError`
- Invalid: `"example.com"` (no scheme) → `ValueError`
- Invalid: `"https://example.com/"` (trailing slash) → `ValueError`
- Invalid: `"  https://example.com  "` (whitespace) → stripped → passes

---

## Decision 2 — Bandit B608 nosec placement for multi-line f-strings

**Decision**: Add `# nosec B608` to every f-string line in a multi-line SQL expression that contains a Python expression (`{...}` substitution) OR starts with a SQL keyword.

**Rationale**: Bandit's B608 plugin visits AST `JoinedStr` nodes (f-strings). For adjacent-string-literal concatenation, Python's parser creates one `JoinedStr` node per f-string literal — not one combined node. Bandit therefore evaluates each f-string independently. A nosec comment on line 49 (`f" RETURNING {_SELECT}"`) does NOT suppress a finding on line 47 (`f"INSERT INTO ops ..."`). The safest approach is to annotate every relevant line.

**Lines requiring annotation** (in addition to what is already nosec'd):
- `ops.py:47` — `f"INSERT INTO ops ..."` (SQL keyword, no substitution; flagged because bandit checks all f-strings beginning with SQL verbs)
- `ops.py:67` — `f"UPDATE ops SET ..."` (SQL keyword, no substitution)

**Why these are safe**: `_SELECT` is a module-level constant defined as a plain column list. No user input reaches these queries; all variable data is passed as `%s` bind parameters to psycopg v3, which parameterises them at the driver level.

---

## Decision 3 — ESLint `.next/**` ignore

**Decision**: Add `.next/**` to the `ignores` array in `web/eslint.config.mjs`.

**Rationale**: A stale `.next/` directory from the previous Next.js setup exists in `web/`. Since the project migrated to Vite, `.next/` is inert build output that should be cleaned up, but removing it is out of scope for this security item. Adding it to ignores is the minimal correct fix: it prevents hundreds of false-positive findings in compiled Next.js bundles from blocking the lint step. The ignores list already has `dist/**`; `.next/**` is an identical pattern.

**Alternatives considered**:
- Delete the `.next/` directory: correct long-term, but touching unrelated artefacts in this PR adds noise and risks breaking something if `.next/` is referenced anywhere. Deferred.
- Run `eslint src/` instead of bare `eslint` in the lint script: also valid, but ESLint flat config conventionally runs from the project root; scoping to `src/` would miss future files added outside `src/`.

---

## Decision 4 — pip-audit and npm audit: expected baseline

**Decision**: Run `pip-audit` and `npm audit --audit-level=high` in CI. Any high-severity CVE with no available fix must be listed in the PR description per FR-010.

**Rationale**: Both tools query public vulnerability databases (pip-audit uses OSV.dev; npm audit uses the npm advisory registry). Neither requires authentication or special network configuration beyond standard CI internet access.

**Known state at branch creation** (2026-06-26): No high-severity CVEs known in current `requirements.txt` or `package-lock.json`. This must be re-verified by running both tools locally before opening the PR (see quickstart.md). If any unfixable CVEs are found, they must be listed in the PR description with the CVE ID and a justification for accepting the risk.
