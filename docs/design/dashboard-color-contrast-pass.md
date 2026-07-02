# Dashboard — color & contrast pass

Small, targeted fixes to close the gap between the current app and the template. **Root cause:** almost everything is rendering on near-pure-black with surfaces too close to the background, so the layering that gives the template depth collapses. The fix is mostly one idea — push surfaces up from ~black to `#161618` and let borders define edges.

## Token targets (the layering that's missing)

```
canvas / page bg   #0a0a0b   (--bg)        — not pure #000
surfaces           #161618   (--surface)   — cards, sidebar, table, panels
inputs / inner     #1d1d20   (--surface-2)
hover / active     #222226   (--surface-hover)
borders            #27272a   (--border)
dividers/hairlines #1f1f22   (--border-soft)
text               #fafafa / muted #a1a1aa / dim #71717a
accent teal #2dd4bf · green #34d399 · red #f87171
```

One-step contrast is the goal: `#0a0a0b` bg → `#161618` surface → `#27272a` border.

---

## The three called out

1. **Background & items.** Canvas `#0a0a0b` (not `#000`). Every surface — cards, sidebar, table, panels — `#161618` with `#27272a` borders. Right now surface ≈ background, so cards don't lift.
2. **Table header.** No fill. Header text `#71717a`, `11.5px`, weight `500`, with a `1px` bottom border in `#1f1f22`. Row dividers use that same `#1f1f22`.
3. **Table hover.** Currently too bright. Target `#222226` — a gentle step up. It only looks dramatic today because the base rows are black; once the table sits on `#161618`, `#222226` reads as subtle.

```css
thead th{background:transparent;color:#71717a;font-size:11.5px;font-weight:500;border-bottom:1px solid #1f1f22}
tbody td{border-bottom:1px solid #1f1f22}
tbody tr:hover{background:#222226}
```

---

## Also needs fixing (from comparing app vs template)

4. **Sidebar has no surface or divider — biggest one.** In the app the sidebar is the same black as the content, so there's no panel separation. Give it `background:#161618` and `border-right:1px solid #1f1f22`. This single change does most of the visual lift.

5. **Chart & distribution panels are too dark/flat.** Wrap each in `#161618` + `1px #27272a` border + `12px` radius, same as the metric cards. On Lucro they're currently blending into the page.

6. **Chart panel is missing its title.** Template has an uppercase label above the bars: `LUCRO / PREJUÍZO POR ATIVO` — `11.5px`, weight `600`, `letter-spacing:.05em`, color `#71717a`. The app renders the chart with no header. "Distribuição por aporte" already has its title; match that treatment on the chart panel.

7. **Lucro metric cards are missing the label icons.** Template prefixes them: `✓ Lucro realizado`, `⧗ Não realizado`, `↑ Melhor ativo`, `↓ Pior ativo`. The app dropped those. Minor, but a visible diff.

8. **Polish:** table cell padding should be `12px 16px` (app rows are a touch tall). And make sure the `Por ativo / Por plataforma / Ativo + plataforma` segmented control has its own `#161618` container + `#27272a` border rather than sitting bare on the background:

```css
.seg{background:#161618;border:1px solid #27272a;border-radius:9px;padding:3px}
.seg button.on{background:#222226;color:#fafafa}
```

---

## Do NOT change

- The app uses **real coin logos** (BTC/USDC/BNB/…) instead of the template's placeholder lettered circles — that's an upgrade. Keep it.

---

**Net:** most of this collapses to one action — move surfaces from ~black up to `#161618` and let `#27272a` borders (with `#1f1f22` hairlines) define edges. Items 4 and 5 (sidebar + panel surfaces) deliver the biggest visible improvement.
