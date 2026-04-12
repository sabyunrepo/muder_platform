package engine

import (
	"context"

	"github.com/google/uuid"
)

// GameEventHandler is implemented by modules that need to validate and apply
// incoming game events. The engine type-asserts this interface at runtime;
// modules that do not handle events simply omit it.
type GameEventHandler interface {
	// Validate checks whether the event is legal in the current game state.
	// Returns a non-nil error if the event must be rejected.
	Validate(ctx context.Context, event GameEvent, state GameState) error

	// Apply mutates game state in response to the event.
	// Called only after Validate returns nil.
	Apply(ctx context.Context, event GameEvent, state *GameState) error
}

// WinChecker is implemented by modules that define win conditions.
// The engine calls CheckWin after every Apply; the first non-zero WinResult
// ends the game.
type WinChecker interface {
	// CheckWin evaluates whether a win condition has been met.
	// Returns a WinResult with Won=true when the game should end.
	CheckWin(ctx context.Context, state GameState) (WinResult, error)
}

// PhaseHookModule is implemented by modules that need to react to phase
// transitions. OnPhaseEnter is called after the engine enters a new phase;
// OnPhaseExit is called before the engine leaves a phase.
type PhaseHookModule interface {
	// OnPhaseEnter is called when the session transitions into phase.
	OnPhaseEnter(ctx context.Context, phase Phase) error

	// OnPhaseExit is called just before the session leaves phase.
	OnPhaseExit(ctx context.Context, phase Phase) error
}

// SerializableModule is implemented by modules that need to persist and
// restore their internal state (e.g. for reconnects and snapshots).
type SerializableModule interface {
	// SaveState serialises the module's current runtime state into a
	// GameState entry for persistence (reconnects, snapshots).
	SaveState(ctx context.Context) (GameState, error)

	// RestoreState deserialises a previously persisted state back into
	// the module's runtime representation.
	RestoreState(ctx context.Context, playerID uuid.UUID, state GameState) error
}

// RuleProvider is implemented by modules that expose evaluable game rules.
// The rule editor uses these to let authors reference plugin rules in
// JSON Logic expressions without hard-coding IDs.
type RuleProvider interface {
	// GetRules returns the set of rules this plugin contributes.
	GetRules() []Rule
}
