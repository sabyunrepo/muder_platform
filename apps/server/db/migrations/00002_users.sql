-- +goose Up
CREATE TABLE users (
    id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nickname     VARCHAR(30) NOT NULL,
    email        VARCHAR(255) UNIQUE,
    avatar_url   TEXT,
    role         VARCHAR(20) NOT NULL DEFAULT 'USER',
    provider     VARCHAR(20) NOT NULL,
    provider_id  VARCHAR(255) NOT NULL,
    coin_balance BIGINT NOT NULL DEFAULT 0,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(provider, provider_id)
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_provider ON users(provider, provider_id);

-- +goose Down
DROP TABLE IF EXISTS users;
