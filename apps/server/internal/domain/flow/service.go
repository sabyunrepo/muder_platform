package flow

import (
	"context"
	"encoding/json"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/rs/zerolog"

	"github.com/mmp-platform/server/internal/apperror"
)

// Service defines the flow domain operations.
type Service interface {
	GetFlow(ctx context.Context, themeID uuid.UUID) (*FlowGraph, error)
	SaveFlow(ctx context.Context, creatorID, themeID uuid.UUID, req SaveFlowRequest) (*FlowGraph, error)
	CreateNode(ctx context.Context, creatorID, themeID uuid.UUID, req CreateNodeRequest) (*FlowNode, error)
	UpdateNode(ctx context.Context, creatorID, nodeID uuid.UUID, req UpdateNodeRequest) (*FlowNode, error)
	DeleteNode(ctx context.Context, creatorID, nodeID uuid.UUID) error
	CreateEdge(ctx context.Context, creatorID, themeID uuid.UUID, req CreateEdgeRequest) (*FlowEdge, error)
	UpdateEdge(ctx context.Context, creatorID, edgeID uuid.UUID, req UpdateEdgeRequest) (*FlowEdge, error)
	DeleteEdge(ctx context.Context, creatorID, edgeID uuid.UUID) error
}

type serviceImpl struct {
	pool   *pgxpool.Pool
	logger zerolog.Logger
}

// NewService creates a new flow service.
func NewService(pool *pgxpool.Pool, logger zerolog.Logger) Service {
	return &serviceImpl{pool: pool, logger: logger}
}

func (s *serviceImpl) GetFlow(ctx context.Context, themeID uuid.UUID) (*FlowGraph, error) {
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
	if err := validateSaveRequest(req); err != nil {
		return nil, err
	}

	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return nil, apperror.Internal("failed to begin transaction")
	}
	defer tx.Rollback(ctx) //nolint:errcheck

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

func (s *serviceImpl) CreateNode(ctx context.Context, _, themeID uuid.UUID, req CreateNodeRequest) (*FlowNode, error) {
	if err := ValidateNodeType(req.Type); err != nil {
		return nil, err
	}
	data := req.Data
	if data == nil {
		data = json.RawMessage(`{}`)
	}
	return insertNode(ctx, s.pool, themeID, req.Type, data, req.PositionX, req.PositionY)
}

func (s *serviceImpl) UpdateNode(ctx context.Context, _, nodeID uuid.UUID, req UpdateNodeRequest) (*FlowNode, error) {
	if err := ValidateNodeType(req.Type); err != nil {
		return nil, err
	}
	data := req.Data
	if data == nil {
		data = json.RawMessage(`{}`)
	}
	row := s.pool.QueryRow(ctx,
		`UPDATE flow_nodes SET type=$2, data=$3, position_x=$4, position_y=$5, updated_at=now() WHERE id=$1 RETURNING *`,
		nodeID, req.Type, data, req.PositionX, req.PositionY,
	)
	return scanNode(row)
}

func (s *serviceImpl) DeleteNode(ctx context.Context, _, nodeID uuid.UUID) error {
	_, err := s.pool.Exec(ctx, `DELETE FROM flow_nodes WHERE id=$1`, nodeID)
	if err != nil {
		return apperror.Internal("failed to delete node")
	}
	return nil
}

func (s *serviceImpl) CreateEdge(ctx context.Context, _, themeID uuid.UUID, req CreateEdgeRequest) (*FlowEdge, error) {
	return insertEdge(ctx, s.pool, themeID, req.SourceID, req.TargetID, req.Condition, req.Label, req.SortOrder)
}

func (s *serviceImpl) UpdateEdge(ctx context.Context, _, edgeID uuid.UUID, req UpdateEdgeRequest) (*FlowEdge, error) {
	row := s.pool.QueryRow(ctx,
		`UPDATE flow_edges SET source_id=$2, target_id=$3, condition=$4, label=$5, sort_order=$6 WHERE id=$1 RETURNING *`,
		edgeID, req.SourceID, req.TargetID, req.Condition, req.Label, req.SortOrder,
	)
	return scanEdge(row)
}

func (s *serviceImpl) DeleteEdge(ctx context.Context, _, edgeID uuid.UUID) error {
	_, err := s.pool.Exec(ctx, `DELETE FROM flow_edges WHERE id=$1`, edgeID)
	if err != nil {
		return apperror.Internal("failed to delete edge")
	}
	return nil
}

// --- helpers ---

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
