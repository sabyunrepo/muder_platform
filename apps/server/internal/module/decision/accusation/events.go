package accusation

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/mmp-platform/server/internal/engine"
)

// --- GameEventHandler ---

type accuseEventPayload struct {
	PlayerID   string `json:"playerId"`
	TargetCode string `json:"targetCode"`
	TargetID   string `json:"targetId,omitempty"`
	Guilty     *bool  `json:"guilty,omitempty"` // for accusation:vote events
}

// Validate checks whether an accuse / vote event is legal.
func (m *AccusationModule) Validate(_ context.Context, event engine.GameEvent, _ engine.GameState) error {
	switch event.Type {
	case "accusation:accuse":
		var p accuseEventPayload
		if err := json.Unmarshal(event.Payload, &p); err != nil {
			return fmt.Errorf("accusation: invalid event payload: %w", err)
		}
		if p.PlayerID == "" {
			return fmt.Errorf("accusation: playerId is required")
		}
		if p.TargetCode == "" {
			return fmt.Errorf("accusation: targetCode is required")
		}
		m.mu.RLock()
		hasActive := m.activeAccusation != nil
		countReached := m.accusationCount >= m.config.MaxPerRound
		m.mu.RUnlock()
		if hasActive {
			return fmt.Errorf("accusation: an accusation is already active")
		}
		if countReached {
			return fmt.Errorf("accusation: max accusations per round (%d) reached", m.config.MaxPerRound)
		}
		return nil

	case "accusation:vote":
		var p accuseEventPayload
		if err := json.Unmarshal(event.Payload, &p); err != nil {
			return fmt.Errorf("accusation: invalid event payload: %w", err)
		}
		if p.PlayerID == "" {
			return fmt.Errorf("accusation: playerId is required")
		}
		m.mu.RLock()
		acc := m.activeAccusation
		m.mu.RUnlock()
		if acc == nil {
			return fmt.Errorf("accusation: no active accusation")
		}
		playerID, err := uuid.Parse(p.PlayerID)
		if err != nil {
			return fmt.Errorf("accusation: invalid playerId: %w", err)
		}
		if playerID == acc.AccuserID {
			return fmt.Errorf("accusation: accuser cannot vote")
		}
		if playerID == acc.AccusedID {
			return fmt.Errorf("accusation: accused cannot vote on own accusation")
		}
		return nil

	default:
		return fmt.Errorf("accusation: unsupported event type %q", event.Type)
	}
}

// Apply records the event's effect on module / game state.
func (m *AccusationModule) Apply(_ context.Context, event engine.GameEvent, state *engine.GameState) error {
	switch event.Type {
	case "accusation:accuse":
		var p accuseEventPayload
		if err := json.Unmarshal(event.Payload, &p); err != nil {
			return fmt.Errorf("accusation: apply: invalid payload: %w", err)
		}
		playerID, err := uuid.Parse(p.PlayerID)
		if err != nil {
			return fmt.Errorf("accusation: apply: invalid playerId: %w", err)
		}
		var targetID uuid.UUID
		if p.TargetID != "" {
			targetID, err = uuid.Parse(p.TargetID)
			if err != nil {
				return fmt.Errorf("accusation: apply: invalid targetId: %w", err)
			}
		}
		deadline := m.timeNow().Add(time.Duration(m.config.DefenseTime) * time.Second)
		m.mu.Lock()
		m.activeAccusation = &Accusation{
			AccuserID:       playerID,
			AccusedID:       targetID,
			AccusedCode:     p.TargetCode,
			DefenseDeadline: deadline,
			Votes:           make(map[uuid.UUID]bool),
		}
		m.accusationCount++
		m.isActive = true
		m.mu.Unlock()

	case "accusation:vote":
		var p accuseEventPayload
		if err := json.Unmarshal(event.Payload, &p); err != nil {
			return fmt.Errorf("accusation: apply: invalid payload: %w", err)
		}
		playerID, err := uuid.Parse(p.PlayerID)
		if err != nil {
			return fmt.Errorf("accusation: apply: invalid playerId: %w", err)
		}
		guilty := p.Guilty != nil && *p.Guilty
		m.mu.Lock()
		if m.activeAccusation != nil {
			m.activeAccusation.Votes[playerID] = guilty
		}
		m.mu.Unlock()
	}

	data, err := m.BuildState()
	if err != nil {
		return fmt.Errorf("accusation: apply: build state: %w", err)
	}
	if state.Modules == nil {
		state.Modules = make(map[string]json.RawMessage)
	}
	state.Modules[m.Name()] = data
	return nil
}

// --- WinChecker ---

// CheckWin fires when the expelled player was the culprit.
func (m *AccusationModule) CheckWin(_ context.Context, state engine.GameState) (engine.WinResult, error) {
	raw, ok := state.Modules[m.Name()]
	if !ok {
		return engine.WinResult{Won: false}, nil
	}

	var s accusationState
	if err := json.Unmarshal(raw, &s); err != nil {
		return engine.WinResult{}, fmt.Errorf("accusation: check win: %w", err)
	}

	// Win condition: an accusation was resolved and expelled player matches culprit.
	// The culprit code is stored in the state when expulsion occurs.
	if s.ExpelledCode == "" || !s.ExpelledIsCulprit {
		return engine.WinResult{Won: false}, nil
	}

	return engine.WinResult{
		Won:    true,
		Reason: fmt.Sprintf("accusation: player %q correctly identified as culprit", s.ExpelledCode),
	}, nil
}
