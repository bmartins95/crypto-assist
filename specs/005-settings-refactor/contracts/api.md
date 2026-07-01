# API Contracts: Settings Page Refactor

## DELETE /api/ops — Clear all operations

**Route**: `DELETE /api/ops`
**Auth**: Required — `Authorization: Bearer <access_token>`. Returns 401 if missing or invalid.

### Request
No request body.

### Response (200 OK)
```json
{
  "deleted": 12
}
```
- `deleted` (integer): count of records removed. Zero if the user had no operations.

### Error Responses

| Status | Condition |
|--------|-----------|
| 401 | Missing or invalid Authorization header |
| 500 | Database error |

### Behaviour
- Deletes ALL operations where `user_id` matches the authenticated user's Cognito sub.
- Atomic: all rows deleted in a single statement; `conn.commit()` called after.
- Idempotent: calling again after the wallet is empty returns `{"deleted": 0}`.
- Does not affect other users' data.

### Client call (web)
```ts
api.clearOps() // → Promise<{ deleted: number }>
```
`web/src/lib/api/client.ts`:
```ts
clearOps: () => request<{ deleted: number }>('/api/ops', { method: 'DELETE' }),
```

### Client call (mobile)
`mobile/src/lib/api/client.ts` — identical signature.
