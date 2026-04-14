-- name: ListFlowNodesByTheme :many
SELECT * FROM flow_nodes WHERE theme_id = $1 ORDER BY created_at;

-- name: GetFlowNode :one
SELECT * FROM flow_nodes WHERE id = $1;

-- name: CreateFlowNode :one
INSERT INTO flow_nodes (theme_id, type, data, position_x, position_y)
VALUES ($1, $2, $3, $4, $5) RETURNING *;

-- name: UpdateFlowNode :one
UPDATE flow_nodes SET type = $2, data = $3, position_x = $4, position_y = $5, updated_at = now()
WHERE id = $1 RETURNING *;

-- name: DeleteFlowNode :exec
DELETE FROM flow_nodes WHERE id = $1;

-- name: DeleteFlowNodesByTheme :exec
DELETE FROM flow_nodes WHERE theme_id = $1;

-- name: ListFlowEdgesByTheme :many
SELECT * FROM flow_edges WHERE theme_id = $1 ORDER BY sort_order, created_at;

-- name: GetFlowEdge :one
SELECT * FROM flow_edges WHERE id = $1;

-- name: CreateFlowEdge :one
INSERT INTO flow_edges (theme_id, source_id, target_id, condition, label, sort_order)
VALUES ($1, $2, $3, $4, $5, $6) RETURNING *;

-- name: UpdateFlowEdge :one
UPDATE flow_edges SET source_id = $2, target_id = $3, condition = $4, label = $5, sort_order = $6
WHERE id = $1 RETURNING *;

-- name: DeleteFlowEdge :exec
DELETE FROM flow_edges WHERE id = $1;

-- name: DeleteFlowEdgesByTheme :exec
DELETE FROM flow_edges WHERE theme_id = $1;
