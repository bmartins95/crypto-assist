# Platform field — design implementation plan

Refactors `plataforma` from a free-text string into a first-class entity with a **logo, name and category**, and turns the platform input into a searchable combobox mirroring the existing coin selector. Pixel truth: `platform-field-redesign.html`.

Scope of this doc: **design/frontend layer** — the primitives (`PlatformLogo`, `PlatformChip`, `PlatformSelect`) and how they land in each of the four affected screens. The catalog/backend contract is stated as an interface so the UI can be built against it.

Tokens as usual: `--surface #161618` · `--surface-2 #1d1d20` · `--surface-hover #222226` · `--border #27272a` · `--border-soft #1f1f22` · `--text #fafafa` · `--dim #71717a` · `--accent #2dd4bf`.

---

## 0. The data shape the UI needs

Three sources feed one catalog (this is the key constraint: **CoinGecko only lists exchanges** — MetaMask, Phantom and Kamino are wallets/DeFi and do not exist there):

| kind | source | logo |
|---|---|---|
| `exchange` | CoinGecko `/exchanges` (name + image) | remote, cached by us |
| `wallet` / `defi` | curated seed list in-repo | shipped asset |
| `custom` | user-typed, not in catalog | generated initials avatar |

```ts
type PlatformKind = 'exchange' | 'wallet' | 'defi' | 'custom';

type Platform = {
  id: string;            // 'metamask' | 'binance' | 'custom:sodex'
  name: string;          // 'MetaMask'
  kind: PlatformKind;
  subtitle?: string;     // 'Carteira · Solana' — shown in the dropdown only
  logoUrl?: string;      // absent for custom — fall back to initials avatar
};
```

The operation record stores `platformId` (+ a denormalized `platformName` so history survives a catalog change). **Do not render straight from CoinGecko's image URL** — proxy/cache it, or the list breaks when they rotate URLs.

---

## 1. `PlatformLogo` — the atom

Renders the logo, or a deterministic initials avatar when there's no image (custom platforms, or a failed image load).

```tsx
type Size = 'sm' | 'md';   // sm = 22px (tables), md = 26px (group headers, "Por plataforma")

function PlatformLogo({ platform, size = 'sm' }: { platform: Platform; size?: Size }) {
  const [failed, setFailed] = useState(false);
  const showImg = platform.logoUrl && !failed;
  return (
    <span className={`plogo plogo-${size}`}
          style={showImg ? undefined : { background: hashColor(platform.name) }}>
      {showImg
        ? <img src={platform.logoUrl} alt="" onError={() => setFailed(true)} />
        : initials(platform.name)}
    </span>
  );
}
```

```ts
// same name — same color, always. Hues picked from the app palette, not random.
const HUES = [210, 265, 175, 32, 340, 145];
function hashColor(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return `hsl(${HUES[Math.abs(h) % HUES.length]} 55% 45%)`;
}
function initials(name: string) {
  const p = name.trim().split(/\s+/);
  return (p.length > 1 ? p[0][0] + p[1][0] : name.slice(0, 2)).replace(/[^\w]/g, '').toUpperCase();
}
```

```css
.plogo{ display:flex; align-items:center; justify-content:center; flex-shrink:0;
  overflow:hidden; color:#fff; font-weight:700; background:var(--surface-2); }
.plogo img{ width:100%; height:100%; object-fit:cover; display:block; }
.plogo-sm{ width:22px; height:22px; border-radius:6px; font-size:9.5px; }
.plogo-md{ width:26px; height:26px; border-radius:7px; font-size:10.5px; }
```
Rounded square (not a circle) — deliberately distinct from the **coin** logos, which are circles. At a glance you can tell "asset" from "platform."

## 2. `PlatformChip` — logo + name, used in every table

```tsx
function PlatformChip({ platform, size = 'sm', bold = false, showCustomTag = false }) {
  return (
    <span className="plat">
      <PlatformLogo platform={platform} size={size} />
      <span className="pn" style={bold ? { fontWeight: 600 } : undefined}>{platform.name}</span>
      {showCustomTag && platform.kind === 'custom' && <span className="cat custom">personalizada</span>}
    </span>
  );
}
```
```css
.plat{ display:inline-flex; align-items:center; gap:8px; min-width:0; }
.plat .pn{ font-size:13.5px; font-weight:500; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
```

## 3. Category badge

```css
.cat{ font-size:10px; font-weight:600; padding:2px 6px; border-radius:5px; flex-shrink:0; }
.cat.exchange{ background:rgba(45,212,191,.10); color:var(--accent); }     /* Corretora */
.cat.wallet  { background:rgba(247,147,26,.12); color:#f7931a; }           /* Carteira  */
.cat.defi    { background:rgba(153,69,255,.14); color:#b78bff; }           /* DeFi      */
.cat.custom  { background:#26262a;               color:var(--dim); }       /* personalizada */
```
Labels (i18n): `Corretora` · `Carteira` · `DeFi` · `personalizada`.

---

## 4. `PlatformSelect` — the combobox

Mirrors the existing coin selector: same input styling, same elevated surface, same dark scrollbar, same keyboard behavior. Differences: results are **grouped by category**, and there's a **custom fallback row**.

```tsx
type Props = {
  value: Platform | null;
  onChange: (p: Platform) => void;
  catalog: Platform[];          // fetched once, cached
};
```

Behavior:
- **Focus** — open dropdown with the full catalog (grouped). If the user has recent platforms, show a `Recentes` group first — cheap win, since most people reuse 3–4.
- **Type** — filter by name (case-insensitive, substring).
- **No exact match** — append the custom row at the bottom: `+  Usar "<texto>" como personalizada`. Selecting it creates `{ id: 'custom:<slug>', name: <texto>, kind: 'custom' }`.
- **Select** — input shows the platform name with its **logo inline on the left** (input gets `padding-left:40px`, logo absolutely positioned) — this is what makes it feel like the coin field.
- **Keyboard** — ↑/↓ move highlight, Enter selects, Esc closes. The custom row is part of the arrow-key cycle.
- **Click outside** — close.

```css
.dd{ position:absolute; top:calc(100% + 6px); left:0; right:0; z-index:20;
  background:var(--surface); border:1px solid var(--border); border-radius:10px;
  max-height:290px; overflow-y:auto; box-shadow:0 14px 34px rgba(0,0,0,.55); }
/* dark scrollbar — same as the coin dropdown */
.dd{ scrollbar-width:thin; scrollbar-color:var(--border) var(--surface); }
.dd::-webkit-scrollbar{ width:10px; }
.dd::-webkit-scrollbar-track{ background:var(--surface); }
.dd::-webkit-scrollbar-thumb{ background:var(--border); border-radius:6px; border:2px solid var(--surface); }

.dd-grp{ position:sticky; top:0; background:var(--surface);
  font-size:10px; font-weight:600; letter-spacing:.06em; text-transform:uppercase;
  color:var(--dim); padding:9px 13px 5px; }
.dd-item{ display:flex; align-items:center; gap:10px; padding:9px 13px; cursor:pointer;
  border-bottom:1px solid var(--border-soft); }
.dd-item:hover, .dd-item[aria-selected="true"]{ background:var(--surface-hover); }
.dd-item .n{ font-size:13px; font-weight:600; }
.dd-item .s{ font-size:11px; color:var(--dim); margin-top:1px; }

.dd-custom{ display:flex; align-items:center; gap:10px; padding:11px 13px; cursor:pointer;
  border-top:1px solid var(--border); background:var(--surface-2); }
.dd-custom:hover{ background:var(--surface-hover); }
.plus{ width:22px; height:22px; border-radius:6px; border:1px dashed var(--border);
  display:flex; align-items:center; justify-content:center; color:var(--dim); flex-shrink:0; }

.sel-logo{ position:absolute; left:10px; top:30px; z-index:2; }   /* logo inside the input */
.inp.withlogo{ padding-left:40px; }
```

Accessibility: `role="combobox"` + `aria-expanded` on the input, `role="listbox"` on `.dd`, `role="option"` + `aria-selected` on items.

---

## 5. Landing it in each screen

### 5.1 Drawer — "Registrar operação"
Replace the free-text `Plataforma` input with `<PlatformSelect>`. Everything else in the drawer stays.
- Applies to all three tipos (Compra / Venda / Trade).
- Keep the field in its current grid slot next to `Data`.
- Empty state placeholder: `Busque: Binance, MetaMask, Kamino…`.

### 5.2 Histórico — `Plataforma` column
Replace the plain text cell with `<PlatformChip platform={op.platform} showCustomTag />`.
- Column stays left-aligned.
- The `personalizada` tag only renders for `kind === 'custom'` — it signals "this one isn't from the catalog" without shouting.

### 5.3 Carteira — "Por plataforma"
First column becomes `<PlatformChip platform={p} size="md" bold />`. The logo is the row's visual anchor.

### 5.4 Carteira — "Ativo + plataforma" (group headers)
Replace the generic lock icon with the real logo, and enrich the header:

```tsx
<div className="grp-hd">
  <PlatformLogo platform={p} size="md" />
  <span className="gname">{p.name}</span>
  <span className={`cat ${p.kind}`}>{catLabel(p.kind)}</span>
  <span className="gsum">{fmt(group.value)} · <Delta value={group.returnPct} /></span>
</div>
```
```css
.grp-hd{ display:flex; align-items:center; gap:10px; margin:22px 0 9px; }
.grp-hd .gname{ font-size:13.5px; font-weight:600; }
.grp-hd .gsum{ margin-left:auto; font-size:12px; color:var(--dim); font-variant-numeric:tabular-nums; }
```
The **group total pushed to the right of the header** is new — today the user has to sum the sub-table mentally.

---

## 6. Files

**Create** (`web/src/components/platform/`):
- `PlatformLogo.tsx` (+ `hashColor` / `initials` helpers in `platformAvatar.ts`)
- `PlatformChip.tsx`
- `PlatformSelect.tsx`
- `platform.css` (or CSS modules per the app's convention)
- `usePlatformCatalog.ts` — fetches + caches the catalog, exposes `{ catalog, byId, recent }`

**Modify:**
- `OpDrawer.tsx` — swap the platform input for `PlatformSelect`
- `HistoryTab.tsx` — platform cell — `PlatformChip`
- `WalletTab.tsx` — "Por plataforma" first column + "Ativo + plataforma" group headers
- `types.ts` (shared) — `Platform`, `PlatformKind`; op gains `platformId` + `platformName`
- i18n — `platform_kind_exchange/wallet/defi/custom`, `platform_search_placeholder`, `platform_use_custom`, `platform_group_recent/exchanges/wallets/defi`

---

## 7. Done when
- [ ] Platform logos are **rounded squares**; coin logos stay circles (the two never look alike).
- [ ] `PlatformSelect` filters as you type, groups results by category, and shows the platform logo inline in the input once selected.
- [ ] A name not in the catalog offers `Usar "<texto>" como personalizada` and produces a stable initials avatar (same name — same color across every screen).
- [ ] A broken/missing `logoUrl` silently falls back to the initials avatar (no broken-image icon anywhere).
- [ ] Histórico shows logo + name; custom platforms carry the `personalizada` tag.
- [ ] "Por plataforma" rows and "Ativo + plataforma" group headers show the real logo — the generic lock icon is gone.
- [ ] Group headers show the group total + return on the right.
- [ ] Keyboard: ↑/↓/Enter/Esc work in the dropdown, including the custom row; combobox ARIA roles present.
- [ ] Existing operations still render correctly after the migration (MetaMask, Phantom, BingX, Kamino resolved; Sodex as custom).

Diff against `platform-field-redesign.html` for any spacing/color detail.
