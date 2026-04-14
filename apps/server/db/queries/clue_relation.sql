-- name: ListClueRelationsByTheme :many
SELECT * FROM clue_relations WHERE theme_id = $1 ORDER BY created_at;

-- name: DeleteClueRelationsByTheme :exec
DELETE FROM clue_relations WHERE theme_id = $1;

-- name: InsertClueRelation :one
INSERT INTO clue_relations (theme_id, source_id, target_id, mode)
VALUES ($1, $2, $3, $4)
RETURNING *;
