package engine

import (
	"encoding/json"
	"time"

	"github.com/google/uuid"
)

// GameEvent is a domain event produced or consumed by a Module.
// The payload is kept as raw JSON so modules can decode into their own types.
type GameEvent struct {
	ID        uuid.UUID       `json:"id"`
	SessionID uuid.UUID       `json:"sessionId"`
	Type      string          `json:"type"`
	Timestamp time.Time       `json:"timestamp"`
	Payload   json.RawMessage `json:"payload,omitempty"`
}

// GameState holds the full serialisable state of a running game session.
// Each Module contributes a slice of raw JSON keyed by its ID.
//
// CurrentRound (Phase 20 PR-5) is the game's monotonic round counter — it
// starts at 1 when the engine starts and increments once per AdvancePhase
// call. Modules consult this to filter clue/location visibility against
// reveal_round/hide_round and from_round/until_round.
type GameState struct {
	SessionID    uuid.UUID                  `json:"sessionId"`
	Phase        string                     `json:"phase"`
	CurrentRound int32                      `json:"currentRound"`
	Modules      map[string]json.RawMessage `json:"modules,omitempty"`
}

// Phase is a named step in the game flow (e.g. "introduction", "voting").
type Phase string

// PhaseDefinition describes a phase: its identifier, display name, and optional
// transition rules expressed as JSON Logic payloads.
type PhaseDefinition struct {
	ID          Phase  `json:"id"`
	Name        string `json:"name"`
	Description string `json:"description,omitempty"`
	// OnEnter is an optional JSON Logic rule evaluated when entering this phase.
	OnEnter json.RawMessage `json:"onEnter,omitempty"`
	// OnExit is an optional JSON Logic rule evaluated when leaving this phase.
	OnExit json.RawMessage `json:"onExit,omitempty"`
}

// WinResult carries the outcome of a win-condition check.
type WinResult struct {
	// Won is true when a win condition was triggered.
	Won bool `json:"won"`
	// WinnerIDs contains the UUIDs of winning players (may be empty for draws).
	WinnerIDs []uuid.UUID `json:"winnerIds,omitempty"`
	// Reason is a human-readable description of why the condition fired.
	Reason string `json:"reason,omitempty"`
	// Extra holds plugin-specific result data (e.g. revealed roles).
	Extra json.RawMessage `json:"extra,omitempty"`
}

// Rule represents a single evaluable game rule expressed as JSON Logic.
type Rule struct {
	// ID uniquely identifies the rule within a Module.
	ID string `json:"id"`
	// Description is a human-readable label shown in the editor.
	Description string `json:"description,omitempty"`
	// Logic is a JSON Logic expression (https://jsonlogic.com/).
	Logic json.RawMessage `json:"logic"`
}
