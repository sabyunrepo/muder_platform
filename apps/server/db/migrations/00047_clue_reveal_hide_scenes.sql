-- +goose Up

-- Add optional scene-based reveal/hide timing for editor clues.

ALTER TABLE theme_clues
  ADD COLUMN reveal_scene_id UUID REFERENCES flow_nodes(id) ON DELETE SET NULL,
  ADD COLUMN hide_scene_id UUID REFERENCES flow_nodes(id) ON DELETE SET NULL;

CREATE INDEX idx_theme_clues_reveal_scene
  ON theme_clues(reveal_scene_id)
  WHERE reveal_scene_id IS NOT NULL;

CREATE INDEX idx_theme_clues_hide_scene
  ON theme_clues(hide_scene_id)
  WHERE hide_scene_id IS NOT NULL;

-- +goose Down

DROP INDEX IF EXISTS idx_theme_clues_hide_scene;
DROP INDEX IF EXISTS idx_theme_clues_reveal_scene;

ALTER TABLE theme_clues
  DROP COLUMN IF EXISTS hide_scene_id,
  DROP COLUMN IF EXISTS reveal_scene_id;
