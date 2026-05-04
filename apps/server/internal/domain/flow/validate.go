package flow

import (
	"encoding/json"

	"github.com/google/uuid"
	"github.com/mmp-platform/server/internal/apperror"
	"github.com/mmp-platform/server/internal/engine"
)

// ValidateDAG validates the flow graph: exactly one start node and no cycles.
func ValidateDAG(nodes []FlowNode, edges []FlowEdge) error {
	startCount := 0
	for _, n := range nodes {
		if n.Type == NodeTypeStart {
			startCount++
		}
	}
	if startCount == 0 {
		return apperror.BadRequest("flow graph must have exactly one start node")
	}
	if startCount > 1 {
		return apperror.BadRequest("flow graph must have exactly one start node")
	}

	// Build adjacency list
	adj := make(map[uuid.UUID][]uuid.UUID, len(nodes))
	for _, n := range nodes {
		adj[n.ID] = nil
	}
	for _, e := range edges {
		adj[e.SourceID] = append(adj[e.SourceID], e.TargetID)
	}

	// DFS cycle detection
	const (
		unvisited = 0
		inStack   = 1
		done      = 2
	)
	state := make(map[uuid.UUID]int, len(nodes))

	var dfs func(id uuid.UUID) bool
	dfs = func(id uuid.UUID) bool {
		state[id] = inStack
		for _, next := range adj[id] {
			switch state[next] {
			case inStack:
				return true // cycle found
			case unvisited:
				if dfs(next) {
					return true
				}
			}
		}
		state[id] = done
		return false
	}

	for _, n := range nodes {
		if state[n.ID] == unvisited {
			if dfs(n.ID) {
				return apperror.BadRequest("flow graph contains a cycle")
			}
		}
	}
	return nil
}

// ValidateNodeType returns an error if the node type is not recognised.
func ValidateNodeType(t string) error {
	switch t {
	case NodeTypeStart, NodeTypePhase, NodeTypeBranch, NodeTypeEnding:
		return nil
	default:
		return apperror.BadRequest("invalid node type: " + t)
	}
}

func ValidateEdgeCondition(condition json.RawMessage) error {
	if len(condition) == 0 || string(condition) == "null" {
		return nil
	}
	if _, err := engine.ParseConditionGroup(condition); err != nil {
		return apperror.BadRequest("invalid edge condition: " + err.Error())
	}
	return nil
}
