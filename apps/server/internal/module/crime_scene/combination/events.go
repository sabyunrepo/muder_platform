package combination

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/google/uuid"
	"github.com/mmp-platform/server/internal/engine"
)

// --- GameEventHandler ---

// Validate checks whether a combine event is legal.
func (m *CombinationModule) Validate(_ context.Context, event engine.GameEvent, _ engine.GameState) error {
	if event.Type != "combination.combine" {
		return nil
	}
	var p combinePayload
	if err := json.Unmarshal(event.Payload, &p); err != nil {
		return fmt.Errorf("combination: invalid payload: %w", err)
	}
	m.mu.RLock()
	_, err := m.findCombo(p)
	m.mu.RUnlock()
	return err
}

// Apply records a completed combination in response to a validated event.
func (m *CombinationModule) Apply(_ context.Context, event engine.GameEvent, _ *engine.GameState) error {
	if event.Type != "combination.combine" {
		return nil
	}
	var p combinePayload
	if err := json.Unmarshal(event.Payload, &p); err != nil {
		return fmt.Errorf("combination: apply: %w", err)
	}
	m.mu.Lock()
	combo, err := m.findCombo(p)
	if err != nil {
		m.mu.Unlock()
		return err
	}
	if !m.hasCompleted(event.SessionID, combo.ID) {
		m.completed[event.SessionID] = append(m.completed[event.SessionID], combo.ID)
		m.derived[event.SessionID] = append(m.derived[event.SessionID], combo.OutputClueID)
	}
	m.mu.Unlock()
	return nil
}

// --- WinChecker ---

// CheckWin returns Won=true when the player holds all evidence in WinCombo.
func (m *CombinationModule) CheckWin(_ context.Context, state engine.GameState) (engine.WinResult, error) {
	if len(m.config.WinCombo) == 0 {
		return engine.WinResult{}, nil
	}

	m.mu.RLock()
	defer m.mu.RUnlock()

	for playerID, evMap := range m.collected {
		won := true
		for _, need := range m.config.WinCombo {
			if !evMap[need] {
				won = false
				break
			}
		}
		if won {
			return engine.WinResult{
				Won:       true,
				WinnerIDs: []uuid.UUID{playerID},
				Reason:    "combination: player collected all required evidence",
			}, nil
		}
	}
	_ = state
	return engine.WinResult{}, nil
}

// --- RuleProvider ---

// GetRules returns the rules contributed by this module.
func (m *CombinationModule) GetRules() []engine.Rule {
	logic, _ := json.Marshal(map[string]any{
		"some": []any{
			map[string]any{"var": "player.combinations"},
			map[string]any{"==": []any{map[string]any{"var": ""}, map[string]any{"var": "combination.targetID"}}},
		},
	})
	return []engine.Rule{
		{
			ID:          "has_combination",
			Description: "Player has completed the target combination",
			Logic:       logic,
		},
	}
}
