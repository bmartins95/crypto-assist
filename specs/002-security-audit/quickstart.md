# Quickstart: Running Security Tools Locally

**Branch**: `chore/security-audit`

Run all security checks before opening a PR.

## Backend

```bash
cd backend
pip install -r requirements-dev.txt   # installs bandit and pip-audit

# Static analysis — must exit 0
bandit -r app/ -ll

# Dependency CVE scan — must exit 0 (or document accepted CVEs in PR description)
pip-audit

# Tests — must pass
pytest
```

## Web

```bash
cd web
npm ci

# Security lint — must exit 0
npm run lint

# Dependency CVE scan — must exit 0
npm audit --audit-level=high

# Tests — must pass
npm test
```

## Interpreting Results

**bandit B608**: Flags f-strings used to build SQL. Each occurrence in `ops.py` and `export_data.py` is a confirmed false positive (bind parameters are used; `_SELECT` is a constant). These are suppressed with `# nosec B608`. If bandit reports a finding on a line without `# nosec`, add the comment after verifying no user input reaches the query.

**pip-audit / npm audit CVEs with no fix**: If a CVE has no patched version available, document it in the PR description with the CVE ID, the affected package, and the justification for accepting the risk. Do not suppress the tool globally.

**eslint-plugin-security warnings** (not errors): Rules like `security/detect-non-literal-regexp` may produce warnings on third-party code. Warnings do not block CI. Errors do.
