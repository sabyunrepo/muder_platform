-- +goose Up

-- Add optional scene-based appearance timing for editor clues.

ALTER TABLE theme_clues
  ADD COLUMN appearance_scene_id UUID REFERENCES flow_nodes(id) ON DELETE SET NULL;

CREATE INDEX idx_theme_clues_appearance_scene
  ON theme_clues(appearance_scene_id)
  WHERE appearance_scene_id IS NOT NULL;

-- +goose Down

DROP INDEX IF EXISTS idx_theme_clues_appearance_scene;

ALTER TABLE theme_clues
  DROP COLUMN IF EXISTS appearance_scene_id;
