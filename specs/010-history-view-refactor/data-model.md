# Data Model: History View Redesign with Entry Drawer

No database schema, backend model, or `shared/src/types.ts` changes. `Op`/`NewOp`/`Asset`
are unchanged (see spec.md Key Entities). This feature only introduces ephemeral,
component-local UI state.

## DrawerState (new, local to `OpDrawer.tsx`, not persisted or exported from `shared/`)

| Field | Type | Description |
|---|---|---|
| `open` | `boolean` | Whether the drawer is visible |
| `opType` | `'buy' \| 'sell' \| 'trade'` | Active fieldset mode; defaults to `'buy'` on new-entry open |
| `editingOp` | `Op \| undefined` | Set when opened via a row's edit icon; `undefined` for a new entry |
| Buy/Sell fields | — | `date`, `platform`, `coin` (via existing `CoinSearch`), `qty`, `unitPrice`, `fee`; `total` is derived, not stored as independent input state |
| Trade fields | — | `date`, `platform`, `fromCoinId`, `fromQty`, `toCoin`, `toQty`, `total`, `fee` — same shape as the current `HistoryTab.tsx` trade state, relocated |

**Validation / invariants** (enforced before submit, per spec FR-008):
- Buy/Sell: `coin`, `qty > 0`, `unitPrice > 0` required.
- Trade: `fromCoinId`, `toCoin`, `fromQty > 0`, `toQty > 0`, `total > 0` required; `fromCoinId !== toCoin.coinId`.
- On close (Escape / backdrop / Cancel) without submit, all `DrawerState` is discarded — no partial writes to `ops`.

**State transitions**:
- Closed → Open (new): triggered by the header's "Register operation" button; `opType='buy'`, all fields blank, `editingOp=undefined`.
- Closed → Open (edit): triggered by a table row's edit icon; `opType` set from the op's `type` (`'buy'`/`'sell'`), fields pre-filled from `editingOp`, Trade mode unreachable from this path (a stored `Op` is always a single Buy or Sell leg, never a trade pair — trades are recorded as two independent ops with no linking id, matching current `handleEditOp` behavior).
- Open → Closed (submit): validated, `onAddOp`/`onEditOp` called (one or twice for Trade), then state resets.
- Open → Closed (cancel/Escape/backdrop): state resets, no callback invoked.

No new entity is added to `shared/src/`; `DrawerState` is a `useState` shape internal to `OpDrawer.tsx`, following the same "component-local form state" pattern already used by `HistoryTab.tsx` today (`opDate`, `opCoin`, etc.) — just relocated and consolidated into the drawer.
