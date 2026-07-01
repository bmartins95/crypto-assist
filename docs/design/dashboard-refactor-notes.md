# Dashboard rework — implementation notes

Full spec for the **collapsible sidebar** + the three views (**Wallet · Profit · History**), including the History entry **drawer** with Buy / Sell / Trade.

The prototype `dashboard-collapsible-sidebar.html` is the visual source of truth — pixel values and colors below match it. This doc translates it into a React structure (TanStack Router). Values are given as raw CSS so they map cleanly to CSS Modules or the project's existing globals.css approach.

---

## 0. Design tokens

Define once (`:root` / theme file) and use everywhere — same set as the settings page, so both screens stay consistent.

```
--bg:           #0a0a0b
--surface:      #161618   /* sidebar, cards, table, drawer */
--surface-2:    #1d1d20   /* inputs, selects, summary block, inner blocks */
--surface-hover:#222226   /* hover, active nav, active segment, toggle track */
--border:       #27272a
--border-soft:  #1f1f22   /* dividers, hairlines */
--text:         #fafafa
--text-muted:   #a1a1aa
--text-dim:     #71717a   /* labels, hints, timestamps */
--accent:       #2dd4bf   /* active nav icon, primary button, focus ring */
--accent-dim:   rgba(45,212,191,.12)
--green:        #34d399  --green-dim: rgba(52,211,153,.14)   /* gains */
--red:          #f87171  --red-dim:   rgba(248,113,113,.14)  /* losses, danger */
--radius:12px  --radius-sm:9px
```

Font: **Inter** 400/500/600/700. Numeric cells use `font-variant-numeric: tabular-nums` so columns align.

---

## 1. App shell & routing

The sidebar is persistent chrome; the three views are **real routes** sharing one layout. This replaces the old in-page tabs — each view now has its own URL, working back button, and independent data loading.

Use TanStack Router (already in the project), not react-router:

```
Routes:
  /              → redirect to /wallet
  /wallet        → WalletView
  /profit        → ProfitView
  /history       → HistoryView
  /settings      → SettingsPage (existing)
  /auth          → AuthClient (existing)
  /auth/callback → AuthCallbackPage (existing)
```

`AppLayout` owns the grid and the collapsed state:

```tsx
function AppLayout() {
  const [collapsed, setCollapsed] = useState(
    () => localStorage.getItem('sidebar:collapsed') === '1'
  );
  const toggle = () => setCollapsed(c => {
    localStorage.setItem('sidebar:collapsed', c ? '0' : '1');
    return !c;
  });
  return (
    <div className={`layout ${collapsed ? 'collapsed' : ''}`}>
      <Sidebar collapsed={collapsed} onToggle={toggle} />
      <main className="content"><Outlet /></main>
    </div>
  );
}
```

Grid + collapse animation:

```css
.layout { display: grid; grid-template-columns: 232px 1fr; transition: grid-template-columns .22s ease }
.layout.collapsed { grid-template-columns: 66px 1fr }
.content { padding: 22px 26px; min-width: 0 }
```

**Account actions move here.** The old floating top-right email / Settings / Logout bar is removed — these now live in the sidebar footer (§2). The only per-page action (`Refresh prices`) moves into each view's content header (§3).

---

## 2. Sidebar

### 2.1 Structure

```tsx
<aside className="sb">
  <div className="sb-top">
    <div className="brand"><span className="logo">₿</span><span className="txt">Carteira</span></div>
    <button className="collapse-btn" onClick={onToggle}
            aria-label="Toggle sidebar" aria-expanded={!collapsed}>
      <ChevronLeft />
    </button>
  </div>

  <div className="navlbl">Portfolio</div>
  <NavItem to="/wallet"  icon={<Wallet />}  label={t.nav_wallet} />
  <NavItem to="/profit"  icon={<TrendUp />} label={t.nav_profit} />
  <NavItem to="/history" icon={<Bars />}    label={t.nav_history} />

  <div className="sb-foot">
    <NavItem to="/settings" icon={<Gear />} label={t.nav_settings} />
    <button className="navi" onClick={logout}><LogOut /><span className="lbl">{t.nav_logout}</span></button>
    <div className="userchip"><span className="avatar">{initial}</span><span className="ue">{email}</span></div>
  </div>
</aside>
```

`NavItem` uses TanStack Router `<Link>` with `activeProps={{ className: 'navi active' }}`.

### 2.2 Collapsed state

When collapsed the rail is 66px: labels hide, icons center, collapse button stays visible and chevron rotates 180°. CSS tooltips appear on hover via `data-tip` + `::after`.

### 2.3 Persistence

Read `localStorage.getItem('sidebar:collapsed')` on init; write on toggle.

---

## 3. Shared content primitives

Build once; all three views reuse them.

### 3.1 Content header (`chead`)

Per-view title + subtitle on the left, contextual actions on the right (refresh button + last-updated timestamp).

### 3.2 Metric cards — `<MetricCard label value valueColor sub subColor />`

4-column grid. Cards: background `var(--surface)`, border `var(--border)`, 14px padding.

### 3.3 Segmented control — `<Segmented options value onChange />`

Already exists in settings page. Reuse.

### 3.4 Table + asset cell + pills

Shared by Wallet and History. Wrap in `.tbl.scroll` for horizontal overflow inside the grid.
`td.num` uses `font-variant-numeric: tabular-nums`.

---

## 4. View — Wallet (`/wallet`)

Header: title from `t.nav_wallet`, subtitle price source info, right: last-updated + refresh button.

1. **Metrics row** (4 cards): Invested, Current value, Profit/Loss (red when negative), Return (red/green).
2. **View segmented**: By asset · By platform · Asset + platform (component state, no route change).
3. **Holdings table**: Asset · Current price · Invested · Current value · P/L · Return (pill) · Exit target.

---

## 5. View — Profit (`/profit`)

Header: title from `t.nav_profit`, subtitle, refresh action.

1. **Metrics row** (4 cards): Realized P/L, Unrealized P/L, Best asset (ticker + % sub), Worst asset (ticker + % sub).
2. **Chart-mode segmented**: By asset · Over time · Portfolio value (component state).
3. **P/L-by-asset chart** (divergent bar, Recharts `BarChart` with `ReferenceLine y={0}`, per-bar fill by sign).
4. **Allocation by investment**: horizontal bars with label row (name, ticker) and amount/% on right.

---

## 6. View — History (`/history`)

Header: title from `t.nav_history`, subtitle, primary **+ Register operation** button (`.btn-accent`) that opens the drawer. The two always-visible forms are **removed**.

**Operations table**: Date · Coin · Type (pill) · Qty · Unit price · Total · Fee · Platform · actions (edit / delete icon buttons).

### 6.1 Entry drawer

Right-side slide-over + backdrop. State: `open: boolean`, `opType: 'buy' | 'sell' | 'trade'`.

**Fields for Buy/Sell**:
- Date, Platform
- Coin (label swaps "Coin bought" / "Coin sold" by type)
- Quantity, Unit price (BRL)
- Fee (BRL), Total (BRL) — readonly, auto-calculated, with hint

**Fields for Trade** (swap form, two blocks):
- Date, Platform
- "You sell" block (red left border): From asset, Quantity sold
- Arrow badge
- "You receive" block (green left border): To asset, Quantity received
- Fee (BRL), Total (BRL)

Submitting a Buy or Sell writes one op. Submitting a Trade writes two ops (sell + buy paired).

### 6.2 Drawer accessibility

- `role="dialog" aria-modal="true"`, `aria-labelledby` pointing to the title
- Focus moves to first field on open; trap focus inside; restore on close
- Escape closes; backdrop click closes
- Body scroll locked while open

---

## 7. Build order

1. `AppLayout` + `Sidebar` + routing (shell with three routes, existing layout bar removed).
2. Shared primitives (MetricCard, content header, `.btn` variants, table styles).
3. Port **Wallet** into the new shell.
4. **Profit** (metrics → chart → allocation bars).
5. **History**: table first, then drawer, then type switching (Buy/Sell → Trade).
6. Accessibility pass (focus trap, aria, body-scroll lock).

Everything visual matches `dashboard-collapsible-sidebar.html` in this folder.
