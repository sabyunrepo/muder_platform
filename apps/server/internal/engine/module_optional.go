package engine

import (
	"context"

	"github.com/google/uuid"
)

// GameEventHandler is implemented by plugins that need to validate and apply
// incoming game events. The engine type-asserts this interface at runtime;
// plugins that do not handle events simply omit it.
type GameEventHandler interface {
	// Validate checks whether the event is legal in the current game state.
	// Returns a non-nil error if the event must be rejected.
	Validate(ctx context.Context, event GameEvent, state GameState) error

	// Apply mutates game state in response to the event.
	// Called only after Validate returns nil.
	Apply(ctx context.Context, event GameEvent, state *GameState) error
}

// WinChecker is implemented by plugins that define win conditions.
// The engine calls CheckWin after every Apply; the first non-zero WinResult
// ends the game.
type WinChecker interface {
	// CheckWin evaluates whether a win condition has been met.
	// Returns a WinResult with Won=true when the game should end.
	CheckWin(ctx context.Context, state GameState) (WinResult, error)
}

// PhaseHookPlugin is implemented by plugins that need to react to phase
// transitions. OnPhaseEnter is called after the engine enters a new phase;
// OnPhaseExit is called before the engine leaves a phase.
type PhaseHookPlugin interface {
	// OnPhaseEnter is called when the session transitions into phase.
	OnPhaseEnter(ctx context.Context, phase Phase) error

	// OnPhaseExit is called just before the session leaves phase.
	OnPhaseExit(ctx context.Context, phase Phase) error
}

// SerializablePlugin is implemented by plugins that need to persist and
// restore their internal state (e.g. for reconnects and snapshots).
type SerializablePlugin interface {
	// BuildState serialises the plugin's current runtime state into a
	// GameState entry. The result is stored under the plugin's ID key.
	BuildState(ctx context.Context) (GameState, error)

	// RestoreState deserialises a previously persisted state back into
	// the plugin's runtime representation.
	RestoreState(ctx context.Context, playerID uuid.UUID, state GameState) error
}

// RuleProvider is implemented by plugins that expose evaluable game rules.
// The rule editor uses these to let authors reference plugin rules in
// JSON Logic expressions without hard-coding IDs.
type RuleProvider interface {
	// GetRules returns the set of rules this plugin contributes.
	GetRules() []Rule
}
