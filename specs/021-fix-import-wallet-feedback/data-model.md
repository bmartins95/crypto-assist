# Phase 1 Data Model: Import Wallet Feedback & Price Freshness

No persisted data entities are added, changed, or removed by this feature — no database migration, no `Op`/backup shape change. The existing `BackupPayload`, `Op`, `Prices`, and `AvatarCache` types (`shared/src/types.ts`) are consumed unmodified.

Two transient, component-local UI state shapes are introduced (in-memory only, not persisted):

## `ToastState` (local to `web/src/pages/settings.tsx`)

| Field | Type | Notes |
|-------|------|-------|
| `kind` | `'success' \| 'error'` | Drives the `Toast` component's color/icon. |
| `message` | `string` | Already-localized message text (`t.*`). |

Held as `useState<ToastState \| null>(null)`; `null` means no toast is currently shown. Only one toast exists at a time — setting a new one replaces whatever was showing (matches Decision in research.md: no queue/manager, Principle IV).

## `ConfirmDialog` props (local to `web/src/components/ConfirmDialog.tsx`)

| Field | Type | Notes |
|-------|------|-------|
| `open` | `boolean` | Controls mount/visibility. |
| `title` | `string` | Localized dialog heading. |
| `message` | `string` | Localized body text. |
| `confirmLabel` | `string` | Localized confirm-button text. |
| `cancelLabel` | `string` | Localized cancel-button text. |
| `onConfirm` | `() => void` | Invoked when the user confirms. |
| `onCancel` | `() => void` | Invoked on Cancel click, Escape, or backdrop click. |

No relationships, lifecycle/state-transition rules, or validation rules beyond standard React prop typing — these are presentational component contracts, not domain entities.
