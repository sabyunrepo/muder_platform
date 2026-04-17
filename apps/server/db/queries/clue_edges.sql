-- Phase 20 PR-4: unified clue edge schema queries.
-- `clue_edge_groups` rows model a "one target + one group of sources +
-- trigger + mode" tuple. `clue_edge_members` fans out the sources.

-- name: ListClueEdgeGroupsByTheme :many
SELECT * FROM clue_edge_groups WHERE theme_id = $1 ORDER BY created_at;

-- name: ListClueEdgeMembersByTheme :many
SELECT m.* FROM clue_edge_members m
JOIN clue_edge_groups g ON m.group_id = g.id
WHERE g.theme_id = $1
ORDER BY m.created_at;

-- name: DeleteClueEdgeGroupsByTheme :exec
DELETE FROM clue_edge_groups WHERE theme_id = $1;

-- name: InsertClueEdgeGroup :one
INSERT INTO clue_edge_groups (theme_id, target_id, trigger, mode)
VALUES ($1, $2, $3, $4)
RETURNING *;

-- name: BulkInsertClueEdgeMembers :many
INSERT INTO clue_edge_members (group_id, source_id)
SELECT unnest(@group_ids::uuid[]), unnest(@source_ids::uuid[])
RETURNING *;
