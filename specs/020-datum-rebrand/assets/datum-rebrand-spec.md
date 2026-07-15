# Datum Rebrand — Implementation Spec

Rebrand of the crypto-assist React app to **Datum** (product) under **Buma Labs** (company). This spec covers naming, design tokens, brand assets, and per-surface restyling. All existing UX flows, layouts, and locked component decisions are preserved — this is a reskin plus rename, not a redesign of behavior.

## 1. Naming

- Product name: `Datum` (capitalized in prose, `datum.` lowercase with orange period in the wordmark).
- Replace all user-facing occurrences of "crypto-assist" / "Crypto Assist" with "Datum".
- HTML `<title>`: `Datum — Sua carteira, consolidada` (adjust per page/route as sensible).
- Package name in `package.json`: `datum-app` (internal only, no user impact).
- Footer / about attribution: `datum. · um produto Buma Labs`.
- Future domain: `datum.bumalabs.net` (Cognito callback URLs and CloudFront/Vercel domains will be updated in a separate infra task — do NOT change env values in this pass).

## 2. Design tokens

Create or update the global token layer (CSS variables at `:root`, or the theme file if one exists). Values:

```css
:root {
  /* surfaces */
  --bg-0: #101013;        /* page background */
  --bg-1: #17171a;        /* cards, sidebar, surfaces */
  --bg-2: #1d1d20;        /* elevated inputs — LOCKED decision, keep */
  --bg-3: #232328;        /* hover on elevated */
  --border: #26262b;
  --border-strong: #323238;

  /* brand */
  --teal: #2dd4bf;        /* primary action, active nav, brand stroke */
  --teal-strong: #14b8a6; /* primary hover */
  --teal-dim: rgba(45,212,191,.12);  /* active nav bg, badge bg */
  --orange: #f97316;      /* "datum point" — reserved accent, use sparingly */
  --orange-dim: rgba(249,115,22,.14);

  /* text */
  --text-1: #f4f4f5;
  --text-2: #a1a1aa;
  --text-3: #71717a;

  /* semantics (unchanged) */
  --gain: #34d399;  --gain-dim: rgba(52,211,153,.13);
  --loss: #f87171;  --loss-dim: rgba(248,113,113,.13);

  /* type */
  --font-display: 'Space Grotesk', sans-serif;
  --font-ui: 'Inter', sans-serif;

  /* radii */
  --r-sm: 8px; --r-md: 12px; --r-lg: 16px;
}
```

Color usage rules (enforce in review):
- **Teal** = structure and action: primary buttons, active nav pill, focus rings, links, brand stroke.
- **Orange** = the datum point only: wordmark period, active-item dot marker, rare emphasis (e.g., "aqui" in the hero). Never use orange for buttons, gains, or warnings.
- **Green/red** remain exclusive to gain/loss. Never use teal or orange to signal profit/loss.
- The old orange→teal gradient app icon is retired. No gradients in the new identity — flat surfaces only.

## 3. Typography

- Add Google Fonts: Space Grotesk (400/500/700) and Inter (400/500/600). Self-host later if desired.
- `--font-display` (Space Grotesk): wordmark, page titles (h1–h3), KPI numbers, table numeric cells, badges with numbers.
- `--font-ui` (Inter): body, labels, inputs, buttons, table text.
- Numeric alignment: apply `font-variant-numeric: tabular-nums` on tables and KPI cards.

## 4. Brand assets (provided in /assets)

| File | Purpose |
|---|---|
| `datum-icon.svg` | Master app icon, 512 viewBox, dark tile #17171a, teal D stroke, orange dot. Use for PWA icons (512/192), app-store exports, og:image base. |
| `datum-favicon.svg` | Small-size-optimized variant (thicker relative stroke, larger dot, tighter tile radius). Use as `<link rel="icon" type="image/svg+xml">` and to rasterize favicon-32.png / favicon-16.png / apple-touch-icon (180, with tile). |
| `datum-symbol-light.svg` | Tile-less symbol with darker teal (#0d9488) for light backgrounds (docs, emails). Not used in-app. |

Tasks:
1. Replace existing favicon and PWA manifest icons; regenerate PNG sizes from the SVGs (sharp or resvg — do not screenshot).
2. Update `manifest.json`: name `Datum`, short_name `Datum`, background_color `#101013`, theme_color `#17171a`.
3. Update the `index.html` splash (from the auth black-screen fix): center `datum-favicon.svg` at 64px on `--bg-0`, keep the existing logo-pulse + three blinking dots loader, dots recolored to `--teal`.

## 5. Wordmark component

Create `<Wordmark />` primitive: `datum` in Space Grotesk 700, letter-spacing -0.03em, with a trailing period colored `--orange`. Props: `size` (px). Used in: sidebar brand, auth hero, landing footer. The period is part of the wordmark — never render "datum" without it in brand contexts.

## 6. Per-surface restyle

### AuthShell / landing (public hero)
- Keep existing flow: hero → Google/Facebook/email login → OAuth loading → Aurora warming states.
- Hero copy (PT-BR): headline `Você está aqui.` with `aqui` in `--orange`; subcopy: `Todos os seus ativos, todas as suas plataformas, um único ponto de referência. O Datum consolida sua carteira pra você decidir o próximo passo.`
- Primary CTA teal (`--teal` bg, dark teal text #062a26); secondary ghost.
- Aurora warming and error states: keep locked patterns (logo pulse + three blinking dots — recolor dots teal; error = icon badge + "Tentar novamente" + "Sair" ghost).

### Sidebar
- Brand block: 26px icon + `<Wordmark size={17} />`.
- Active item: existing sliding pill mechanic kept; pill bg `--teal-dim`, text `--teal`, 3px teal edge bar, plus a 7px `--orange` dot before the active label (the datum point motif).
- Refresh-prices spin→success cycle: keep animation; success check in `--teal`.

### Carteira (all three grouping modes)
- KPI summary cards (Investido, Valor atual, Lucro/Prejuízo, Retorno): values in Space Grotesk 500; gain/loss coloring unchanged; Retorno keeps pill badge.
- Tables: header row 11px uppercase `--text-3`; numeric columns in `--font-display`; row borders `--border`.
- Platform chips stay rounded-square (LOCKED: distinguishes platforms from circular coin logos); coin avatars stay circular.

### Drawer "Registrar operação"
- Keep everything locked: elevated inputs `--bg-2`, dark dropdown scrollbar, CoinGecko auto-fill with `atual`/`manual` badge (`atual` badge now `--teal-dim`/`--teal`), spinner→check submit (flex:1 label centering + fixed min-width preserved), check color `--teal`.

### Wallet entrance animation
- Keep the staggered card/row reveal. Optional polish (nice-to-have, not required): stagger origin from the sidebar datum dot outward.

## 7. Out of scope

- No route, state, or API changes.
- No Cognito/infra domain changes in this pass.
- Lucro and Histórico tabs: token/typography pass only, no layout changes.

## 8. Acceptance checklist

- [ ] No occurrence of "crypto-assist" in user-facing strings, titles, or manifest.
- [ ] Favicon renders crisply at 16px in browser tab (verify against `datum-favicon.svg`, not the master icon).
- [ ] Orange appears ONLY as: wordmark period, sidebar active dot, hero `aqui`, and orange-dim badges where specified.
- [ ] Gain/loss colors byte-identical to current values in tables and KPIs.
- [ ] Elevated inputs remain `#1d1d20`.
- [ ] Space Grotesk on all KPI numbers and table numerics with tabular-nums.
- [ ] Auth flow states (loading, warming, error) visually verified in dev.
