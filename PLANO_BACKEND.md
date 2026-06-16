# Plano de Backend — Carteira de Criptoativos

Stack: **Next.js 16 (frontend) + Express + TypeScript (backend) + Supabase + Vercel**
Auth: **Supabase Auth** (OAuth Google + email/senha) — usada direto pelo frontend, sem passar pelo backend
Mobile futuro: **Expo + React Native**, consumindo o mesmo `backend/`

> Decisão: frontend (`web/`) e backend (`backend/`) são projetos separados no mesmo repositório,
> para que o futuro app mobile (`mobile/`) consuma o mesmo backend HTTP sem depender do Next.js.

---

## Visão geral da arquitetura

```
┌─────────────────────────────┐     ┌───────────────────────┐
│        web/ (Next.js)       │     │  mobile/ (Expo, futuro)│
│   UI pura — sem API routes  │     │  iOS / Android         │
└──────────┬───────────────┬──┘     └──────────┬─────────────┘
           │               │                    │
           │ (1) Auth      │ (2) HTTP + Bearer JWT
           │ direto        │     │              │
           ▼               ▼     ▼              │
   ┌───────────────┐   ┌────────────────────────▼────┐
   │ Supabase Auth  │   │     backend/ (Express)      │
   │ (login/signup, │   │  /api/ops   /api/prices     │
   │  OAuth Google) │   │  /api/exit-prices            │
   └───────┬────────┘   │  /api/export /api/import    │
           │            │  Middleware: valida JWT      │
           │            │  Supabase (RLS por usuário)  │
           │            └──────────────┬───────────────┘
           │                           │
           ▼                           ▼
   ┌──────────────────────────────────────────────────┐
   │                     Supabase                      │
   │  ┌─────────────┐  ┌──────────────┐  ┌──────────┐  │
   │  │ PostgreSQL   │  │ Supabase Auth│  │ Storage  │  │
   │  │ (RLS)        │  │              │  │ (backups)│  │
   │  └─────────────┘  └──────────────┘  └──────────┘  │
   └────────────────────────────────────────────────────┘
```

**Fluxo de auth:**
1. O frontend (web ou mobile) fala **direto com o Supabase Auth** via `@supabase/supabase-js` para login, signup, OAuth Google e refresh de sessão. Reimplementar esse fluxo no backend não traria benefício — o SDK do Supabase já cuida de PKCE, refresh tokens, etc., e isso é o que fica naturalmente compartilhado entre web e mobile.
2. Para chamar o backend, o frontend envia o **access token JWT** da sessão Supabase no header `Authorization: Bearer <token>`.
3. O backend valida esse token (via `supabase.auth.getUser(token)`) em um middleware, e usa um client Supabase **autenticado com o token do usuário** para que o RLS do Postgres garanta o isolamento por `user_id` automaticamente.
4. Para operações que exigem privilégio de servidor (ex.: escrever no cache de preços compartilhado), o backend usa um client separado com a `service_role key`.

---

## Schema do banco de dados (PostgreSQL)

Ver [`supabase/migrations/001_initial.sql`](supabase/migrations/001_initial.sql) — contém as tabelas `profiles`, `ops`, `exit_prices` e `price_cache`, todas com RLS habilitada.

---

## Estrutura de pastas do repositório

```
crypto-assist/
├── web/                             ← Next.js (frontend, só UI)
│   ├── src/
│   │   ├── app/
│   │   │   ├── page.tsx             ← redireciona para /dashboard ou /auth
│   │   │   ├── auth/
│   │   │   │   ├── page.tsx         ← login/cadastro (Google + email/senha)
│   │   │   │   └── callback/route.ts← troca o code do OAuth por sessão
│   │   │   └── dashboard/
│   │   │       ├── layout.tsx       ← verifica sessão no servidor, header com logout
│   │   │       └── page.tsx         ← app principal (hoje é app/page.tsx)
│   │   ├── components/              ← já existem
│   │   ├── lib/
│   │   │   ├── types.ts             ← já existe
│   │   │   ├── format.ts            ← já existe
│   │   │   ├── portfolio.ts         ← já existe
│   │   │   ├── supabase/
│   │   │   │   ├── client.ts        ← browser client (anon key)
│   │   │   │   └── server.ts        ← server client (Server Components/Route Handlers)
│   │   │   └── api/
│   │   │       └── client.ts        ← funções fetch() para chamar o backend/
│   │   └── proxy.ts                 ← Next 16: protege /dashboard (renomeado de middleware)
│   └── .env.local                   ← NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY,
│                                       NEXT_PUBLIC_BACKEND_URL
│
├── backend/                         ← Express + TypeScript (API HTTP, projeto independente)
│   ├── src/
│   │   ├── index.ts                 ← bootstrap do Express (cors, json, rotas)
│   │   ├── middleware/
│   │   │   └── auth.ts              ← valida Bearer token, popula req.user
│   │   ├── lib/
│   │   │   └── supabase.ts          ← supabaseAdmin (service_role) + supabaseForUser(token)
│   │   └── routes/
│   │       ├── ops.ts               ← GET/POST /api/ops, PUT/DELETE /api/ops/:id
│   │       ├── exitPrices.ts        ← GET/PUT /api/exit-prices
│   │       ├── prices.ts            ← GET /api/prices (cache CoinGecko)
│   │       ├── exportData.ts        ← GET /api/export
│   │       └── importData.ts        ← POST /api/import
│   ├── .env                         ← SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY,
│   │                                   COINGECKO_API_KEY, FRONTEND_ORIGIN (para CORS)
│   ├── package.json
│   └── tsconfig.json
│
├── mobile/                          ← Expo + React Native (futuro)
├── supabase/
│   └── migrations/
│       └── 001_initial.sql
└── PLANO_BACKEND.md
```

---

## Variáveis de ambiente

### `web/.env.local`
```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
NEXT_PUBLIC_BACKEND_URL=http://localhost:3001        # produção: URL do backend na Vercel
```

### `backend/.env`
```env
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_ANON_KEY=eyJ...                              # mesmo valor do anon key do frontend
SUPABASE_SERVICE_ROLE_KEY=eyJ...                      # nunca exposta ao cliente
COINGECKO_API_KEY=                                    # opcional, chave Demo da CoinGecko
FRONTEND_ORIGIN=http://localhost:3000                 # para configurar CORS
PORT=3001
```

---

## API — contratos (backend/, prefixo `/api`)

Todas as rotas (exceto health check) exigem header `Authorization: Bearer <supabase_access_token>`.

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

### `PUT /api/ops/:id`
Atualiza uma operação existente.

### `DELETE /api/ops/:id`
Remove uma operação.

### `GET /api/exit-prices`
Retorna `{ coinId: exitPrice }` do usuário.

### `PUT /api/exit-prices`
Body: `{ coinId: string, exitPrice: number }`

### `GET /api/prices?ids=bitcoin,ethereum`
Busca preços da CoinGecko com cache de 5 minutos na tabela `price_cache` (gravada com a service_role key).
Retorna: `{ bitcoin: 350000, ethereum: 18000 }`

### `GET /api/export`
Gera e retorna o JSON completo de backup do usuário.

### `POST /api/import`
Importa um JSON de backup (mesmo formato do export).

---

## Autenticação — fluxo detalhado

```
1. Usuário acessa web/ em "/"
2. proxy.ts (Next.js) verifica sessão Supabase via cookie
3. Se não autenticado → redireciona para /auth
4. /auth oferece: "Entrar com Google" ou email/senha, via supabase-js no browser
5. Supabase cria sessão (JWT access + refresh token), persistida em cookies pelo @supabase/ssr
6. proxy.ts libera acesso a /dashboard
7. O frontend lê o access token da sessão e o envia como Bearer token em toda chamada ao backend/
8. O middleware do backend valida o token (supabase.auth.getUser(token))
9. RLS no Postgres garante isolamento por user_id mesmo se o JWT vazar
```

No mobile (futuro), o mesmo `@supabase/supabase-js` é usado para login, e o access token é anexado às chamadas ao mesmo `backend/`.

---

## Migração de dados existentes

Para usuários que já usam o `index.html` com `localStorage`:
1. Na primeira vez que acessar o app autenticado, verificar se há dados no `localStorage`
2. Oferecer: "Detectamos dados locais. Deseja importar para sua conta?"
3. Se sim → chamar `POST /api/import` (no backend/) com os dados do `localStorage`
4. Limpar `localStorage` após importação bem-sucedida

---

## Mobile (Expo + React Native) — estratégia futura

O Expo vai consumir o mesmo `backend/` (API HTTP) e o mesmo Supabase (para Auth), exatamente como o `web/` faz hoje.

Compartilhamento de código entre web e mobile:
- `lib/types.ts` — 100% reutilizável (TypeScript puro) → candidato a virar `shared/`
- `lib/format.ts` — 100% reutilizável
- `lib/portfolio.ts` — 100% reutilizável
- `lib/api/client.ts` — 100% reutilizável (fetch HTTP para o backend/)
- UI (componentes React) — **não** reutilizável diretamente; recriada em React Native

---

## Ordem de implementação

### Fase 1 — Supabase + Auth
1. Criar projeto no Supabase
2. Executar `supabase/migrations/001_initial.sql`
3. Configurar OAuth Google no Supabase
4. Instalar `@supabase/ssr` no `web/`
5. Criar `lib/supabase/client.ts` e `lib/supabase/server.ts`
6. Criar `proxy.ts` para proteger rotas
7. Criar página `/auth` com login Google + email/senha
8. Criar `dashboard/layout.tsx` + mover o app atual para `dashboard/page.tsx`

### Fase 2 — Backend Express
9. Scaffold `backend/` (Express + TypeScript)
10. Middleware de autenticação (valida Bearer token)
11. `GET/POST /api/ops`, `PUT/DELETE /api/ops/:id`
12. `GET/PUT /api/exit-prices`
13. `GET /api/prices` (com cache na tabela `price_cache`)
14. `GET /api/export` e `POST /api/import`

### Fase 3 — Migrar frontend
15. Criar `lib/api/client.ts` no `web/` (fetch + Bearer token automático)
16. Substituir chamadas ao `localStorage` por chamadas ao `backend/`
17. Adicionar loading states nas tabelas
18. Implementar detecção e importação de dados do `localStorage`

### Fase 4 — Deploy
19. Push para GitHub
20. Conectar `web/` e `backend/` como **dois projetos Vercel separados** (cada um com seu próprio root directory)
21. Adicionar variáveis de ambiente em cada projeto na Vercel
22. Configurar `NEXT_PUBLIC_BACKEND_URL` no `web/` apontando para a URL do `backend/` em produção
23. Configurar domínio customizado (opcional)

### Fase 5 — Mobile (sessão futura)
24. Criar pasta `mobile/` com `npx create-expo-app`
25. Extrair `shared/` com types, format, portfolio, api client
26. Implementar telas equivalentes em React Native
27. Configurar OAuth Google no Expo
28. Apontar o app para o mesmo `backend/` e Supabase
29. Deploy na App Store / Google Play via EAS Build
