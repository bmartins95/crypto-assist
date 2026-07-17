# Component Interfaces: Import Wallet Feedback & Price Freshness

This feature has no backend API surface (no routes added or changed — see `research.md` Decision 1 area and `plan.md` Technical Context: `Storage: N/A`). The only new "interfaces" are two internal React component prop contracts, documented here since they are the seam other code (and their tests) programs against.

## `Toast`

```ts
export type ToastKind = 'success' | 'error';

interface ToastProps {
  kind: ToastKind;
  message: string;
  onDismiss: () => void;
  closeLabel: string;
}
```

- Renders a `role="status" aria-live="polite"` banner with the given `message`, an icon reflecting `kind`, and a close button (`aria-label={closeLabel}`, passed by the caller as `t.common_close`) that calls `onDismiss`.
- Auto-invokes `onDismiss` after a fixed delay (~5s) via an internal timer; the timer resets whenever `message` changes (i.e. re-mount/replace semantics, not a queue — see `data-model.md`).
- Pure/controlled: does not own its own visibility. The parent (`settings.tsx`) decides when to render/unmount it based on its own `toast` state.

## `ConfirmDialog`

```ts
interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}
```

- Renders a backdrop + centered dialog (`role="alertdialog" aria-modal="true" aria-labelledby aria-describedby`) only when `open` is `true`.
- Escape key and backdrop click both invoke `onCancel`. The Cancel button also invokes `onCancel`; the Confirm button invokes `onConfirm`.
- Focuses the Cancel button when it opens (safe default focus target for a destructive-action dialog).
- Stateless/controlled: does not call any API itself — `settings.tsx` wires `onConfirm` to the actual `api.clearOps()` call.

## Existing endpoints reused unchanged

For completeness — these are consumed as-is, with no request/response shape changes:

- `api.exportBackup()` — `web/src/lib/api/client.ts`
- `api.importBackup(payload)` — same
- `api.clearOps()` — same
- `api.getOps()` / `api.getExitPrices()` / `api.getPrices(ids)` — same, called from the fixed `reload()`
