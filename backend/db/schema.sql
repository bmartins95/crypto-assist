-- Clean PostgreSQL schema — no Supabase auth.* dependencies.
-- user_id is text (Cognito sub). Safe to re-run (CREATE IF NOT EXISTS).

CREATE TABLE IF NOT EXISTS ops (
    id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     text        NOT NULL,
    date        date        NOT NULL,
    coin_id     text        NOT NULL,
    symbol      text        NOT NULL,
    name        text        NOT NULL,
    type        text        NOT NULL CHECK (type IN ('Buy', 'Sell')),
    qty         numeric(30,10) NOT NULL,
    price       numeric(30,10) NOT NULL,
    fee         numeric(30,10) NOT NULL DEFAULT 0,
    total       numeric(30,10) NOT NULL,
    platform    text        NOT NULL DEFAULT '',
    platform_id   text,
    platform_name text,
    currency    varchar(8)  NOT NULL DEFAULT 'BRL' CHECK (currency IN ('BRL', 'USD', 'EUR', 'GBP', 'JPY')),
    leverage    smallint    CHECK (leverage IN (2, 3, 5, 10)),
    trade_group_id uuid,
    op_kind     varchar(10) NOT NULL DEFAULT 'wallet' CHECK (op_kind IN ('wallet', 'trade')),
    side        varchar(5)  CHECK (side IN ('long', 'short')),
    created_at  timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ops_user_id_idx ON ops(user_id);
CREATE INDEX IF NOT EXISTS ops_date_idx    ON ops(date);
CREATE INDEX IF NOT EXISTS ops_trade_group_id_idx ON ops(trade_group_id);

CREATE TABLE IF NOT EXISTS op_closures (
    id             uuid           PRIMARY KEY DEFAULT gen_random_uuid(),
    source_op_id   uuid           NOT NULL REFERENCES ops(id) ON DELETE CASCADE,
    closing_op_id  uuid           NOT NULL REFERENCES ops(id) ON DELETE CASCADE,
    qty_closed     numeric(30,10) NOT NULL,
    realized_pnl   numeric(30,10) NOT NULL,
    created_at     timestamptz    DEFAULT now()
);

CREATE INDEX IF NOT EXISTS op_closures_source_op_id_idx  ON op_closures(source_op_id);
CREATE INDEX IF NOT EXISTS op_closures_closing_op_id_idx ON op_closures(closing_op_id);

CREATE TABLE IF NOT EXISTS exit_prices (
    user_id     text           NOT NULL,
    coin_id     text           NOT NULL,
    exit_price  numeric(30,10) NOT NULL,
    updated_at  timestamptz    DEFAULT now(),
    PRIMARY KEY (user_id, coin_id)
);

CREATE TABLE IF NOT EXISTS price_cache (
    coin_id     text           PRIMARY KEY,
    price_usd   numeric(30,10) NOT NULL,
    image_url   text,
    symbol      text,
    updated_at  timestamptz    DEFAULT now()
);

CREATE TABLE IF NOT EXISTS exchange_rates (
    currency_code varchar(8)     PRIMARY KEY,
    rate_vs_usd   numeric(18,8)  NOT NULL,
    updated_at    timestamptz    NOT NULL
);

CREATE TABLE IF NOT EXISTS price_history (
    coin_id     text           NOT NULL,
    date        date           NOT NULL,
    price_usd   numeric(30,10) NOT NULL,
    symbol      text,
    PRIMARY KEY (coin_id, date)
);

CREATE TABLE IF NOT EXISTS platform_cache (
    id          text        PRIMARY KEY,
    name        text        NOT NULL,
    logo_url    text,
    kind        text        NOT NULL DEFAULT 'exchange',
    updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS coin_search_cache (
    query       text        PRIMARY KEY,
    results     jsonb       NOT NULL,
    updated_at  timestamptz NOT NULL DEFAULT now()
);
