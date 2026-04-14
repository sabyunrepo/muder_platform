package flow

import (
	"encoding/json"
	"time"

	"github.com/google/uuid"
)

// NodeType constants for flow graph nodes.
const (
	NodeTypeStart   = "start"
	NodeTypePhase   = "phase"
	NodeTypeBranch  = "branch"
	NodeTypeEnding  = "ending"
)

// FlowNode represents a node in the game flow canvas.
type FlowNode struct {
	ID        uuid.UUID       `json:"id"`
	ThemeID   uuid.UUID       `json:"theme_id"`
	Type      string          `json:"type"`
	Data      json.RawMessage `json:"data"`
	PositionX float64         `json:"position_x"`
	PositionY float64         `json:"position_y"`
	CreatedAt time.Time       `json:"created_at"`
	UpdatedAt time.Time       `json:"updated_at"`
}

// FlowEdge represents a directed edge between two flow nodes.
type FlowEdge struct {
	ID        uuid.UUID       `json:"id"`
	ThemeID   uuid.UUID       `json:"theme_id"`
	SourceID  uuid.UUID       `json:"source_id"`
	TargetID  uuid.UUID       `json:"target_id"`
	Condition json.RawMessage `json:"condition,omitempty"`
	Label     *string         `json:"label,omitempty"`
	SortOrder int32           `json:"sort_order"`
	CreatedAt time.Time       `json:"created_at"`
}

// FlowGraph is the full graph for a theme: nodes + edges.
type FlowGraph struct {
	Nodes []FlowNode `json:"nodes"`
	Edges []FlowEdge `json:"edges"`
}

// FlowNodeInput is used when creating or bulk-saving a node.
type FlowNodeInput struct {
	ID        *uuid.UUID      `json:"id,omitempty"`
	Type      string          `json:"type"`
	Data      json.RawMessage `json:"data"`
	PositionX float64         `json:"position_x"`
	PositionY float64         `json:"position_y"`
}

// FlowEdgeInput is used when creating or bulk-saving an edge.
type FlowEdgeInput struct {
	ID        *uuid.UUID      `json:"id,omitempty"`
	SourceID  uuid.UUID       `json:"source_id"`
	TargetID  uuid.UUID       `json:"target_id"`
	Condition json.RawMessage `json:"condition,omitempty"`
	Label     *string         `json:"label,omitempty"`
	SortOrder int32           `json:"sort_order"`
}

// SaveFlowRequest replaces the entire graph for a theme atomically.
type SaveFlowRequest struct {
	Nodes []FlowNodeInput `json:"nodes"`
	Edges []FlowEdgeInput `json:"edges"`
}

// CreateNodeRequest creates a single new node.
type CreateNodeRequest struct {
	Type      string          `json:"type"`
	Data      json.RawMessage `json:"data"`
	PositionX float64         `json:"position_x"`
	PositionY float64         `json:"position_y"`
}

// UpdateNodeRequest updates an existing node.
type UpdateNodeRequest struct {
	Type      string          `json:"type"`
	Data      json.RawMessage `json:"data"`
	PositionX float64         `json:"position_x"`
	PositionY float64         `json:"position_y"`
}

// CreateEdgeRequest creates a single new edge.
type CreateEdgeRequest struct {
	SourceID  uuid.UUID       `json:"source_id"`
	TargetID  uuid.UUID       `json:"target_id"`
	Condition json.RawMessage `json:"condition,omitempty"`
	Label     *string         `json:"label,omitempty"`
	SortOrder int32           `json:"sort_order"`
}

// UpdateEdgeRequest updates an existing edge.
type UpdateEdgeRequest struct {
	SourceID  uuid.UUID       `json:"source_id"`
	TargetID  uuid.UUID       `json:"target_id"`
	Condition json.RawMessage `json:"condition,omitempty"`
	Label     *string         `json:"label,omitempty"`
	SortOrder int32           `json:"sort_order"`
}

// MigrateFlowRequest carries legacy phases for migration to flow graph.
type MigrateFlowRequest struct {
	Phases []map[string]any `json:"phases"`
}
