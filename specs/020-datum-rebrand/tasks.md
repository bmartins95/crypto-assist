# Tasks: Datum Rebrand

**Input**: Design documents from `specs/020-datum-rebrand/` (spec.md, plan.md, research.md, quickstart.md; brand delivery in `assets/`)

**Tests**: Included — constitution III requires behavior tests for user-facing changes; visual acceptance is manual per quickstart.md.

**Organization**: Tasks grouped by user story. US1 = rename, US2 = visual identity, US3 = brand assets.

## Phase 1: Setup

- [ ] T001 Add Space Grotesk 400/500/700 to the existing Google Fonts `<link>` in `web/index.html` (keep Inter weights and preconnects unchanged)

## Phase 2: Foundational (blocks US2; US1 partially depends via new tokens)

- [ ] T002 Re-value dark tokens in `web/src/app/globals.css` per research.md R2 mapping (both the `prefers-color-scheme` block and `html[data-theme="dark"]` block): page `#101013`, surface `#17171a`, hover `#232328`, borders `#26262b`/`#323238`, text `#f4f4f5`/`#a1a1aa`/`#71717a`; add `--s-accent-strong: #14b8a6`, `--brand-orange: #f97316`, `--font-display: 'Space Grotesk', sans-serif`; keep `--s-surface-2: #1d1d20` and gain/loss values byte-identical
- [ ] T003 Re-value light tokens in `web/src/app/globals.css` per research.md R3 (accent `#0d9488`, accent-dim `rgba(13,148,136,.12)`, neutrals per mapping; gain/loss light values unchanged); update `web/index.html` pre-paint script backgrounds to `#101013` (dark) / `#f4f4f5` (light)
- [ ] T004 Audit every `--brand-a` / brand-orange usage in `web/src` and re-map to `--brand-orange` or teal per the color rules (coin-badge literals like Bitcoin `#f7931a` stay); delete the `--brand-a` token

## Phase 3: User Story 1 — The product is called Datum everywhere (P1) 🎯 MVP

**Goal**: No user-facing trace of the old identity; Datum name, mark, and wordmark everywhere.

**Independent test**: quickstart.md steps 1–2 + old-identity grep audit (step 9).

- [ ] T005 [P] [US1] Create `web/src/components/Wordmark.tsx` (`datum` + orange period, `size` prop, `.wordmark`/`.wm-dot` classes in globals.css) with test `web/src/components/Wordmark.test.tsx`
- [ ] T006 [P] [US1] Replace `web/src/auth/BrandMark.tsx` body with the Datum tile mark from `specs/020-datum-rebrand/assets/datum-icon.svg` (no gradient defs), aria-label "Datum"
- [ ] T007 [US1] Update brand strings in all 10 `shared/src/i18n/locales/*.ts`: `app_title: 'Datum'`; hero copy per research.md R6 (`hero_title_line1`/`hero_title_line2`/`hero_subtitle` — pt-BR from the delivery, translated for the other 9); add `hero_footer_attribution` key to `shared/src/i18n/types.ts` and every locale
- [ ] T008 [US1] Update `web/src/auth/screens/HeroPage.tsx`: orange emphasis span (class, no gradient — replace/retire `.auth-grad` usage here) on `hero_title_line2`, footer attribution row (`<Wordmark>` + `hero_footer_attribution`), topbar uses `<Wordmark>` next to BrandMark
- [ ] T009 [US1] Update `web/src/components/Sidebar.tsx` brand block: replace `₿` glyph with the Datum mark (BrandMark at 26px or inline SVG) + `<Wordmark size={17}>`; keep collapse behavior
- [ ] T010 [US1] Set `<title>Datum — Sua carteira, consolidada</title>` in `web/index.html`; rename `web/package.json` name to `datum-app`
- [ ] T011 [US1] Update tests asserting old identity: `web/src/auth/screens/HeroPage.test.tsx`, `web/src/components/AppLayout.test.tsx` (sidebar brand), `web/src/lib/i18n.test.ts`, any test matching "Carteira de Criptoativos"

**Checkpoint**: App renders fully as Datum; `npm test` green.

## Phase 4: User Story 2 — Datum visual identity (P2)

**Goal**: Tokens + typography + per-surface restyle per the brand guide, both themes.

**Independent test**: quickstart.md steps 2–8 against `assets/datum-brand-guide.html`.

- [ ] T012 [P] [US2] Typography pass in `web/src/app/globals.css`: `--font-display` on h1–h3, KPI/metric values, numeric table cells, wordmark; `font-variant-numeric: tabular-nums` on `.tbl` and metric cards; body stays Inter
- [ ] T013 [P] [US2] Sidebar active-item treatment in `web/src/app/globals.css` (+ `web/src/components/Sidebar.tsx` if markup needed): teal pill bg `--s-accent-dim`, teal text, 3px edge bar, 7px `--brand-orange` datum dot before active label; refresh success check teal
- [ ] T014 [P] [US2] Hero/auth restyle in `web/src/app/globals.css`: primary CTA teal bg with `#062a26` text, ghost secondary, remove `.auth-grad` gradient rule (no gradients anywhere), loading dots teal
- [ ] T015 [US2] Carteira/drawer surface audit: KPI cards, table headers (11px uppercase muted), `atual`/`manual` badge to teal-dim/teal, submit check teal — adjust `web/src/app/globals.css` (and `web/src/components/OpDrawer.tsx` only if a class must change); platform chips stay rounded-square, coins circular
- [ ] T016 [US2] Verify both themes against the color rules (orange only in datum-point contexts; gain/loss untouched); fix any leakage found; update component tests touched by class changes

**Checkpoint**: Visual sweep passes in dark and light; `npm test` green.

## Phase 5: User Story 3 — Brand assets installed (P3)

**Goal**: Favicon/manifest/touch icons/splash all Datum.

**Independent test**: quickstart.md steps 1 and 3; 16px favicon crispness; manifest metadata.

- [ ] T017 [P] [US3] Replace `web/public/favicon.svg` with `specs/020-datum-rebrand/assets/datum-favicon.svg` content; copy `datum-icon.svg` to `web/public/datum-icon.svg`
- [ ] T018 [US3] Rasterize PNGs per research.md R4 into `web/public/icons/` (favicon-16, favicon-32, apple-touch-icon 180, icon-192, icon-512) via throwaway `npx` resvg/sharp run; commit binaries; no package.json changes
- [ ] T019 [US3] Create `web/public/manifest.json` (name/short_name "Datum", background `#101013`, theme `#17171a`, icons 192/512) and link it + apple-touch-icon + PNG favicons in `web/index.html`
- [ ] T020 [US3] Delete dead Next-era assets `web/public/{next,vercel,file,globe,window}.svg` after grep-verifying zero references

**Checkpoint**: Install metadata + tab identity fully Datum.

## Phase 6: Polish & verification

- [ ] T021 Old-identity + orange audits per quickstart.md steps 8–9; fix stragglers
- [ ] T022 Run `cd web && npm test && npm run coverage` (paste summary in PR), `cd backend && pytest` (must stay green), and mobile typecheck (`cd mobile && npx tsc --noEmit`) to confirm the shared i18n change keeps the mobile contract intact
- [ ] T023 Manual visual sweep per quickstart.md with the dev server, dark + light, all routes

## Dependencies & execution order

- Phase 1 → Phase 2 → (US1, US2 can interleave; US1 is the MVP slice) → US3 anytime after Phase 1 → Polish last.
- US1 depends on Phase 2 only for `--brand-orange` (T005's dot color). US2 depends fully on Phase 2. US3 is independent of Phases 2–4.
- Parallel opportunities: T005/T006 [P]; T012/T013/T014 [P]; T017 [P] alongside Phase 4.

## Implementation strategy

MVP = Phases 1–3 (US1): the app *is* Datum. Then US2 makes it *look* Datum, US3 finishes the asset plumbing, Polish verifies. Single PR (constitution: one thing = "the rebrand"), sequential commits per phase.
