package flow

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/google/uuid"

	"github.com/mmp-platform/server/internal/apperror"
)

// MigratePhases converts legacy config_json.phases array to flow_nodes + flow_edges.
// phases: [{"type":"investigation","label":"조사","duration":20,"rounds":1}, ...]
// Idempotent: deletes existing flow data before inserting.
func (s *serviceImpl) MigratePhases(ctx context.Context, themeID uuid.UUID, phases []map[string]any) error {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return apperror.Internal("failed to begin transaction")
	}
	defer tx.Rollback(ctx) //nolint:errcheck

	// 1. Delete existing flow data (idempotent)
	if _, err := tx.Exec(ctx, `DELETE FROM flow_edges WHERE theme_id = $1`, themeID); err != nil {
		return apperror.Internal("failed to clear edges")
	}
	if _, err := tx.Exec(ctx, `DELETE FROM flow_nodes WHERE theme_id = $1`, themeID); err != nil {
		return apperror.Internal("failed to clear nodes")
	}

	// 2. Create Start node at (0, 200)
	startData, _ := json.Marshal(map[string]string{"label": "시작"})
	startNode, err := insertNode(ctx, tx, themeID, NodeTypeStart, startData, 0, 200)
	if err != nil {
		return fmt.Errorf("insert start node: %w", err)
	}

	if len(phases) == 0 {
		return tx.Commit(ctx)
	}

	// 3. Create Phase nodes at x = i*250+250, y = 200
	phaseNodes := make([]uuid.UUID, 0, len(phases))
	for i, p := range phases {
		data, _ := json.Marshal(p)
		x := float64(i)*250 + 250
		node, err := insertNode(ctx, tx, themeID, NodeTypePhase, data, x, 200)
		if err != nil {
			return fmt.Errorf("insert phase node %d: %w", i, err)
		}
		phaseNodes = append(phaseNodes, node.ID)
	}

	// 4. Start → first Phase edge
	if _, err := insertEdge(ctx, tx, themeID, startNode.ID, phaseNodes[0], nil, nil, 0); err != nil {
		return fmt.Errorf("insert start edge: %w", err)
	}

	// 5. phases[i] → phases[i+1] edges
	for i := 0; i < len(phaseNodes)-1; i++ {
		if _, err := insertEdge(ctx, tx, themeID, phaseNodes[i], phaseNodes[i+1], nil, nil, int32(i+1)); err != nil {
			return fmt.Errorf("insert edge %d: %w", i, err)
		}
	}

	return tx.Commit(ctx)
}
