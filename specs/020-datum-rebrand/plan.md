# Implementation Plan: Datum Rebrand

**Branch**: `020-datum-rebrand` | **Date**: 2026-07-15 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/020-datum-rebrand/spec.md`, plus the authoritative brand delivery in `specs/020-datum-rebrand/assets/` (`datum-rebrand-spec.md` wins on conflicts).

## Summary

Reskin + rename the web app to **Datum** (Buma Labs): swap the global CSS token values to the Datum palette (keeping the app's existing two token families and theme mechanism), add Space Grotesk alongside the already-loaded Inter, replace the old gradient BrandMark and ₿ sidebar glyph with the Datum mark + `<Wordmark />`, install the new favicon/manifest/touch icons, rewrite brand copy through the existing i18n layer (all 10 locales), and derive a Datum light palette behind the existing Claro/Escuro/Sistema toggle. No routes, state, APIs, or backend change. No infra change — the CloudFront CSP already allows Google Fonts.

## Technical Context

**Language/Version**: TypeScript / React 19 / Vite (web only — mobile out of scope per clarification)

**Primary Dependencies**: existing stack only. No new runtime deps. PNG icon rasterization done once at dev time via a throwaway `npx` invocation (nothing committed to package.json).

**Storage**: N/A (no data model changes; `localStorage` keys — `crypto-assist:theme`, locale, etc. — deliberately unchanged so user prefs survive the rebrand)

**Testing**: Vitest + Testing Library (`cd web && npm test`); backend pytest untouched but run before PR per constitution

**Target Platform**: Web (CloudFront + S3); mobile must still typecheck/build but is not restyled

**Project Type**: Web application (frontend-only change)

**Performance Goals**: no regression; fonts load via existing preconnects; `font-display: swap` per Google Fonts default

**Constraints**: CSP already permits `fonts.googleapis.com` / `fonts.gstatic.com` (verified in `aws-infra/stacks/app-stack.ts` line 218) — do not add other external origins. Gain/loss color values must remain byte-identical. Elevated inputs stay `#1d1d20`.

**Scale/Scope**: ~1 CSS token file, ~8 components, 10 locale files, index.html, public/ assets, +1 new component (`Wordmark`), +1 replaced component body (`BrandMark`)

## Constitution Check

*GATE evaluated pre-Phase 0 and re-checked post-design — PASS on both.*

- **I. Shared-First**: locale string changes live in `shared/src/i18n/locales/*` (existing files, existing keys where possible). No new shared exports expected; if a new i18n key is added it goes through `UIText` + all 10 locales. Mobile consumes the same locale files — string-value changes are type-safe (values, not shape) except any NEW keys, which must be added to `UIText` and all locales, keeping mobile compiling. ✅
- **II. Security at the Boundary**: no API/input changes; no new external origins beyond the already-allowed Google Fonts; no `innerHTML`/`eval`. ✅
- **III. Behavior Coverage**: existing tests updated (BrandMark label, app_title assertions, hero copy); new tests for `Wordmark` and updated snapshot-ish assertions. Visual acceptance is manual against the brand guide (documented in quickstart.md). ✅
- **IV. No Speculative Code**: `Wordmark` has 3 real call sites (sidebar, hero topbar, hero footer attribution). No theming abstraction beyond the existing CSS-variable mechanism. ✅
- **V. Accessibility & i18n**: all copy changes flow through `useLocale()`; the wordmark renders as text (`datum.`) so no aria gymnastics; BrandMark keeps an aria-label sourced from i18n; contrast on the derived light palette checked (hence `#0d9488`). ✅

## Project Structure

### Documentation (this feature)

```text
specs/020-datum-rebrand/
├── spec.md
├── plan.md              # This file
├── research.md          # Phase 0 — decisions & token mapping
├── data-model.md        # Phase 1 — N/A statement (no entities)
├── quickstart.md        # Phase 1 — how to verify the rebrand locally
├── assets/              # Authoritative brand delivery (committed)
└── tasks.md             # Phase 2 (/speckit-tasks)
```

### Source Code (repository root)

```text
web/
├── index.html                     # title, font link (+Space Grotesk), favicon links, splash bg colors, manifest link
├── package.json                   # name → "datum-app"
├── public/
│   ├── favicon.svg                # REPLACED with datum-favicon.svg content
│   ├── datum-icon.svg             # NEW (master, for manifest/512/192 source)
│   ├── icons/*.png                # NEW rasterized: favicon-16/32, apple-touch-icon-180, icon-192, icon-512
│   ├── manifest.json              # NEW: Datum install metadata
│   └── {next,vercel,file,globe,window}.svg   # DELETED (dead Next-era assets, verified unreferenced)
├── src/
│   ├── app/globals.css            # token values → Datum palette (dark + derived light), --font-display, tabular-nums, datum dot, wordmark styles
│   ├── components/
│   │   ├── Wordmark.tsx           # NEW: datum. wordmark primitive (+ test)
│   │   └── Sidebar.tsx            # brand block → Datum mark + Wordmark; active-item orange dot
│   ├── auth/
│   │   ├── BrandMark.tsx          # body replaced: Datum mark SVG (no gradient), i18n aria-label
│   │   └── screens/HeroPage.tsx   # new copy via i18n, remove .auth-grad gradient text, footer attribution
│   └── ...                        # KPI/table/drawer surfaces: CSS-only via globals.css
shared/src/i18n/
├── types.ts                       # only if a new key is needed (hero_footer_attribution etc.)
└── locales/*.ts                   # 10 files: app_title → Datum naming, hero copy → brand copy
```

**Structure Decision**: All restyling flows through `web/src/app/globals.css` token values so component churn is minimal; components change only where markup must change (brand block, wordmark, hero copy, footer). `shared/` is touched only for i18n strings, keeping the mobile type contract intact.

## Design decisions (Phase 1 digest — full detail in research.md)

1. **Token strategy**: keep both existing families (`--bg*`/`--text*` legacy and `--s-*` surface) and re-value them to the Datum palette rather than renaming tokens — renaming would churn every stylesheet consumer for zero user value. Add only: `--s-accent-strong` (#14b8a6 hover), `--brand-orange` (#f97316, replacing `--brand-a`'s role), `--font-display`.
2. **Dark mapping** (values from the brand spec): page `#101013`, surface `#17171a`, elevated `#1d1d20` (unchanged, locked), hover `#232328`, borders `#26262b`/`#323238`, text `#f4f4f5`/`#a1a1aa`/`#71717a`. Gain/loss dark values are ALREADY byte-identical to the Datum spec (`#34d399`/`#f87171`) — untouched.
3. **Light derivation** (our design, per clarification): keep the current light neutral scale structure, swap accent `#14b8a6` → `#0d9488` (AA on white), orange stays `#f97316`, gain/loss light values untouched.
4. **Coin colors are not brand colors**: `#f7931a` as Bitcoin's badge color stays; only brand-accent uses of orange are re-mapped.
5. **Fonts**: extend the existing Google Fonts `<link>` with Space Grotesk 400/500/700; `--font-display` applied to h1–h3, KPI values, numeric table cells, wordmark; `font-variant-numeric: tabular-nums` on tables/KPIs.
6. **Icons**: `favicon.svg` gets the small-optimized variant; PNGs rasterized once via `npx @resvg/resvg-cli` (or sharp-cli) from the SVGs — generated files committed, no new dependency.
7. **Copy**: reuse existing i18n keys (`app_title`, `hero_title_line1/2`, `hero_subtitle`); brand copy per the delivery in pt-BR, translated for the other 9 locales; wordmark string itself is hardcoded `datum.` (locale-invariant by spec).
8. **No contracts/**: UI-only feature; no external interface changes (documented here in lieu of a contracts folder).

## Complexity Tracking

No constitution violations. No new dependencies, no new abstractions beyond the 3-call-site `Wordmark`.
