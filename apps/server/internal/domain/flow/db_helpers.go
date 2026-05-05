package flow

import (
	"context"
	"encoding/json"
	"errors"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/mmp-platform/server/internal/apperror"
)

// rowScanner is satisfied by pgx.Row and pgx.Rows.
type rowScanner interface {
	Scan(dest ...any) error
}

// dbConn is satisfied by *pgxpool.Pool and pgx.Tx for QueryRow.
type dbConn interface {
	QueryRow(ctx context.Context, sql string, args ...any) pgx.Row
}

func insertNode(ctx context.Context, q dbConn, themeID uuid.UUID, nodeType string, data json.RawMessage, x, y float64) (*FlowNode, error) {
	row := q.QueryRow(ctx,
		`INSERT INTO flow_nodes (theme_id, type, data, position_x, position_y) VALUES ($1,$2,$3,$4,$5) RETURNING *`,
		themeID, nodeType, data, x, y,
	)
	return scanNode(row)
}

func insertEdge(ctx context.Context, q dbConn, themeID, srcID, tgtID uuid.UUID, condition json.RawMessage, label *string, sortOrder int32) (*FlowEdge, error) {
	row := q.QueryRow(ctx,
		`INSERT INTO flow_edges (theme_id, source_id, target_id, condition, label, sort_order) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
		themeID, srcID, tgtID, condition, label, sortOrder,
	)
	return scanEdge(row)
}

func scanNode(row rowScanner) (*FlowNode, error) {
	var n FlowNode
	err := row.Scan(
		&n.ID, &n.ThemeID, &n.Type, &n.Data,
		&n.PositionX, &n.PositionY, &n.CreatedAt, &n.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, apperror.NotFound("flow node not found")
		}
		return nil, apperror.Internal("failed to scan flow node")
	}
	return &n, nil
}

func scanEdge(row rowScanner) (*FlowEdge, error) {
	var e FlowEdge
	err := row.Scan(
		&e.ID, &e.ThemeID, &e.SourceID, &e.TargetID,
		&e.Condition, &e.Label, &e.SortOrder, &e.CreatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, apperror.NotFound("flow edge not found")
		}
		return nil, apperror.Internal("failed to scan flow edge")
	}
	return &e, nil
}

func listNodes(ctx context.Context, pool *pgxpool.Pool, themeID uuid.UUID) ([]FlowNode, error) {
	rows, err := pool.Query(ctx, `SELECT * FROM flow_nodes WHERE theme_id=$1 ORDER BY created_at`, themeID)
	if err != nil {
		return nil, apperror.Internal("failed to list flow nodes")
	}
	defer rows.Close()
	var nodes []FlowNode
	for rows.Next() {
		var n FlowNode
		if err := rows.Scan(&n.ID, &n.ThemeID, &n.Type, &n.Data, &n.PositionX, &n.PositionY, &n.CreatedAt, &n.UpdatedAt); err != nil {
			return nil, apperror.Internal("failed to scan flow node")
		}
		nodes = append(nodes, n)
	}
	if err := rows.Err(); err != nil {
		return nil, apperror.Internal("failed to iterate flow nodes")
	}
	return nodes, nil
}

func listEdges(ctx context.Context, pool *pgxpool.Pool, themeID uuid.UUID) ([]FlowEdge, error) {
	rows, err := pool.Query(ctx, `SELECT * FROM flow_edges WHERE theme_id=$1 ORDER BY sort_order, created_at`, themeID)
	if err != nil {
		return nil, apperror.Internal("failed to list flow edges")
	}
	defer rows.Close()
	var edges []FlowEdge
	for rows.Next() {
		var e FlowEdge
		if err := rows.Scan(&e.ID, &e.ThemeID, &e.SourceID, &e.TargetID, &e.Condition, &e.Label, &e.SortOrder, &e.CreatedAt); err != nil {
			return nil, apperror.Internal("failed to scan flow edge")
		}
		edges = append(edges, e)
	}
	if err := rows.Err(); err != nil {
		return nil, apperror.Internal("failed to iterate flow edges")
	}
	return edges, nil
}
