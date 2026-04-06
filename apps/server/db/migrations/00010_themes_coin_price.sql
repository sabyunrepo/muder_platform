-- +goose Up
ALTER TABLE themes ADD COLUMN IF NOT EXISTS coin_price INT NOT NULL DEFAULT 0;

-- +goose Down
ALTER TABLE themes DROP COLUMN IF EXISTS coin_price;
