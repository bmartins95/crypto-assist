# Plano de Backend — Carteira de Criptoativos

Stack: **Next.js 16 (App Router) + Supabase + Vercel**
Auth: **Supabase Auth** (OAuth Google + email/senha)
Mobile futuro: **Expo + React Native**

---

## Visão geral da arquitetura

```
┌─────────────────────────────────────────────────────────┐
│                        Cliente                          │
│  ┌────────────────┐          ┌───────────────────────┐  │
│  │  Next.js Web   │          │  Expo (React Native)  │  │
│  │  (Vercel)      │          │  iOS / Android        │  │
│  └───────┬────────┘          └──────────┬────────────┘  │
└──────────┼───────────────────────────────┼──────────────┘
           │ HTTPS                         │ HTTPS
┌──────────▼───────────────────────────────▼──────────────┐
│               Next.js API Routes (Vercel)                │
│  /api/ops   /api/prices   /api/export   /api/import      │
│  Autenticação via Supabase JWT (middleware)              │
└──────────────────────────┬──────────────────────────────┘
                           │ Supabase Client (service_role)
┌──────────────────────────▼──────────────────────────────┐
│                        Supabase                         │
│  ┌─────────────────┐  ┌──────────────┐  ┌───────────┐  │
│  │   PostgreSQL     │  │  Supabase    │  │  Storage  │  │
│  │   (banco)        │  │  Auth        │  │  (backups)│  │
│  └─────────────────┘  └──────────────┘  └───────────┘  │
└─────────────────────────────────────────────────────────┘
```

---

## Schema do banco de dados (PostgreSQL)

### Tabela `profiles`
Criada automaticamente pelo Supabase Auth — extendemos com dados extras.

```sql
create table public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text,
  name        text,
  avatar_url  text,
  created_at  timestamptz default now()
);
-- RLS: usuário só vê/edita o próprio perfil
alter table public.profiles enable row level security;
create policy "own profile" on public.profiles
  using (auth.uid() = id);
```

### Tabela `ops`
Cada linha = uma operação (compra, venda ou trade).

```sql
create table public.ops (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  data        date not null,
  coin_id     text not null,       -- ex: "bitcoin"
  symbol      text not null,       -- ex: "BTC"
  name        text not null,       -- ex: "Bitcoin"
  tipo        text not null check (tipo in ('Compra', 'Venda')),
  qtd         numeric(30,10) not null,
  preco       numeric(30,10) not null,
  taxa        numeric(30,10) not null default 0,
  total       numeric(30,10) not null,
  plataforma  text not null default '',
  created_at  timestamptz default now()
);
-- RLS: usuário só vê/edita as próprias operações
alter table public.ops enable row level security;
create policy "own ops" on public.ops
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index ops_user_id_idx on public.ops(user_id);
create index ops_data_idx on public.ops(data);
```

### Tabela `exit_prices`
Meta de saída por ativo.

```sql
create table public.exit_prices (
  user_id     uuid not null references auth.users(id) on delete cascade,
  coin_id     text not null,
  exit_price  numeric(30,10) not null,
  updated_at  timestamptz default now(),
  primary key (user_id, coin_id)
);
alter table public.exit_prices enable row level security;
create policy "own exit_prices" on public.exit_prices
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
```

### Tabela `price_cache`
Cache dos preços da CoinGecko para evitar rate limit.

```sql
create table public.price_cache (
  coin_id     text primary key,
  price_brl   numeric(30,10) not null,
  image_url   text,
  updated_at  timestamptz default now()
);
-- Pública para leitura (sem RLS) — qualquer usuário autenticado lê
-- Apenas o servidor (service_role) escreve
```

---

## Estrutura de arquivos do projeto

```
web/
├── src/
│   ├── app/
│   │   ├── layout.tsx              ← já existe
│   │   ├── page.tsx                ← redirect para /dashboard se autenticado
│   │   ├── auth/
│   │   │   └── page.tsx            ← tela de login/cadastro
│   │   ├── dashboard/
│   │   │   └── page.tsx            ← app principal (hoje é page.tsx)
│   │   └── api/
│   │       ├── ops/
│   │       │   └── route.ts        ← GET (listar), POST (criar)
│   │       ├── ops/[id]/
│   │       │   └── route.ts        ← PUT (editar), DELETE (remover)
│   │       ├── exit-prices/
│   │       │   └── route.ts        ← GET, PUT
│   │       ├── prices/
│   │       │   └── route.ts        ← GET (busca + cache CoinGecko)
│   │       ├── export/
│   │       │   └── route.ts        ← GET (gera JSON de backup)
│   │       └── import/
│   │           └── route.ts        ← POST (importa JSON de backup)
│   ├── components/                 ← já existem, pequenos ajustes
│   ├── lib/
│   │   ├── types.ts                ← já existe
│   │   ├── format.ts               ← já existe
│   │   ├── portfolio.ts            ← já existe
│   │   ├── coingecko.ts            ← já existe
│   │   ├── supabase/
│   │   │   ├── client.ts           ← cliente browser (anon key)
│   │   │   ├── server.ts           ← cliente servidor (service_role)
│   │   │   └── middleware.ts       ← proteção de rotas autenticadas
│   │   └── api/
│   │       └── client.ts           ← funções para chamar /api/* do frontend
│   └── middleware.ts               ← Next.js middleware (redireciona /dashboard se não autenticado)
├── .env.local                      ← variáveis de ambiente (não commitado)
└── supabase/
    └── migrations/
        └── 001_initial.sql         ← todo o SQL acima
```

---

## Variáveis de ambiente

```env
# .env.local
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...      # nunca exposta ao browser
```

---

## API Routes — contratos

### `GET /api/ops`
Retorna todas as operações do usuário autenticado, ordenadas por data.
```json
[
  {
    "id": "uuid",
    "data": "2024-01-15",
    "coinId": "bitcoin",
    "symbol": "BTC",
    "name": "Bitcoin",
    "tipo": "Compra",
    "qtd": 0.01,
    "preco": 250000,
    "taxa": 5,
    "total": 2505,
    "plataforma": "Binance"
  }
]
```

### `POST /api/ops`
Cria uma nova operação. Body = objeto Op sem `id`.

### `PUT /api/ops/[id]`
Atualiza uma operação existente.

### `DELETE /api/ops/[id]`
Remove uma operação.

### `GET /api/exit-prices`
Retorna `{ coinId: exitPrice }` do usuário.

### `PUT /api/exit-prices`
Body: `{ coinId: string, exitPrice: number }`

### `GET /api/prices?ids=bitcoin,ethereum`
Busca preços da CoinGecko com cache de 5 minutos no banco.
Retorna: `{ bitcoin: 350000, ethereum: 18000 }`

### `GET /api/export`
Gera e retorna o JSON completo de backup do usuário.

### `POST /api/import`
Importa um JSON de backup (mesmo formato do export).

---

## Autenticação — fluxo

```
1. Usuário acessa /
2. Middleware verifica sessão Supabase
3. Se não autenticado → redireciona para /auth
4. /auth oferece: "Entrar com Google" ou email/senha
5. Supabase cria sessão JWT
6. Middleware libera acesso ao /dashboard
7. Todas as API Routes validam o JWT via supabase.auth.getUser()
8. RLS no banco garante isolamento por user_id mesmo se o JWT vazar
```

---

## Migração de dados existentes

Para usuários que já usam o `index.html` com `localStorage`:
1. Na primeira vez que acessar o app autenticado, verificar se há dados no `localStorage`
2. Oferecer: "Detectamos dados locais. Deseja importar para sua conta?"
3. Se sim → chamar `POST /api/import` com os dados do `localStorage`
4. Limpar `localStorage` após importação bem-sucedida

---

## Mobile (Expo + React Native) — estratégia futura

O Expo vai consumir as mesmas API Routes (`/api/*`), que é uma API HTTP normal.

Compartilhamento de código entre web e mobile:
- `src/lib/types.ts` — 100% reutilizável (TypeScript puro)
- `src/lib/format.ts` — 100% reutilizável
- `src/lib/portfolio.ts` — 100% reutilizável
- `src/lib/api/client.ts` — 100% reutilizável (fetch HTTP)
- UI (componentes React) — **não** reutilizável diretamente; recriada em React Native

Estrutura futura do repositório:
```
crypto-assist/
├── web/          ← Next.js (hoje)
├── mobile/       ← Expo + React Native (futuro)
└── shared/       ← types, format, portfolio, api client (extraído)
```

---

## Ordem de implementação

### Fase 1 — Supabase + Auth
1. Criar projeto no Supabase
2. Executar migrations SQL
3. Configurar OAuth Google no Supabase
4. Instalar `@supabase/ssr` no projeto Next.js
5. Criar `lib/supabase/client.ts` e `lib/supabase/server.ts`
6. Criar `middleware.ts` para proteger rotas
7. Criar página `/auth` com login Google + email/senha
8. Criar página `/dashboard` (mover o app atual de `/`)

### Fase 2 — API Routes
9. `GET/POST /api/ops`
10. `PUT/DELETE /api/ops/[id]`
11. `GET/PUT /api/exit-prices`
12. `GET /api/prices` (com cache no banco)
13. `GET /api/export` e `POST /api/import`

### Fase 3 — Migrar frontend
14. Substituir chamadas ao `localStorage` por chamadas às API Routes
15. Adicionar loading states nas tabelas
16. Implementar detecção e importação de dados do `localStorage`

### Fase 4 — Deploy
17. Push para GitHub
18. Conectar repositório na Vercel
19. Adicionar variáveis de ambiente na Vercel
20. Configurar domínio customizado (opcional)

### Fase 5 — Mobile (sessão futura)
21. Criar pasta `mobile/` com `npx create-expo-app`
22. Extrair `shared/` com types, format, portfolio, api client
23. Implementar telas equivalentes em React Native
24. Configurar OAuth Google no Expo
25. Deploy na App Store / Google Play via EAS Build
