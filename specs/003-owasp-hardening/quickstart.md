# Quickstart: OWASP Top 10 Hardening

End-to-end verification scenarios for each user story.

## US1 — Cross-user isolation tests

**Verify locally (pytest)**:
```bash
cd backend
.venv/Scripts/python.exe -m pytest tests/test_isolation.py -v
```

Expected output: all tests pass. Confirms:
- Every protected endpoint returns 401 when called without credentials
- Authenticated user B receives empty results for all scoped endpoints

---

## US2 — coin_id validation

**Verify locally (curl)**:
```bash
# Start server
cd backend && uvicorn app.main:app --reload --port 3001

# Valid request (returns prices or empty dict)
curl -H "Authorization: Bearer <token>" "http://localhost:3001/api/prices?ids=bitcoin"

# Path traversal → 400
curl -H "Authorization: Bearer <token>" "http://localhost:3001/api/prices?ids=../evil"
# Expected: {"detail":"Invalid coin_id(s): ../evil"}

# Oversized → 400
curl -H "Authorization: Bearer <token>" "http://localhost:3001/api/prices?ids=$(python -c 'print("a"*121)')"
# Expected: {"detail":"Invalid coin_id(s): <121-char string>"}
```

**Verify via pytest**:
```bash
cd backend
.venv/Scripts/python.exe -m pytest tests/test_prices.py -v -k "malformed"
```

---

## US3 — Auth failure logging

**Verify locally**:
```bash
# Start server with INFO logging
cd backend && uvicorn app.main:app --reload --port 3001

# Send request without token
curl http://localhost:3001/api/ops

# Check server logs for: WARNING ... auth_failure path=/api/ops ua=...
# Confirm no token value appears in the log line
```

**Verify via pytest** (indirectly via isolation tests):
```bash
cd backend
.venv/Scripts/python.exe -m pytest tests/test_isolation.py -v -k "401"
```

---

## US4 — CSP header (CloudFront)

**Verify after `aws-infra` deploy**:
```bash
# Replace with actual CloudFront domain
curl -I https://<cloudfront-domain>.cloudfront.net/ | grep -i content-security-policy
```

Expected: a `content-security-policy` header value containing `default-src 'self'`, `connect-src 'self' https://cognito-idp...`.

---

## US5 — GitHub Actions SHA pinning

**Verify by inspection**:
```bash
grep "uses: actions/" .github/workflows/deploy.yml
```

Expected: every `actions/` reference uses a 40-character hex SHA followed by a `# vN` comment. No `@v`, `@main`, or other mutable tag patterns present.
