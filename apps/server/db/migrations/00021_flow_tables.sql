-- +goose Up
CREATE TABLE flow_nodes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  theme_id    UUID NOT NULL REFERENCES themes(id) ON DELETE CASCADE,
  type        TEXT NOT NULL CHECK (type IN ('start','phase','branch','ending')),
  data        JSONB NOT NULL DEFAULT '{}',
  position_x  FLOAT NOT NULL DEFAULT 0,
  position_y  FLOAT NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_flow_nodes_theme ON flow_nodes(theme_id);

CREATE TABLE flow_edges (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  theme_id    UUID NOT NULL REFERENCES themes(id) ON DELETE CASCADE,
  source_id   UUID NOT NULL REFERENCES flow_nodes(id) ON DELETE CASCADE,
  target_id   UUID NOT NULL REFERENCES flow_nodes(id) ON DELETE CASCADE,
  condition   JSONB,
  label       TEXT,
  sort_order  INT NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_flow_edges_theme ON flow_edges(theme_id);

-- +goose Down
DROP TABLE IF EXISTS flow_edges;
DROP TABLE IF EXISTS flow_nodes;
