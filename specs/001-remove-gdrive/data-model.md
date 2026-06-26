# Data Model: Remove Google Drive Integration

## Entities Changed

### Removed: Drive configuration (localStorage)

| Key | Type | Description |
|-----|------|-------------|
| `cp_gdrive_client_id` | `string` | User-provided Google OAuth Client ID |
| `cp_gdrive_used` | `"1" \| absent` | Flag indicating Drive was previously connected |

Both keys will stop being written. Pre-existing values are left in browser storage
and ignored (passive removal per spec clarification Q1).

## Entities Preserved

### BackupPayload (unchanged)

Defined in `shared/src/types.ts`. This is the contract for both the JSON file
export and the `/api/import` backend endpoint.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `version` | `number` | Yes | Schema version, always `1` |
| `exportedAt` | `string` | Yes | ISO 8601 export timestamp |
| `ops` | `NewOp[]` | Yes | Array of portfolio operations |
| `exitPrices` | `Record<string, number>` | No | Target exit prices per coin |
| `prices` | `Record<string, number>` | No | Legacy field, ignored on import |
| `pricesTime` | `string \| null` | No | Legacy field, ignored on import |

### NewOp (unchanged)

Each entry in `BackupPayload.ops` must satisfy:

| Field | Type | Required |
|-------|------|----------|
| `date` | `string` (YYYY-MM-DD) | Yes |
| `coinId` | `string` | Yes |
| `symbol` | `string` | Yes |
| `name` | `string` | Yes |
| `type` | `"Compra" \| "Venda"` | Yes |
| `qty` | `number` | Yes |
| `price` | `number` | Yes |
| `fee` | `number` | Yes |
| `total` | `number` | Yes |
| `platform` | `string` | Yes |

## Import Validation Rules

A file is accepted if and only if:
1. It parses as valid JSON.
2. The parsed value has an `ops` property that is an array (`Array.isArray(backup.ops)`).

Any other structural issues are tolerated for backwards compatibility — the backend
validates individual op fields independently. Files failing rule 1 or 2 are
rejected with a visible error message; no data is altered.
