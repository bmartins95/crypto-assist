# Data Model: Facebook Login

No database entities. This feature adds configuration shape only.

## `AppConfig.cognito` (TypeScript interface, `aws-infra/stacks/app-stack.ts`)

| Field | Type | Notes |
|---|---|---|
| `googleEnabled` | `boolean?` | Existing field, unchanged |
| `facebookEnabled` | `boolean?` | New field, same shape as `googleEnabled`. Absent/`false` = no Facebook IdP attached to the pool. |

## Facebook Identity Provider (Pulumi resource, created only when `facebookEnabled` is true)

| Attribute | Value |
|---|---|
| `providerName` | `"Facebook"` |
| `providerType` | `"Facebook"` |
| `providerDetails.client_id` | from SSM `${paramBase}/FacebookClientId` (SecureString) |
| `providerDetails.client_secret` | from SSM `${paramBase}/FacebookClientSecret` (SecureString) |
| `providerDetails.authorize_scopes` | `"email public_profile"` |
| `attributeMapping.email` | `"email"` |
| `attributeMapping.name` | `"name"` |
| `attributeMapping.username` | `"id"` (Facebook's Graph API user id — the Facebook-specific equivalent of Google's `sub`) |

## SSM parameters (per environment, created manually — not by this feature's code)

| Path | Type | Created by |
|---|---|---|
| `/crypto-assist/{stage}/FacebookClientId` | SecureString | Manual (`aws ssm put-parameter`), per PLAN.md Item 15 prerequisite step |
| `/crypto-assist/{stage}/FacebookClientSecret` | SecureString | Manual (`aws ssm put-parameter`), per PLAN.md Item 15 prerequisite step |

## YAML config (`aws-infra/apps/crypto-assist/{dev,prod}.yaml`)

```yaml
cognito:
  facebookEnabled: false   # new key, added to both files; flip to true only after SSM secrets exist for that stage
```
