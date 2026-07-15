# Feature Specification: Datum Rebrand

**Feature Branch**: `020-datum-rebrand`

**Created**: 2026-07-15

**Status**: Draft

**Input**: User description: "Rebrand the app to 'Datum' (product) under 'Buma Labs' (company). This is a reskin + rename, NOT a behavior redesign: new design tokens (bg/teal/orange/text palette), Space Grotesk + Inter typography, new app icon/favicon/wordmark, renamed user-facing strings/titles/manifest, and per-surface restyle of AuthShell/landing hero, sidebar, Carteira, drawer. The user supplied a complete implementation spec and brand assets."

**Authoritative references** (in `specs/020-datum-rebrand/assets/`, copied verbatim from the user's brand delivery):

- `datum-rebrand-spec.md` — the implementation spec: naming, design tokens, typography, brand assets, Wordmark component, per-surface restyle, out-of-scope list, acceptance checklist. Where this document and that one appear to conflict, `datum-rebrand-spec.md` wins.
- `datum-brand-guide.html` — visual brand guide (open in a browser): symbol, color, typography, component kit, entry + wallet screen mockups.
- `datum-icon.svg` — master 512px app icon (dark tile, teal D stroke, orange dot).
- `datum-favicon.svg` — small-size-optimized favicon variant (use this for ≤32px, not the master icon).
- `datum-symbol-light.svg` — tile-less symbol for light backgrounds; not used in-app.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - The product is called Datum everywhere (Priority: P1)

A user opening the app — browser tab, landing page, login flow, sidebar, PWA install prompt — sees the product presented as "Datum" with its new mark (teal D with orange datum point) and wordmark (`datum.` with orange period). No trace of the old "crypto-assist" identity remains anywhere user-facing.

**Why this priority**: The rename is the point of the feature. A half-renamed product (old title in the tab, new name in the sidebar) reads as broken and erodes trust more than no rebrand at all.

**Independent Test**: Load every route of the app and inspect the browser tab title, favicon, landing hero, auth screens, sidebar brand block, and footer attribution. Search the running UI for "crypto-assist" / "Crypto Assist" — zero user-facing occurrences.

**Acceptance Scenarios**:

1. **Given** any page of the app, **When** the user looks at the browser tab, **Then** the title reads "Datum — Sua carteira, consolidada" (or a sensible per-route variant) and the tab icon is the new Datum favicon, crisp at 16px.
2. **Given** the landing/auth entry page, **When** it renders, **Then** the Datum mark and the hero copy "Você está aqui." (with "aqui" in orange) and the new subcopy appear, replacing the old generic hero.
3. **Given** the authenticated app shell, **When** the sidebar renders, **Then** the brand block shows the 26px Datum icon plus the `datum.` wordmark with orange period.
4. **Given** any user-facing surface (titles, manifest, attribution), **When** searched, **Then** "crypto-assist" does not appear; attribution where present reads "datum. · um produto Buma Labs".

---

### User Story 2 - The app wears the Datum visual identity (Priority: P2)

A user navigating the app experiences the new Datum look: near-black layered surfaces, teal as the single action/structure color, orange reserved exclusively for the "datum point" motif, Space Grotesk on titles and numbers, Inter on body and controls — consistently across the landing hero, auth flow, sidebar, Carteira (all three grouping modes), and the operation drawer.

**Why this priority**: The token + typography swap is what makes the rename feel like a real brand and not a find-and-replace. It depends on nothing but can ship meaningfully only alongside Story 1.

**Independent Test**: Visually compare each restyled surface against `datum-brand-guide.html` and the token table in `datum-rebrand-spec.md`; verify computed CSS variables match the specified hex values and fonts resolve to Space Grotesk / Inter.

**Acceptance Scenarios**:

1. **Given** the app in its default (dark) appearance, **When** any surface renders, **Then** page background, cards, elevated inputs, and borders use the new token values (`#101013` / `#17171a` / `#1d1d20` / `#232328`, borders `#26262b`/`#323238`) and elevated inputs remain `#1d1d20`.
2. **Given** any primary action (buttons, active nav, focus, links), **When** rendered, **Then** it uses teal (`#2dd4bf`, hover `#14b8a6`) — never orange.
3. **Given** KPI cards and table numeric cells, **When** rendered, **Then** numbers are set in Space Grotesk with tabular numerals; body/labels/inputs use Inter.
4. **Given** gain/loss values anywhere in the app, **When** rendered, **Then** their colors are byte-identical to the specified gain/loss values (`#34d399` / `#f87171` and their dim variants) and are never teal or orange.
5. **Given** the sidebar, **When** a nav item is active, **Then** it shows the teal pill + teal edge bar and a 7px orange dot before the label (the datum point motif), preserving the existing sliding-pill mechanic.
6. **Given** the operation drawer, **When** rendered, **Then** all locked decisions are preserved (elevated inputs, dark dropdown scrollbar, `atual`/`manual` badge now in teal-dim/teal, spinner→check submit with check in teal).

---

### User Story 3 - Brand assets are installed and correct (Priority: P3)

The Datum icon set replaces the old favicon/PWA assets: SVG favicon for the tab, rasterized PNG sizes where required, updated app manifest metadata, and the boot splash recolored to the new identity.

**Why this priority**: Asset plumbing is invisible when right but obvious when wrong (blurry favicon, stale manifest name in install prompts). It finishes the rebrand rather than defining it.

**Independent Test**: Inspect the favicon at 16px in a real browser tab, trigger the PWA install metadata, and cold-load the app to see the splash with the Datum mark and teal loader dots.

**Acceptance Scenarios**:

1. **Given** a browser tab, **When** the favicon renders at 16px, **Then** it is the small-size-optimized `datum-favicon.svg` variant, visibly crisp (not the master icon scaled down).
2. **Given** the app's install/branding metadata, **When** read, **Then** name and short name are "Datum", background color `#101013`, theme color `#17171a`.
3. **Given** a cold app load (slow boot / Aurora warming), **When** the splash shows, **Then** it centers the Datum mark at 64px on the page background and the existing logo-pulse + three blinking dots loader remains, dots recolored to teal.

---

### Edge Cases

- **Light theme**: the user-facing theme setting offers Claro / Escuro / Sistema, but the Datum brand guide defines only a dark palette. The rebrand must decide what "Claro" means post-rebrand (see Clarifications/Assumptions) rather than leaving a half-branded light mode.
- **Non-Portuguese locales**: the hero/headline copy is specified in PT-BR, but the UI ships in 10 locales. All new/changed brand copy must flow through the i18n layer with translations for every locale; the wordmark `datum.` itself is never translated.
- **Orange leakage**: orange is reserved for the datum point motif (wordmark period, sidebar active dot, hero "aqui", specified orange-dim badges). Any pre-existing orange usage outside that list must be re-mapped to teal or a neutral.
- **Old-asset stragglers**: cached favicons, unused template SVGs in the public folder, and OAuth-flow interstitials must not surface the old identity.
- **Small-size icon fidelity**: rasterized PNGs must be generated from the SVGs by a renderer, not screenshots, so edges stay crisp.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: All user-facing occurrences of "crypto-assist" / "Crypto Assist" MUST be replaced with "Datum" (prose) or the `datum.` wordmark (brand contexts); the document title MUST read "Datum — Sua carteira, consolidada" (per-route variants allowed).
- **FR-002**: The global design token layer MUST adopt the exact palette, typography, and radii values defined in `datum-rebrand-spec.md` §2, including the locked elevated-input value `#1d1d20`.
- **FR-003**: Color usage MUST follow the brand rules: teal for structure/action, orange only for the datum-point motif, green/red exclusively for gain/loss, no gradients anywhere in the new identity.
- **FR-004**: Space Grotesk (400/500/700) and Inter (400/500/600) MUST be loaded and applied per role — display font on wordmark, titles h1–h3, KPI numbers, numeric table cells and numeric badges (with tabular numerals); UI font everywhere else.
- **FR-005**: A reusable Wordmark primitive MUST render `datum` in the display font with the trailing orange period, sized via a prop, and be used in the sidebar brand, auth hero, and footer attribution; the period is never omitted in brand contexts.
- **FR-006**: The new icon set MUST replace the old favicon and app-install assets: SVG favicon (small-size variant), rasterized PNG sizes (32/16, touch icon 180, install icons 512/192) generated from the SVGs, and install metadata renamed with the specified background/theme colors.
- **FR-007**: The boot splash MUST center the Datum mark at 64px on the page background, keeping the existing pulse + three-dots loader with dots recolored to teal.
- **FR-008**: The landing hero MUST carry the new brand copy ("Você está aqui." with orange "aqui", plus the specified subcopy), the teal primary CTA with dark-teal text, ghost secondary, and all auth-flow states (OAuth loading, warming, error) MUST keep their existing behavior recolored to the new tokens.
- **FR-009**: The sidebar MUST show the brand block (26px icon + wordmark), the active-item treatment (teal pill, teal edge bar, orange datum dot), and keep the existing sliding-pill and refresh-spin→success mechanics with the success check in teal.
- **FR-010**: Carteira (all three grouping modes) MUST restyle KPI cards and tables per the guide — display-font values, 11px uppercase muted table headers, numeric columns in the display font — while platform chips stay rounded-square and coin avatars stay circular.
- **FR-011**: The operation drawer MUST keep every locked interaction decision, recolored: `atual` badge in teal-dim/teal, submit check in teal, elevated inputs unchanged at `#1d1d20`.
- **FR-012**: All new or changed user-visible copy MUST go through the i18n layer with entries for all 10 supported locales; the wordmark itself is locale-invariant.
- **FR-013**: Lucro and Histórico views MUST receive the token/typography pass only — no layout changes.
- **FR-014**: Existing UX flows, routes, state, APIs, and locked component behaviors MUST remain unchanged; this feature is a reskin + rename only.

### Out of Scope (per `datum-rebrand-spec.md` §7)

- No route, state, or API changes.
- No Cognito/infra domain changes (the future `datum.bumalabs.net` domain is a separate infra task; no env values change in this pass).
- No layout redesign of Lucro and Histórico beyond tokens/typography.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A search of every user-facing surface (rendered UI, tab titles, install metadata) finds zero occurrences of the old product name.
- **SC-002**: 100% of the acceptance checklist in `datum-rebrand-spec.md` §8 passes on a dev deployment.
- **SC-003**: The favicon is legible and crisp at 16px in a real browser tab, verified against the small-size SVG variant.
- **SC-004**: Gain/loss colors in tables and KPIs are byte-identical to their pre-rebrand values (no perceptual drift for the app's most safety-critical color signal).
- **SC-005**: Orange appears in exactly the enumerated datum-point contexts and nowhere else, verified by visual sweep of all routes.
- **SC-006**: All existing automated tests still pass, and no user flow (login, register operation, wallet browsing, settings) changes in behavior — only in appearance.

## Assumptions

- The brand delivery defines a dark identity only; the in-app "Claro" theme option's post-rebrand treatment needs a product decision (kept-and-adapted vs. removed) — to be settled in clarification before planning.
- The mobile app (Expo) is assumed out of scope for this pass — the brand spec's surfaces (tab title, favicon, manifest, sidebar, drawer) are web-only; mobile rebrand would be a follow-up item. Shared-code changes must still not break the mobile build (constitution I).
- Hero and brand copy are authored in PT-BR; translations for the other 9 locales will be produced as part of this feature using accurate financial-product tone, since all UI strings flow through the i18n layer.
- `package.json` name changes to `datum-app` are internal-only and carry no user impact or deploy risk.
- No `manifest.json` / PWA manifest may currently exist; if absent, creating one with the specified Datum metadata satisfies the manifest requirement (the requirement is about install/branding metadata, not about preserving a specific file).
- Google Fonts is an acceptable font delivery mechanism for this pass (self-hosting is explicitly deferred by the brand spec).
