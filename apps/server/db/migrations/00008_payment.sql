-- +goose Up

-- ── 코인 패키지 ──────────────────────────────────────────
CREATE TABLE coin_packages (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    platform    VARCHAR(10) NOT NULL CHECK (platform IN ('WEB', 'MOBILE')),
    name        VARCHAR(100) NOT NULL,
    price_krw   INT NOT NULL CHECK (price_krw > 0),
    base_coins  INT NOT NULL CHECK (base_coins > 0),
    bonus_coins INT NOT NULL DEFAULT 0 CHECK (bonus_coins >= 0),
    sort_order  INT NOT NULL DEFAULT 0,
    is_active   BOOLEAN NOT NULL DEFAULT true,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_coin_packages_updated_at BEFORE UPDATE ON coin_packages FOR EACH ROW EXECUTE FUNCTION set_updated_at();

INSERT INTO coin_packages (platform, name, price_krw, base_coins, bonus_coins, sort_order) VALUES
    ('WEB',    '400 코인',   5000,  400,    0, 1),
    ('WEB',    '840 코인',  10000,  800,   40, 2),
    ('WEB',    '2,650 코인', 30000, 2400,  250, 3),
    ('MOBILE', '400 코인',   5500,  400,    0, 1),
    ('MOBILE', '800 코인',  11000,  800,    0, 2),
    ('MOBILE', '2,450 코인', 33000, 2400,   50, 3);

-- ── 결제 ──────────────────────────────────────────────────
CREATE TABLE payments (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    package_id      UUID NOT NULL REFERENCES coin_packages(id),
    payment_key     VARCHAR(200) UNIQUE,
    idempotency_key UUID NOT NULL UNIQUE,
    provider        VARCHAR(20) NOT NULL DEFAULT 'mock',
    status          VARCHAR(20) NOT NULL DEFAULT 'PENDING'
                    CHECK (status IN ('PENDING', 'CONFIRMED', 'REFUNDED', 'FAILED', 'CANCELLED')),
    amount_krw      INT NOT NULL,
    base_coins      INT NOT NULL,
    bonus_coins     INT NOT NULL,
    refunded_at     TIMESTAMPTZ,
    confirmed_at    TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_payments_user_id ON payments(user_id);
CREATE INDEX idx_payments_status ON payments(status);
CREATE TRIGGER trg_payments_updated_at BEFORE UPDATE ON payments FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── 코인 거래 내역 ──────────────────────────────────────
CREATE TABLE coin_transactions (
    id                 BIGSERIAL PRIMARY KEY,
    user_id            UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type               VARCHAR(20) NOT NULL
                       CHECK (type IN ('CHARGE', 'PURCHASE', 'REFUND', 'ADMIN_GRANT', 'ADMIN_REVOKE')),
    base_amount        INT NOT NULL DEFAULT 0,
    bonus_amount       INT NOT NULL DEFAULT 0,
    balance_after_base  BIGINT NOT NULL,
    balance_after_bonus BIGINT NOT NULL,
    reference_type     VARCHAR(20),
    reference_id       VARCHAR(100),
    description        VARCHAR(300),
    created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_coin_tx_user_created ON coin_transactions(user_id, created_at DESC);

-- ── 테마 구매 ────────────────────────────────────────────
CREATE TABLE theme_purchases (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    theme_id        UUID NOT NULL REFERENCES themes(id),
    coin_price      INT NOT NULL,
    base_coins_used INT NOT NULL,
    bonus_coins_used INT NOT NULL,
    status          VARCHAR(20) NOT NULL DEFAULT 'COMPLETED'
                    CHECK (status IN ('COMPLETED', 'REFUNDED')),
    has_played      BOOLEAN NOT NULL DEFAULT false,
    refundable_until TIMESTAMPTZ,
    refunded_at     TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, theme_id)
);

CREATE INDEX idx_purchases_theme ON theme_purchases(theme_id);
CREATE INDEX idx_purchases_refundable ON theme_purchases(status, refundable_until);
CREATE INDEX idx_purchases_user ON theme_purchases(user_id, created_at DESC);

-- ── 크리에이터 수익 ──────────────────────────────────────
CREATE TABLE creator_earnings (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    creator_id          UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    theme_id            UUID NOT NULL REFERENCES themes(id),
    purchase_id         UUID NOT NULL REFERENCES theme_purchases(id) UNIQUE,
    total_coins         INT NOT NULL,
    creator_share_coins INT NOT NULL,
    platform_share_coins INT NOT NULL,
    settled             BOOLEAN NOT NULL DEFAULT false,
    settlement_id       UUID,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_earnings_creator_settled ON creator_earnings(creator_id, settled);
CREATE INDEX idx_earnings_created ON creator_earnings(created_at);

-- ── 정산 ──────────────────────────────────────────────────
CREATE TABLE settlements (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    creator_id  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    period_start DATE NOT NULL,
    period_end   DATE NOT NULL,
    total_coins  INT NOT NULL,
    total_krw    INT NOT NULL,
    tax_type    VARCHAR(20) NOT NULL CHECK (tax_type IN ('INDIVIDUAL', 'BUSINESS')),
    tax_rate    NUMERIC(5,2) NOT NULL,
    tax_amount  INT NOT NULL,
    net_amount  INT NOT NULL,
    status      VARCHAR(20) NOT NULL DEFAULT 'CALCULATED'
                CHECK (status IN ('CALCULATED', 'APPROVED', 'PAID_OUT', 'CANCELLED')),
    approved_by UUID REFERENCES users(id),
    approved_at TIMESTAMPTZ,
    paid_out_at TIMESTAMPTZ,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_settlements_creator ON settlements(creator_id);
CREATE INDEX idx_settlements_status ON settlements(status);
CREATE TRIGGER trg_settlements_updated_at BEFORE UPDATE ON settlements FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- settlements 생성 후 FK 추가
ALTER TABLE creator_earnings
    ADD CONSTRAINT fk_earnings_settlement
    FOREIGN KEY (settlement_id) REFERENCES settlements(id);

-- ── 기존 테이블 확장 ─────────────────────────────────────
ALTER TABLE users ADD COLUMN coin_balance_base  BIGINT NOT NULL DEFAULT 0 CHECK (coin_balance_base >= 0);
ALTER TABLE users ADD COLUMN coin_balance_bonus BIGINT NOT NULL DEFAULT 0 CHECK (coin_balance_bonus >= 0);

ALTER TABLE themes ADD COLUMN coin_price INT NOT NULL DEFAULT 0 CHECK (coin_price >= 0 AND coin_price <= 100000);

-- +goose Down
ALTER TABLE themes DROP COLUMN IF EXISTS coin_price;
ALTER TABLE users DROP COLUMN IF EXISTS coin_balance_bonus;
ALTER TABLE users DROP COLUMN IF EXISTS coin_balance_base;
ALTER TABLE creator_earnings DROP CONSTRAINT IF EXISTS fk_earnings_settlement;
DROP TABLE IF EXISTS settlements;
DROP TABLE IF EXISTS creator_earnings;
DROP TABLE IF EXISTS theme_purchases;
DROP TABLE IF EXISTS coin_transactions;
DROP TABLE IF EXISTS payments;
DROP TABLE IF EXISTS coin_packages;
