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
// backend action payloads to dispatch when entering or leaving the phase.
type PhaseDefinition struct {
	ID          Phase  `json:"id"`
	Name        string `json:"name"`
	Description string `json:"description,omitempty"`
	// OnEnter is an optional configured action payload dispatched by the engine.
	OnEnter json.RawMessage `json:"onEnter,omitempty"`
	// OnExit is an optional configured action payload dispatched by the engine.
	OnExit json.RawMessage `json:"onExit,omitempty"`
	// DiscussionRoomPolicy is the creator-authored room policy for this scene.
	// PhaseEngine dispatches it to the group_chat runtime on phase enter so the
	// backend remains the final source of truth for room access.
	DiscussionRoomPolicy *DiscussionRoomPolicy `json:"discussionRoomPolicy,omitempty"`
}

type DiscussionRoomPolicy struct {
	Enabled             bool            `json:"enabled"`
	MainRoomName        string          `json:"mainRoomName,omitempty"`
	PrivateRoomsEnabled bool            `json:"privateRoomsEnabled,omitempty"`
	PrivateRoomName     string          `json:"privateRoomName,omitempty"`
	Availability        string          `json:"availability,omitempty"`
	ConditionalRoomName string          `json:"conditionalRoomName,omitempty"`
	Condition           json.RawMessage `json:"condition,omitempty"`
}

// SceneTransition is the backend runtime contract for graph-based story
// movement. Frontend Flow data may author these edges, but PhaseEngine is the
// source of truth for condition evaluation and the final phase mutation.
type SceneTransition struct {
	ID        string          `json:"id,omitempty"`
	From      Phase           `json:"from"`
	To        Phase           `json:"to"`
	Label     string          `json:"label,omitempty"`
	SortOrder int32           `json:"sortOrder,omitempty"`
	Condition json.RawMessage `json:"condition,omitempty"`
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
