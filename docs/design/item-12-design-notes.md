## Item 12 — Design notes (visual layer)

Attach under item 12. This covers **only the visual/UX layer** — the data logic (`computeTimeline`, `price_history`, endpoints) is already specified above and is unchanged. Pixel truth: `timeframe-chart-design.html`. Tokens are the app's usual set (`--surface #161618`, `--surface-2 #1d1d20`, `--surface-hover #222226`, `--border #27272a`, `--border-soft #1f1f22`, `--text #fafafa`, `--dim #71717a`, `--accent #2dd4bf`, `--green #34d399`, `--red #f87171`).

### Placement
The `TimeframeSelector` renders **inside the chart panel header**, right-aligned, on the same row as the panel title (e.g. "Lucro no tempo"). It does **not** go in the page header.

- Shown only for the two time-based modes: **Lucro no tempo** (`over-time`) and **Valor da carteira** (`value`).
- Hidden for **Por ativo** (that mode has no timeframe concept).
- One selector instance drives both charts (shared state in `ProfitTab`), matching the plan decision.

```
┌ panel ──────────────────────────────────────────────┐
│  LUCRO NO TEMPO                 [1D 1S 1M 1A Tudo]  │  ← header row
│  ┌──────────────── chart ─────────────────────┐   │
│  └──────────────────────────────────────────────┘   │
└───────────────────────────────────────────────────────┘
```

### TimeframeSelector styling
Compact segmented control — **visually subordinate** to the mode tabs (Por ativo / Lucro no tempo / Valor da carteira), so the hierarchy reads as "tabs pick *what*, selector picks *the window*."

```css
.tf{ display:inline-flex; background:var(--surface-2); border:1px solid var(--border);
     border-radius:8px; padding:2px; gap:1px; }
.tf button{ background:transparent; border:0; color:var(--dim);
     font-size:11.5px; font-weight:600; letter-spacing:.02em;
     padding:5px 11px; border-radius:6px; cursor:pointer; transition:.13s; }
.tf button:hover{ color:var(--text); }
.tf button.on{ background:var(--surface-hover); color:var(--text); }
```
- Options: `1d · 1s · 1m · 1a · all`. **Labels come from i18n** (`timeframe_1d…timeframe_all`); PT-BR: `1D · 1S · 1M · 1A · Tudo`.
- Controlled component: `value`, `onChange` (already in the spec).
- Keyboard: arrow-key navigation between options; active option has `aria-pressed="true"`.

### Chart styling
Replace the current indigo line with the **accent teal**, add a soft area gradient, and emphasize the zero baseline (important for "Lucro no tempo", which crosses zero).

```css
.line{ fill:none; stroke:var(--accent); stroke-width:2.5; stroke-linecap:round; stroke-linejoin:round; }
.grid-line{ stroke:var(--border-soft); stroke-width:1; }        /* horizontal gridlines */
.zero-line{ stroke:var(--border); stroke-width:1; stroke-dasharray:3 4; }  /* the R$0 / US$0 baseline */
.axis-txt{ fill:var(--dim); font-size:11px; }                  /* x + y labels, tabular */
.dot-end{ fill:var(--accent); stroke:var(--surface); stroke-width:2; }     /* last point marker */
/* area fill */
/* <linearGradient id="ag" x1=0 y1=0 x2=0 y2=1>
     <stop offset=0 stop-color=#2dd4bf stop-opacity=.22/>
     <stop offset=1 stop-color=#2dd4bf stop-opacity=0/> */
```
- Line smoothed (Catmull-Rom → cubic bezier), not straight segments.
- 4 horizontal gridlines + y labels; x labels only at first / middle / last to avoid crowding.
- Dashed zero line only when the data range crosses zero.

**Optional (Lucro no tempo only):** color the area **green above zero / red below** to signal gain vs loss. More expressive but more code (split fill at the zero crossing) — the teal single-color version above is the baseline; treat the sign-split as a nice-to-have.

### Loading state
While `getPriceHistory` is in flight (on mount and on every timeframe change), show a spinner **overlaying the chart area only** — not the whole panel — with the axes kept in place so nothing reflows/jumps.

```css
.loading{ position:absolute; inset:0; display:flex; align-items:center; justify-content:center;
          background:rgba(22,22,24,.55); backdrop-filter:blur(1px); border-radius:8px; }
.spin{ width:26px; height:26px; border:3px solid var(--border); border-top-color:var(--accent);
       border-radius:50%; animation:spin .7s linear infinite; }
@keyframes spin{ to{ transform:rotate(360deg); } }
```
The chart panel keeps its height during load (don't collapse it).

### Hover (crosshair + tooltip)
On pointer move over the plot area: a vertical crosshair at the nearest data point, a highlighted dot on the line, and a tooltip following it with the date and value.

```css
.cross{ stroke:var(--border); stroke-width:1; }
.dot-hover{ fill:var(--accent); stroke:var(--surface); stroke-width:2.5; }
.tooltip{ position:absolute; pointer-events:none; transform:translate(-50%,-100%);
          background:var(--surface-2); border:1px solid var(--border); border-radius:8px;
          padding:7px 10px; font-size:12px; box-shadow:0 8px 20px rgba(0,0,0,.5); }
.tooltip .d{ color:var(--dim); font-size:11px; margin-bottom:2px; }   /* date */
.tooltip .v{ font-weight:600; font-variant-numeric:tabular-nums; }    /* value */
```
- Value formatting follows the active currency (USD after item 10): `US$ 1.234,56` (pt-BR number formatting).
- Tooltip hides on pointer leave.
- If a chart lib is used (Recharts), map these to `<Tooltip>`, `<ReferenceLine y={0}>`, and `<CartesianGrid>` rather than hand-rolling — the styling targets are the same.

### Empty state
When the selected window yields fewer than 2 points (e.g. "1D" right after the first purchase), render a centered message instead of a broken chart:

```
Sem dados no período
```
```css
.empty{ display:flex; align-items:center; justify-content:center; height:280px;
        color:var(--dim); font-size:13px; }
```
This aligns with the item's rule that the chart never shows an asset before it was actually acquired.

### Reduced motion
```css
@media (prefers-reduced-motion:reduce){ .spin{ animation:none; } }
```
Skip the fetch spinner animation (show a static indicator) and any chart entrance transition for users who opt out.

### Design done when
- [ ] `TimeframeSelector` sits in the chart panel header (right-aligned), visible only for `over-time` and `value` modes, hidden for `Por ativo`.
- [ ] Selector styled as the compact segmented control above; labels from i18n; active state uses `--surface-hover`.
- [ ] Chart line is teal `#2dd4bf` with the area gradient and a dashed zero baseline; smoothed line; muted gridlines/axis.
- [ ] Timeframe change shows the loading overlay on the chart area (axes stay, no layout jump), then reflows.
- [ ] Hover shows crosshair + dot + tooltip (date + value, tabular figures) on both charts.
- [ ] Windows with < 2 points render "Sem dados no período" instead of a broken chart.
- [ ] `prefers-reduced-motion` respected.
