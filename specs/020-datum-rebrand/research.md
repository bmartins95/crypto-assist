# Research: Datum Rebrand

## R1 — CSP / font delivery

- **Decision**: Load Space Grotesk from Google Fonts by extending the existing `<link>` in `web/index.html`; no infra change.
- **Rationale**: Verified `aws-infra/stacks/app-stack.ts` (line ~218): CSP already contains `style-src ... https://fonts.googleapis.com` and `font-src ... https://fonts.gstatic.com`, and the app already loads Inter this way. The clarify-phase assumption that a CSP change was needed was stale.
- **Alternatives considered**: self-host via @fontsource (rejected by user choice Q3; also adds packages); CSP amendment PR (unnecessary — already allowed).

## R2 — Token architecture

- **Decision**: Re-value the existing token families in `web/src/app/globals.css` (`--bg*`, `--text*`, `--border*`, `--s-*`) instead of introducing the brand guide's `--bg-0..3`/`--text-1..3` names. Add only three new custom properties: `--s-accent-strong: #14b8a6`, `--brand-orange: #f97316`, `--font-display: 'Space Grotesk', sans-serif`.
- **Rationale**: Dozens of selectors already consume the existing names; renaming is churn with no user-visible benefit and high regression risk. The brand is its *values*, not its variable names. Constitution IV (no speculative refactor).
- **Mapping (dark)**:

  | Existing token | Old value | Datum value |
  |---|---|---|
  | `--bg3` (page/body bg) | `#0a0a0b` | `#101013` |
  | `--bg` (legacy card bg) | `#0a0a0b` | `#101013` |
  | `--bg2` | `#242424` | `#232328` |
  | `--s-surface` | `#161618` | `#17171a` |
  | `--s-surface-2` (elevated inputs) | `#1d1d20` | `#1d1d20` (LOCKED, unchanged) |
  | `--s-surface-hover` | `#222226` | `#232328` |
  | `--s-border` | `#27272a` | `#26262b` |
  | `--border2` | `rgba(255,255,255,.18)` | `#323238` |
  | `--text` | `#e8e8e8` | `#f4f4f5` |
  | `--text2` / `--s-text-muted` | `#aaaaaa` / `#a1a1aa` | `#a1a1aa` |
  | `--text3` / `--s-text-dim` | `#666666` / `#71717a` | `#71717a` |
  | `--s-accent` | `#2dd4bf` | `#2dd4bf` (unchanged) |
  | `--s-accent-dim` | `rgba(45,212,191,.12)` | unchanged |
  | `--success` / `--danger` (dark) | `#34d399` / `#f87171` | unchanged (byte-identical requirement) |
  | `--brand-a` | `#f7931a` | replaced by `--brand-orange: #f97316` (audit call sites; coin-badge `#f7931a` literals are Bitcoin's color, not brand — keep) |
  | index.html pre-paint dark bg | `#0a0a0b` | `#101013` |

- **Alternatives considered**: adopting guide-native names with alias layer — rejected (two names for one value violates simplicity); CSS-in-JS theming — out of stack.

## R3 — Derived light palette (clarification Q1)

- **Decision**: Keep the current light-theme structure; re-value to Datum-compatible neutrals; accent becomes `#0d9488` (`teal-600`-equivalent from the delivery's `datum-symbol-light.svg`), accent-dim `rgba(13,148,136,.12)`; orange `#f97316` unchanged; light gain/loss values unchanged (byte-identical requirement).
- **Rationale**: `#2dd4bf` on white fails WCAG AA for text/icons (~1.9:1); `#0d9488` passes for large text/UI accents (~3.6:1 on white, better on darker text usage). The delivery itself designates `#0d9488` as the light-background teal.
- **Light neutral mapping**: page `#f4f4f5`, surface `#ffffff`, elevated `#f4f4f5` (kept), hover `#e4e4e7` (kept), borders unchanged rgba scale, text `#18181b`/`#52525b`/`#71717a`. Kept close to today's light scale to bound regression risk; the identity carrier in light mode is teal/orange/typography, not exotic neutrals.

## R4 — Icon rasterization

- **Decision**: One-time generation of `favicon-16.png`, `favicon-32.png`, `apple-touch-icon.png` (180), `icon-192.png`, `icon-512.png` using a throwaway `npx --yes @resvg/resvg-cli` (fallback: `npx sharp-cli`) run; commit the PNGs; no package.json change.
- **Rationale**: Brand spec forbids screenshots; constitution forbids a dependency whose only consumer is a one-off build step. Committed binaries are stable brand assets, regenerated only if the SVGs change.
- **Sources**: `datum-favicon.svg` → 16/32 (small-optimized variant per spec); `datum-icon.svg` → 180/192/512.

## R5 — Wordmark & BrandMark

- **Decision**: New `web/src/components/Wordmark.tsx` renders `datum` + `<span class="wm-dot">.</span>`, `size` prop sets font-size; CSS class `.wordmark` (Space Grotesk 700, -0.03em). `BrandMark.tsx` keeps its name/props (existing call sites: HeroPage, LoginScreen, loading/error states) but its body becomes the Datum tile mark (rect `rx≈22.5%`, teal D path, orange dot — from `datum-icon.svg`), gradient defs deleted, `aria-label` switched to the app title from i18n (`Datum`).
- **Rationale**: Keeping BrandMark's contract avoids touching every auth screen; the wordmark is genuinely new UI with 3 call sites (sidebar brand, hero topbar, hero footer attribution).

## R6 — Copy & i18n

- **Decision**: Change values of existing keys in all 10 locales: `app_title: 'Datum'`; hero copy per delivery (`hero_title_line1: 'Você está'` / `hero_title_line2: 'aqui.'` — line2 carries the orange emphasis, replacing the old gradient span; `hero_subtitle` = delivery subcopy). Add new key `hero_footer_attribution` (renders alongside the locale-invariant `datum.` wordmark). Translations authored for the 9 non-pt locales with financial-product tone.
- **Rationale**: Reusing keys means mobile keeps compiling with zero shared type changes; only genuinely new strings get new `UIText` keys (added to all locales in the same commit).
- **Note**: The document `<title>` is not React-rendered; it is set in `index.html` as `Datum — Sua carteira, consolidada` (pt-BR is the product's default locale; per-route titles are out of scope — the app doesn't set them today).

## R7 — Splash / boot loader

- **Decision**: Update `index.html`'s pre-paint background colors (`#101013` dark / `#f4f4f5` light) and page `<title>`; keep the minimal CSS ring loader (already teal). The React-side `LoadingState` (logo pulse + three dots) gets the new BrandMark automatically; dots recolored to teal via the token change if not already.
- **Rationale**: The brand spec's "center datum-favicon.svg at 64px" is interpreted against the app's actual two-stage boot (pre-React ring → React LoadingState with BrandMark): the React stage shows the 64px Datum mark; the pre-React ring stays intentionally minimal per the in-file comment (it exists to kill blank-screen time, and inlining the SVG there would duplicate the brand asset — noted as an accepted deviation).
- **localStorage keys** (`crypto-assist:theme`, etc.) are deliberately NOT renamed — renaming would silently reset every user's theme/locale preferences for zero visible benefit.

## R8 — Dead asset cleanup

- **Decision**: Delete `web/public/{next,vercel,file,globe,window}.svg` after verifying zero references (Next.js template leftovers).
- **Rationale**: Constitution IV (no dead code); also prevents old-identity stragglers.
