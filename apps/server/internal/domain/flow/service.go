package flow

import (
	"context"
	"encoding/json"
	"errors"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/rs/zerolog"

	"github.com/mmp-platform/server/internal/apperror"
)

// Service defines the flow domain operations.
type Service interface {
	GetFlow(ctx context.Context, creatorID, themeID uuid.UUID) (*FlowGraph, error)
	SaveFlow(ctx context.Context, creatorID, themeID uuid.UUID, req SaveFlowRequest) (*FlowGraph, error)
	CreateNode(ctx context.Context, creatorID, themeID uuid.UUID, req CreateNodeRequest) (*FlowNode, error)
	UpdateNode(ctx context.Context, creatorID, themeID, nodeID uuid.UUID, req UpdateNodeRequest) (*FlowNode, error)
	DeleteNode(ctx context.Context, creatorID, themeID, nodeID uuid.UUID) error
	CreateEdge(ctx context.Context, creatorID, themeID uuid.UUID, req CreateEdgeRequest) (*FlowEdge, error)
	UpdateEdge(ctx context.Context, creatorID, themeID, edgeID uuid.UUID, req UpdateEdgeRequest) (*FlowEdge, error)
	DeleteEdge(ctx context.Context, creatorID, themeID, edgeID uuid.UUID) error
	MigratePhases(ctx context.Context, themeID uuid.UUID, phases []map[string]any) error
}

type serviceImpl struct {
	pool   *pgxpool.Pool
	logger zerolog.Logger
}

// NewService creates a new flow service.
func NewService(pool *pgxpool.Pool, logger zerolog.Logger) Service {
	return &serviceImpl{pool: pool, logger: logger}
}

func (s *serviceImpl) GetFlow(ctx context.Context, creatorID, themeID uuid.UUID) (*FlowGraph, error) {
	if err := ensureThemeOwner(ctx, s.pool, creatorID, themeID); err != nil {
		return nil, err
	}
	nodes, err := listNodes(ctx, s.pool, themeID)
	if err != nil {
		return nil, err
	}
	edges, err := listEdges(ctx, s.pool, themeID)
	if err != nil {
		return nil, err
	}
	return &FlowGraph{Nodes: nodes, Edges: edges}, nil
}

func (s *serviceImpl) SaveFlow(ctx context.Context, creatorID, themeID uuid.UUID, req SaveFlowRequest) (*FlowGraph, error) {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return nil, apperror.Internal("failed to begin transaction")
	}
	defer tx.Rollback(ctx) //nolint:errcheck

	if err := ensureThemeOwner(ctx, tx, creatorID, themeID); err != nil {
		return nil, err
	}
	if err := validateSaveRequest(req); err != nil {
		return nil, err
	}

	// Delete existing graph
	if _, err := tx.Exec(ctx, `DELETE FROM flow_edges WHERE theme_id = $1`, themeID); err != nil {
		return nil, apperror.Internal("failed to clear edges")
	}
	if _, err := tx.Exec(ctx, `DELETE FROM flow_nodes WHERE theme_id = $1`, themeID); err != nil {
		return nil, apperror.Internal("failed to clear nodes")
	}

	// Insert nodes and build id map (client id → db id)
	idMap := make(map[uuid.UUID]uuid.UUID, len(req.Nodes))
	nodes := make([]FlowNode, 0, len(req.Nodes))
	for _, n := range req.Nodes {
		data := n.Data
		if data == nil {
			data = json.RawMessage(`{}`)
		}
		node, err := insertNode(ctx, tx, themeID, n.Type, data, n.PositionX, n.PositionY)
		if err != nil {
			return nil, err
		}
		nodes = append(nodes, *node)
		if n.ID != nil {
			idMap[*n.ID] = node.ID
		}
	}

	// Insert edges (remap client ids)
	edges := make([]FlowEdge, 0, len(req.Edges))
	for _, e := range req.Edges {
		srcID := remapID(idMap, e.SourceID)
		tgtID := remapID(idMap, e.TargetID)
		edge, err := insertEdge(ctx, tx, themeID, srcID, tgtID, e.Condition, e.Label, e.SortOrder)
		if err != nil {
			return nil, err
		}
		edges = append(edges, *edge)
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, apperror.Internal("failed to commit transaction")
	}
	return &FlowGraph{Nodes: nodes, Edges: edges}, nil
}

func (s *serviceImpl) CreateNode(ctx context.Context, creatorID, themeID uuid.UUID, req CreateNodeRequest) (*FlowNode, error) {
	if err := ensureThemeOwner(ctx, s.pool, creatorID, themeID); err != nil {
		return nil, err
	}
	if err := ValidateNodeType(req.Type); err != nil {
		return nil, err
	}
	data := req.Data
	if data == nil {
		data = json.RawMessage(`{}`)
	}
	return insertNode(ctx, s.pool, themeID, req.Type, data, req.PositionX, req.PositionY)
}

func (s *serviceImpl) UpdateNode(ctx context.Context, creatorID, themeID, nodeID uuid.UUID, req UpdateNodeRequest) (*FlowNode, error) {
	if err := ValidateNodeType(req.Type); err != nil {
		return nil, err
	}
	data := req.Data
	if data == nil {
		data = json.RawMessage(`{}`)
	}
	row := s.pool.QueryRow(ctx,
		`UPDATE flow_nodes n
		SET type=$2, data=$3, position_x=$4, position_y=$5, updated_at=now()
		FROM themes t
		WHERE n.id=$1 AND n.theme_id=$6 AND t.id=n.theme_id AND t.creator_id=$7
		RETURNING n.*`,
		nodeID, req.Type, data, req.PositionX, req.PositionY, themeID, creatorID,
	)
	return scanNode(row)
}

func (s *serviceImpl) DeleteNode(ctx context.Context, creatorID, themeID, nodeID uuid.UUID) error {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return apperror.Internal("failed to begin transaction")
	}
	defer tx.Rollback(ctx) //nolint:errcheck

	var nodeType string
	var configJSON json.RawMessage
	if err := tx.QueryRow(ctx, `
		SELECT n.type, t.config_json
		FROM flow_nodes n
		JOIN themes t ON t.id = n.theme_id
		WHERE n.id = $1 AND n.theme_id = $2 AND t.creator_id = $3
		FOR UPDATE OF n, t
	`, nodeID, themeID, creatorID).Scan(&nodeType, &configJSON); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return apperror.NotFound("flow node not found")
		}
		return apperror.Internal("failed to load node")
	}

	if nodeType == NodeTypeEnding {
		cleanedConfig, changed, err := removeEndingReferencesFromConfigJSON(configJSON, nodeID)
		if err != nil {
			return apperror.Internal("failed to clean ending references")
		}
		if changed {
			if _, err := tx.Exec(ctx, `
				UPDATE themes
				SET config_json = $2, version = version + 1, updated_at = NOW()
				WHERE id = $1
			`, themeID, cleanedConfig); err != nil {
				return apperror.Internal("failed to update theme config")
			}
		}
	}

	cmdTag, err := tx.Exec(ctx, `DELETE FROM flow_nodes WHERE id=$1`, nodeID)
	if err != nil {
		return apperror.Internal("failed to delete node")
	}
	if cmdTag.RowsAffected() != 1 {
		return apperror.NotFound("flow node not found")
	}
	if err := tx.Commit(ctx); err != nil {
		return apperror.Internal("failed to commit transaction")
	}
	return nil
}

func (s *serviceImpl) CreateEdge(ctx context.Context, creatorID, themeID uuid.UUID, req CreateEdgeRequest) (*FlowEdge, error) {
	if err := ensureThemeOwner(ctx, s.pool, creatorID, themeID); err != nil {
		return nil, err
	}
	if err := ValidateEdgeCondition(req.Condition); err != nil {
		return nil, err
	}
	if err := ensureEdgeEndpointsInTheme(ctx, s.pool, themeID, req.SourceID, req.TargetID); err != nil {
		return nil, err
	}
	return insertEdge(ctx, s.pool, themeID, req.SourceID, req.TargetID, req.Condition, req.Label, req.SortOrder)
}

func (s *serviceImpl) UpdateEdge(ctx context.Context, creatorID, themeID, edgeID uuid.UUID, req UpdateEdgeRequest) (*FlowEdge, error) {
	if err := ValidateEdgeCondition(req.Condition); err != nil {
		return nil, err
	}

	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return nil, apperror.Internal("failed to begin transaction")
	}
	defer tx.Rollback(ctx) //nolint:errcheck

	var edgeThemeID uuid.UUID
	if err := tx.QueryRow(ctx, `
		SELECT e.theme_id
		FROM flow_edges e
		JOIN themes t ON t.id = e.theme_id
		WHERE e.id = $1 AND e.theme_id = $2 AND t.creator_id = $3
		FOR UPDATE OF e
	`, edgeID, themeID, creatorID).Scan(&edgeThemeID); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, apperror.NotFound("flow edge not found")
		}
		return nil, apperror.Internal("failed to load edge")
	}
	if err := ensureEdgeEndpointsInTheme(ctx, tx, edgeThemeID, req.SourceID, req.TargetID); err != nil {
		return nil, err
	}
	row := tx.QueryRow(ctx,
		`UPDATE flow_edges
		SET source_id=$2, target_id=$3, condition=$4, label=$5, sort_order=$6
		WHERE id=$1
		RETURNING *`,
		edgeID, req.SourceID, req.TargetID, req.Condition, req.Label, req.SortOrder,
	)
	edge, err := scanEdge(row)
	if err != nil {
		return nil, err
	}
	if err := tx.Commit(ctx); err != nil {
		return nil, apperror.Internal("failed to commit transaction")
	}
	return edge, nil
}

func (s *serviceImpl) DeleteEdge(ctx context.Context, creatorID, themeID, edgeID uuid.UUID) error {
	cmdTag, err := s.pool.Exec(ctx, `
		DELETE FROM flow_edges e
		USING themes t
		WHERE e.id=$1 AND e.theme_id=$2 AND t.id=e.theme_id AND t.creator_id=$3
	`, edgeID, themeID, creatorID)
	if err != nil {
		return apperror.Internal("failed to delete edge")
	}
	if cmdTag.RowsAffected() != 1 {
		return apperror.NotFound("flow edge not found")
	}
	return nil
}

// --- helpers ---

func ensureThemeOwner(ctx context.Context, q dbConn, creatorID, themeID uuid.UUID) error {
	var exists bool
	if err := q.QueryRow(ctx, `
		SELECT EXISTS (
			SELECT 1 FROM themes WHERE id = $1 AND creator_id = $2
		)
	`, themeID, creatorID).Scan(&exists); err != nil {
		return apperror.Internal("failed to verify theme ownership")
	}
	if !exists {
		return apperror.NotFound("theme not found")
	}
	return nil
}

func ensureEdgeEndpointsInTheme(ctx context.Context, q dbConn, themeID, sourceID, targetID uuid.UUID) error {
	expected := 2
	if sourceID == targetID {
		expected = 1
	}
	var count int
	if err := q.QueryRow(ctx, `
		SELECT COUNT(*) FROM flow_nodes
		WHERE theme_id = $1 AND id IN ($2, $3)
	`, themeID, sourceID, targetID).Scan(&count); err != nil {
		return apperror.Internal("failed to verify flow edge endpoints")
	}
	if count != expected {
		return apperror.NotFound("flow node not found")
	}
	return nil
}

func validateSaveRequest(req SaveFlowRequest) error {
	nodes := make([]FlowNode, len(req.Nodes))
	for i, n := range req.Nodes {
		if err := ValidateNodeType(n.Type); err != nil {
			return err
		}
		nodes[i] = FlowNode{ID: uuid.New(), Type: n.Type}
	}
	edges := make([]FlowEdge, len(req.Edges))
	for i, e := range req.Edges {
		if err := ValidateEdgeCondition(e.Condition); err != nil {
			return err
		}
		edges[i] = FlowEdge{SourceID: e.SourceID, TargetID: e.TargetID}
	}
	return ValidateDAG(nodes, edges)
}

func remapID(m map[uuid.UUID]uuid.UUID, id uuid.UUID) uuid.UUID {
	if newID, ok := m[id]; ok {
		return newID
	}
	return id
}
