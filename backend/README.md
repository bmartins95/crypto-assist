# Backend — Carteira de Criptoativos

API HTTP em Express + TypeScript, consumida pelo `web/` (e futuramente pelo `mobile/`).
Não lida com login/cadastro — isso é feito pelo frontend direto no Supabase Auth.
Aqui só validamos o JWT recebido e servimos os dados (ops, exit-prices, preços, backup).

Ver [`../PLANO_BACKEND.md`](../PLANO_BACKEND.md) para a arquitetura completa.

## Setup

```bash
cp .env.example .env
# preencha SUPABASE_URL, SUPABASE_ANON_KEY e SUPABASE_SERVICE_ROLE_KEY
# (Dashboard do Supabase → Project Settings → API)

npm install
npm run dev      # http://localhost:3001, com reload automático
```

## Scripts

- `npm run dev` — desenvolvimento (tsx watch)
- `npm run build` — compila para `dist/`
- `npm start` — roda o build (`dist/index.js`)

## Rotas

Todas exigem `Authorization: Bearer <supabase_access_token>`, exceto `/health`.

| Método | Rota | Descrição |
|---|---|---|
| GET | `/api/ops` | lista operações do usuário |
| POST | `/api/ops` | cria operação |
| PUT | `/api/ops/:id` | atualiza operação |
| DELETE | `/api/ops/:id` | remove operação |
| GET | `/api/exit-prices` | metas de saída do usuário |
| PUT | `/api/exit-prices` | define/remove meta de saída |
| GET | `/api/prices?ids=bitcoin,ethereum` | preços (cache de 5 min) |
| GET | `/api/export` | backup completo em JSON |
| POST | `/api/import` | restaura backup em JSON |
