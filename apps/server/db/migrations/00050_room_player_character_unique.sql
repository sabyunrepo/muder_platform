-- +goose Up
-- +goose StatementBegin
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM room_players
    WHERE character_id IS NOT NULL
    GROUP BY room_id, character_id
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'duplicate room_players.character_id values exist; clean up duplicate room character selections before applying unique index';
  END IF;
END $$;
-- +goose StatementEnd

CREATE UNIQUE INDEX IF NOT EXISTS idx_room_players_unique_character
ON room_players(room_id, character_id)
WHERE character_id IS NOT NULL;

-- +goose Down
DROP INDEX IF EXISTS idx_room_players_unique_character;
