# Implementation Plan: Multi-Language Support (i18n)

**Branch**: `004-i18n-multilang` | **Date**: 2026-06-27 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/004-i18n-multilang/spec.md`

## Summary

Add full multi-language support across web and mobile. Every user-facing string is extracted into a typed `UIText` interface in `shared/`. Ten locale files (pt-BR through ru-RU) are bundled at build time. A `LocaleContext` on each platform exposes the active translations and a `setLocale` function. A Settings page (web) and Settings screen (mobile) give users the language selector. `Op.type` is migrated from `'Compra'|'Venda'` to `'Buy'|'Sell'` in shared types, backend models, and the database.

## Technical Context

**Language/Version**: TypeScript 5.x (shared/web), Python 3.11 (backend), React Native / Expo SDK 54 (mobile)

**Primary Dependencies**:
- `shared/`: no new dependencies — pure TypeScript with `Intl.NumberFormat` / `Intl.DateTimeFormat`
- `web/`: React context (built-in), `@tanstack/react-router` for `/settings` route — no new npm packages
- `mobile/`: `@react-native-async-storage/async-storage` (already used via Expo), `react-native` `I18nManager` for RTL — no new packages
- `backend/`: no new dependencies — update Pydantic model and add a migration SQL file

**Storage**: PostgreSQL (Aurora) for `ops.type` migration; localStorage (web) and AsyncStorage (mobile) for locale preference

**Testing**: Vitest + Testing Library (web), pytest (backend)

**Target Platform**: Vite + React 19 (web), Expo SDK 54 + React Native (mobile), AWS Lambda Python 3.11 (backend)

**Project Type**: Monorepo — shared library + web app + mobile app + backend API

**Performance Goals**: Language switch instant (all locales bundled, zero network request)

**Constraints**: No new npm or pip packages; all 10 locale files bundled; `shared/` must remain build-step-free (pure TypeScript, no bundler)

**Scale/Scope**: ~150 UIText keys, 10 locale files, 4 screens on mobile, 3 tab components + 1 dashboard + 1 settings page on web

## Constitution Check

| Principle | Status | Notes |
|---|---|---|
| I. Shared-First Architecture | ✅ PASS | `Locale`, `UIText`, `LOCALES`, `getLocale` all live in `shared/src/i18n/` |
| II. Security at the Boundary | ✅ PASS | No new API surface; locale stored client-side only |
| III. Behavior Coverage | ✅ PASS | Happy path + locale fallback + RTL + Op.type tests required |
| IV. No Speculative Code | ✅ PASS | Exactly 10 locales specified; no lazy-loader, no plugin system |
| V. Accessibility & i18n | ✅ PASS | This item directly fulfils the i18n half of Principle V |

**Gate result**: PASS — proceed to Phase 0.

## Project Structure

### Documentation (this feature)

```text
specs/004-i18n-multilang/
├── plan.md              ← this file
├── research.md          ← Phase 0 output
├── data-model.md        ← Phase 1 output
└── tasks.md             ← /speckit-tasks output
```

### Source Code

```text
shared/src/
├── i18n/
│   ├── types.ts         ← Locale union + UIText interface (new)
│   ├── index.ts         ← re-exports Locale, UIText, LOCALES, getLocale (new)
│   └── locales/
│       ├── pt-BR.ts     ← reference locale (new)
│       ├── en-US.ts     (new)
│       ├── es-ES.ts     (new)
│       ├── fr-FR.ts     (new)
│       ├── de-DE.ts     (new)
│       ├── zh-CN.ts     (new)
│       ├── ja-JP.ts     (new)
│       ├── ar-SA.ts     (new)
│       ├── hi-IN.ts     (new)
│       └── ru-RU.ts     (new)
├── format.ts            ← add locale + currency params (modify)
├── types.ts             ← Op.type 'Compra'|'Venda' → 'Buy'|'Sell' (modify)
└── index.ts             ← export all i18n symbols (modify)

web/src/
├── context/
│   └── LocaleContext.tsx   ← React context + useLocale() (new)
├── pages/
│   └── settings.tsx        ← Settings page with language selector (new)
├── app/dashboard/
│   └── page.tsx            ← replace hardcoded strings, add Settings link (modify)
├── components/
│   ├── WalletTab.tsx       ← replace hardcoded strings (modify)
│   ├── ProfitTab.tsx       ← replace hardcoded strings (modify)
│   └── HistoryTab.tsx      ← replace hardcoded strings, fix 'Compra'/'Venda' refs (modify)
├── router.tsx              ← add /settings route (modify)
└── main.tsx                ← wrap app in LocaleProvider (modify)

mobile/
├── src/
│   └── context/
│       └── LocaleContext.tsx  ← React Native context + useLocale() (new)
├── app/
│   ├── (tabs)/
│   │   ├── _layout.tsx     ← use t.tabs.* for tab labels (modify)
│   │   ├── wallet.tsx      ← replace hardcoded strings (modify)
│   │   ├── profit.tsx      ← replace hardcoded strings (modify)
│   │   └── history.tsx     ← replace hardcoded strings (modify)
│   └── _layout.tsx         ← wrap in LocaleProvider, handle RTL (modify)
└── app/(settings)/
    └── settings.tsx        ← Settings screen with language picker (new)

backend/
├── app/
│   └── models.py           ← Op.type Literal['Compra','Venda'] → Literal['Buy','Sell'] (modify)
└── db/
    ├── schema.sql          ← update CHECK constraint (modify)
    └── migrations/
        └── 004_op_type_english.sql  ← UPDATE ops SET type (new — requires user approval)
```

## Complexity Tracking

No constitution violations. No complexity justification required.
