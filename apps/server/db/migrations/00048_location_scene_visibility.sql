-- +goose Up
-- Scene-based visibility for editor locations.
-- NULL appearance_scene_id means "visible from the beginning".
-- NULL hide_scene_id means "visible until the final scene".

ALTER TABLE theme_locations
  ADD COLUMN appearance_scene_id UUID REFERENCES flow_nodes(id) ON DELETE SET NULL,
  ADD COLUMN hide_scene_id UUID REFERENCES flow_nodes(id) ON DELETE SET NULL;

CREATE INDEX idx_theme_locations_appearance_scene
  ON theme_locations(appearance_scene_id)
  WHERE appearance_scene_id IS NOT NULL;

CREATE INDEX idx_theme_locations_hide_scene
  ON theme_locations(hide_scene_id)
  WHERE hide_scene_id IS NOT NULL;

-- +goose Down
DROP INDEX IF EXISTS idx_theme_locations_hide_scene;
DROP INDEX IF EXISTS idx_theme_locations_appearance_scene;

ALTER TABLE theme_locations
  DROP COLUMN IF EXISTS hide_scene_id,
  DROP COLUMN IF EXISTS appearance_scene_id;
