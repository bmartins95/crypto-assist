# Handoff: History & Operation Panel Refactor (Datum)

## Overview
Refactor of the **History** page and the **Add operation** panel of the Datum crypto tracker. Current problem: two different concepts — wallet movement (buying/selling/swapping assets the user holds) and speculative trades (leveraged long/short positions) — are mixed into the same flow and the same table, with the Open/Partial/Closed status applied per-operation, which doesn't make sense for wallet flows.

The solution separates the two concepts **without creating new panels**: two entry buttons, three behaviors of the existing operation panel, and two row classes in the History table. The existing Wallet and Profit views do not change.

All 22 items below were **approved individually by the product owner**. Implement all of them.

## About the design files
The `.dc.html` files in this package are **HTML design references** — prototypes showing intended behavior and structure, NOT production code. The task is to recreate these behaviors in the real codebase (React/Vite, `/history` route) using the patterns, components, and libraries that already exist.

⚠️ **Visual source of truth = the current app.** The hi-fi prototype approximates the app's theme, but the product owner considers the app's current design the correct standard. On any divergence in color, spacing, typography, icons, or chip style between the prototype and the app, **follow the app**. Reuse existing components (panel segmented control, Buy/Sell chips, orange leverage chip, status pills, inputs, primary teal button, row icons).

## Fidelity
**Behavioral: high** (flows, rules, and states are complete and approved). **Visual: use the app's own design system** — the prototype is for layout/structure, not pixel-perfect styling.

---

## Approved changes

### A. History — header
1. Replace the single "Add operation" button with **two buttons**:
   - **"Move wallet"** — primary, styled like the current teal button ("+ Add operation").
   - **"New trade"** — secondary/outline using the orange already used by the leverage chip (e.g. `#fb923c` at 45% on the border, orange text), with a ⚡ icon or an equivalent from the app's existing icon set.

### B. History — table rows
Columns kept: ASSET · TYPE · QTY · TOTAL · P/L · STATUS · actions. Day-grouping kept.

2. **Wallet rows** (Buy/Sell/Swap without the trade flag) **have no status** — the STATUS column shows "—".
3. **Wallet sells** show the **realized profit/loss** in the P/L column, computed against the average buy price (FIFO — see Data rules). Green positive, red negative.
4. New **"Swap"** type (chip styled like the Buy/Sell chips, suggested distinct color — purple) for asset and/or platform swaps. On the row: ASSET = "ETH→SOL", QTY = "0.5→22".
5. **Platform does not appear in the compact row** — it lives only in the expandable panel (chevron), matching the app's existing pattern.
6. **Trade rows** gain: a discreet visual marker (2px orange border on the row's left edge) + a **"Long"/"Short"** label next to the leverage chip in the TYPE column.
7. **Only trade rows have status** (Open/Partial/Closed, current pills) **and a close action** — the existing teal check-circle icon, shown only when Open/Partial.
8. Wallet rows **have no close button/icon** — only edit, delete, chevron.

### C. "Move wallet" panel
Same right-side panel as today, title "Add operation".

9. Segmented control tabs: **Buy / Sell / Swap** (rename "Trade" → "Swap").
10. **Sell and Swap operate on balance** (asset × platform), not on a specific operation:
    - When an asset + platform is selected, show an **"Available balance"** card: available balance + average buy price.
    - The Quantity field gets a **"Max"** button (fills the total balance — move the whole platform's holding in one gesture).
    - Validation: quantity ≤ available balance.
11. On the **Sell** tab, the footer shows **"Estimated profit/loss (vs avg. cost)"** — (sell price − avg. cost) × qty, updated as the user types.
12. On the **Swap** tab, keep the current "You sell → You receive" structure: source with balance/Max; **"You receive"** block with Destination platform (empty = same as source), Asset, Quantity, Unit price. **No P/L** — the cost basis is inherited by the received asset.
13. **Remove the Leverage field** from this panel — wallet movement has no leverage.

### D. "New trade" panel
Opened by the "New trade" button. Same panel shell.

14. Segmented control with 2 tabs: **"Buy · Long" / "Sell · Short"**. Short **does not check wallet balance** (selling what you don't have is allowed — it's a position).
15. A trade **does not change Wallet balances**. Creates the operation with status **Open**.
16. **Leverage field (1x/2x/3x/5x/10x)** exists **only** in this panel (current chip component).

### E. "Close position" panel
Opened by the check-circle on an Open/Partial trade row.

17. **No tabs** — type is locked and derived from the position: a short closes with a **Buy**, a long closes with a **Sell**. Show the type as a single disabled segment + microcopy explaining it ("A short closes with a Buy").
18. **Context banner** at the top (current teal banner style): "Closing position: {ASSET} · {Long|Short} {leverage} · {platform} · remaining {qty}".
19. Quantity: max = remaining quantity, **"All"** button. Qty < remaining → **partial close**: creates the linked closing operation and the position's status becomes/stays **Partial**; qty = remaining → **Closed**.
20. Footer: **"P/L of this close"** — result of only the fraction being closed, with the sign inverted for shorts ((entry price − close price) × qty × leverage; long is the inverse).

---

## Data rules (approved)

21. **Internal FIFO for the wallet.** The buy↔sell link stops being a user gesture. Every wallet sell/swap consumes buy lots of the pair (asset × platform) in chronological order (FIFO). From this are derived: available balance, average price, realized P/L of the sell (item 3/11), and inherited cost in the swap (item 12).
    - Suggested model: wallet operations are immutable in the log; balances and lots are **derived** (recomputed), not stored per operation.
    - Trades stay outside the wallet's FIFO: each position references its closing operations directly (entry → partial closes).
22. **Recompute on edit/delete.** Editing or deleting an old buy triggers a recompute of balances/P/L for all later sells of the same asset × platform. Show a **confirmation dialog** when the change affects already-recorded sells (e.g. "This change affects 2 later sells — realized P/L will be recalculated") and block it when it would produce a negative balance on any date.

### Migration of existing data
- Current operations with leverage > 1x → mark as **trade** (Long if Buy, Short if Sell), preserving existing status and close links.
- Operations at 1x → become wallet flow; remove status; recompute realized P/L via FIFO.
- The panel's current "Trade" type (swap between platforms/assets) → becomes **Swap**.

## Interactions & behavior
- "Move wallet" opens the panel in wallet mode (Buy tab default). "New trade" opens trade mode (Buy · Long default). The check-circle opens close mode already contextualized with the row's position.
- Switching tabs preserves filled-in Date/Platform.
- "Max"/"All" fill quantity; "current" next to Unit price keeps its current behavior (current market quote).
- Estimated P/L (Sell) and P/L of this close update on every qty/price keystroke.
- The panel closes with ✕/Cancel without persisting anything (current behavior).

## State management
- `panelMode: null | 'wallet' | 'trade' | 'close'`; `walletTab: 'buy' | 'sell' | 'swap'`; `tradeTab: 'long' | 'short'`; `closingPosition: ref` (close mode).
- Derived via selector: balance per asset×platform, FIFO lots, average price, realized P/L.
- New per-operation fields: `kind: 'wallet' | 'trade'`, `side: 'long' | 'short'` (trade), `swap: {toAsset, toPlatform, toQty, toUnitPrice}` (swap), `closes: positionId` (closes).

## Design tokens
Use the tokens already in the app. Observed references: background `#0a0a0c`/surface `#101014`/elevated `#17171a`, border `#1e1e26`–`#26262e`, primary teal `#2dd4bf`, green `#34d399`, red `#f87171`, leverage orange `#fb923c`, Partial yellow `#eab308`, suggested Swap purple `#a78bfa`. **If the codebase has its own tokens, they take precedence.**

## Files
- `Hi-fi - Histórico Refactor.dc.html` — interactive prototype of the panel's 3 modes + table (open in a browser; requires `support.js` in the same folder). Behavior/structure reference, not style. **Not provided to this repo — request it if pixel-level interaction detail is needed; per the note above, the app's own live design system is the visual source of truth regardless.**
- `wallet-trade-refactor-wireframes.html` (originally `Wireframes - Refactor Operações.dc.html`) — approved wireframes of the flow, included alongside this file.
- `support.js` — prototype runtime (not app code). **Not provided to this repo.**
