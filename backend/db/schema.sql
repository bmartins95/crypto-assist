-- Clean PostgreSQL schema — no Supabase auth.* dependencies.
-- user_id is text (Cognito sub). Safe to re-run (CREATE IF NOT EXISTS).

CREATE TABLE IF NOT EXISTS ops (
    id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     text        NOT NULL,
    date        date        NOT NULL,
    coin_id     text        NOT NULL,
    symbol      text        NOT NULL,
    name        text        NOT NULL,
    type        text        NOT NULL CHECK (type IN ('Compra', 'Venda')),
    qty         numeric(30,10) NOT NULL,
    price       numeric(30,10) NOT NULL,
    fee         numeric(30,10) NOT NULL DEFAULT 0,
    total       numeric(30,10) NOT NULL,
    platform    text        NOT NULL DEFAULT '',
    created_at  timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ops_user_id_idx ON ops(user_id);
CREATE INDEX IF NOT EXISTS ops_date_idx    ON ops(date);

CREATE TABLE IF NOT EXISTS exit_prices (
    user_id     text           NOT NULL,
    coin_id     text           NOT NULL,
    exit_price  numeric(30,10) NOT NULL,
    updated_at  timestamptz    DEFAULT now(),
    PRIMARY KEY (user_id, coin_id)
);

CREATE TABLE IF NOT EXISTS price_cache (
    coin_id     text           PRIMARY KEY,
    price_brl   numeric(30,10) NOT NULL,
    image_url   text,
    updated_at  timestamptz    DEFAULT now()
);
