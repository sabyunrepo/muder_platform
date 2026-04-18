package combination

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/google/uuid"
	"github.com/mmp-platform/server/internal/clue"
	"github.com/mmp-platform/server/internal/engine"
)

// HandleMessage processes player actions routed to this module.
func (m *CombinationModule) HandleMessage(ctx context.Context, playerID uuid.UUID, msgType string, payload json.RawMessage) error {
	switch msgType {
	case "combine":
		return m.handleCombine(ctx, playerID, payload)
	default:
		return fmt.Errorf("combination: unknown message type %q", msgType)
	}
}

type combinePayload struct {
	EvidenceIDs []string `json:"evidence_ids"`
	// GroupID (Phase 20 PR-5) lets the editor-driven client match a specific
	// clue_edge_groups row directly instead of relying on set equality over
	// InputIDs. Optional: empty string falls back to the legacy set match.
	GroupID string `json:"group_id,omitempty"`
}

func (m *CombinationModule) handleCombine(_ context.Context, playerID uuid.UUID, payload json.RawMessage) error {
	var p combinePayload
	if err := json.Unmarshal(payload, &p); err != nil {
		return fmt.Errorf("combination: invalid combine payload: %w", err)
	}
	if len(p.EvidenceIDs) == 0 {
		return fmt.Errorf("combination: combine requires at least one evidence_id")
	}

	m.mu.Lock()
	defer m.mu.Unlock()

	// Find a matching combination def.
	combo, err := m.findCombo(p)
	if err != nil {
		return err
	}

	// Verify player has all input evidence.
	for _, inputID := range combo.InputIDs {
		if !m.collected[playerID][inputID] {
			return fmt.Errorf("combination: invalid combine: missing evidence %q", inputID)
		}
	}

	// Check not already completed.
	if m.hasCompleted(playerID, combo.ID) {
		return nil // idempotent
	}

	m.completed[playerID] = append(m.completed[playerID], combo.ID)
	m.derived[playerID] = append(m.derived[playerID], combo.OutputClueID)

	m.deps.EventBus.Publish(engine.Event{
		Type: "combination.completed",
		Payload: map[string]any{
			"playerID":      playerID,
			"combinationID": combo.ID,
		},
	})
	m.deps.EventBus.Publish(engine.Event{
		Type: "combination.clue_unlocked",
		Payload: map[string]any{
			"playerID":     playerID,
			"outputClueID": combo.OutputClueID,
		},
	})
	return nil
}

// findCombo resolves a CombinationDef for a combine payload.
//
// Match order (Phase 20 PR-5):
//  1. If p.GroupID is set, look up comboByID directly — the group_id shortcut
//     is O(1) and authoritative when the editor-sourced identifier is known.
//  2. Otherwise fall back to InputIDs set equality for backward compatibility
//     with legacy clients that do not carry GroupID yet.
func (m *CombinationModule) findCombo(p combinePayload) (CombinationDef, error) {
	if p.GroupID != "" {
		combo, ok := m.comboByID[p.GroupID]
		if !ok {
			return CombinationDef{}, fmt.Errorf("combination: unknown group_id %q", p.GroupID)
		}
		if !inputIDsMatch(combo.InputIDs, p.EvidenceIDs) {
			return CombinationDef{}, fmt.Errorf("combination: evidence_ids do not match group %q", p.GroupID)
		}
		return combo, nil
	}

	for _, c := range m.comboByID {
		if inputIDsMatch(c.InputIDs, p.EvidenceIDs) {
			return c, nil
		}
	}
	return CombinationDef{}, fmt.Errorf("combination: no combination matches the provided evidence")
}

// inputIDsMatch reports whether two ID slices carry exactly the same set
// (order-insensitive, size-sensitive).
func inputIDsMatch(want, got []string) bool {
	if len(want) != len(got) {
		return false
	}
	set := make(map[string]bool, len(got))
	for _, id := range got {
		set[id] = true
	}
	for _, id := range want {
		if !set[id] {
			return false
		}
	}
	return true
}

func (m *CombinationModule) hasCompleted(playerID uuid.UUID, comboID string) bool {
	for _, id := range m.completed[playerID] {
		if id == comboID {
			return true
		}
	}
	return false
}

// checkNewCombos resolves available combinations for a player and publishes events.
// Must be called without m.mu held (acquires RLock internally).
func (m *CombinationModule) checkNewCombos(playerID uuid.UUID) {
	m.mu.RLock()
	discovered := m.collectedAsClueMap(playerID)
	crafted := m.craftedAsClueMap(playerID)
	m.mu.RUnlock()

	// Phase 20 PR-5: `crafted` is the set of combination outputs already
	// unlocked by a successful combine event. Graph.Resolve returns the union
	// of discovered + crafted + any AUTO-trigger targets whose prerequisites
	// fall within that union — CRAFT-trigger outputs stay hidden until they
	// transition into `crafted` via handleCombine.
	available := m.graph.Resolve(discovered, crafted)
	for _, c := range available {
		// Notify only newly-resolvable output clues (those that have prerequisites).
		if _, hasDep := m.graph.DependenciesOf(c.ID); hasDep {
			m.deps.EventBus.Publish(engine.Event{
				Type: "combination.available",
				Payload: map[string]any{
					"playerID": playerID,
					"clueID":   string(c.ID),
				},
			})
		}
	}
}

func (m *CombinationModule) collectedAsClueMap(playerID uuid.UUID) map[clue.ClueID]bool {
	result := make(map[clue.ClueID]bool, len(m.collected[playerID]))
	for id := range m.collected[playerID] {
		result[clue.ClueID(id)] = true
	}
	return result
}

// craftedAsClueMap returns the player's derived (combine-unlocked) clue IDs
// as a clue.ClueID set. Used by graph.Resolve to honour CRAFT triggers.
func (m *CombinationModule) craftedAsClueMap(playerID uuid.UUID) map[clue.ClueID]bool {
	ids := m.derived[playerID]
	result := make(map[clue.ClueID]bool, len(ids))
	for _, id := range ids {
		result[clue.ClueID(id)] = true
	}
	return result
}
