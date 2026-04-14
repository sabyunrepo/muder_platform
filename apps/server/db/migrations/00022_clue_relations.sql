-- +goose Up
CREATE TABLE clue_relations (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    theme_id    UUID NOT NULL REFERENCES themes(id) ON DELETE CASCADE,
    source_id   UUID NOT NULL REFERENCES theme_clues(id) ON DELETE CASCADE,
    target_id   UUID NOT NULL REFERENCES theme_clues(id) ON DELETE CASCADE,
    mode        VARCHAR(10) NOT NULL DEFAULT 'AND' CHECK (mode IN ('AND', 'OR')),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(theme_id, source_id, target_id)
);
CREATE INDEX idx_clue_relations_theme ON clue_relations(theme_id);

-- +goose Down
DROP TABLE IF EXISTS clue_relations;
