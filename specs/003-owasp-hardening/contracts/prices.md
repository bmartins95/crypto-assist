# Contract: GET /api/prices

**Route**: `GET /api/prices?ids=<coin-ids>`

**Auth**: Required — `Authorization: Bearer <token>`

## Request Parameters

| Parameter | Type   | Required | Constraints |
|-----------|--------|----------|-------------|
| `ids`     | string | Yes      | Comma-separated list of coin identifiers. Each ID must match `^[a-z0-9-]{1,120}$`. At least one ID required. |

## Validation Rules (new in this item)

Each coin ID in the `ids` parameter must:
- Contain only lowercase letters (`a-z`), digits (`0-9`), or hyphens (`-`)
- Be between 1 and 120 characters long
- Not contain path separators (`/`, `\`), protocol schemes (`:`), spaces, or other special characters

If **any** ID in the list is invalid, the entire request is rejected. No partial results are returned.

## Responses

| Status | Condition | Body |
|--------|-----------|------|
| 200 | All IDs valid, prices retrieved | `{ "<coin-id>": { "price": number, "image": string \| null } }` |
| 400 | No IDs provided | `{ "detail": "Query param \"ids\" is required." }` |
| 400 | One or more IDs malformed | `{ "detail": "Invalid coin_id(s): <list>" }` |
| 401 | Missing or invalid token | `{ "detail": "Missing authentication token." }` or `"Invalid or expired token."` |
| 429 | CoinGecko rate limit | `{ "detail": "CoinGecko rate limit exceeded." }` |
| 502 | CoinGecko upstream failure | `{ "detail": "Failed to fetch prices from CoinGecko." }` |

## Examples

**Valid request**:
```
GET /api/prices?ids=bitcoin,ethereum
Authorization: Bearer <token>
```

**Invalid — path traversal**:
```
GET /api/prices?ids=../evil
→ 400 {"detail": "Invalid coin_id(s): ../evil"}
```

**Invalid — mixed**:
```
GET /api/prices?ids=bitcoin,../evil
→ 400 {"detail": "Invalid coin_id(s): ../evil"}
```
