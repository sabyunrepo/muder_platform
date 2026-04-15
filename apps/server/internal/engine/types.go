package engine

import (
	"context"
	"encoding/json"

	"github.com/google/uuid"
)

// PhaseAction represents a side-effect triggered during phase transitions.
// Modules implement PhaseReactor to respond to these actions (OCP).
type PhaseAction string

const (
	ActionResetDrawCount      PhaseAction = "RESET_DRAW_COUNT"
	ActionResetFloorSelection PhaseAction = "RESET_FLOOR_SELECTION"
	ActionSetClueLevel        PhaseAction = "SET_CLUE_LEVEL"
	ActionOpenVoting          PhaseAction = "OPEN_VOTING"
	ActionCloseVoting         PhaseAction = "CLOSE_VOTING"
	ActionAllowExchange       PhaseAction = "ALLOW_EXCHANGE"
	ActionBroadcastMessage    PhaseAction = "BROADCAST_MESSAGE"
	ActionPlaySound           PhaseAction = "PLAY_SOUND"
	ActionPlayMedia           PhaseAction = "PLAY_MEDIA"
	ActionSetBGM              PhaseAction = "SET_BGM"
	ActionStopAudio           PhaseAction = "STOP_AUDIO"
	ActionMuteChat            PhaseAction = "MUTE_CHAT"
	ActionUnmuteChat          PhaseAction = "UNMUTE_CHAT"
	ActionOpenGroupChat       PhaseAction = "OPEN_GROUP_CHAT"
	ActionCloseGroupChat      PhaseAction = "CLOSE_GROUP_CHAT"
	ActionLockModule          PhaseAction = "LOCK_MODULE"
	ActionUnlockModule        PhaseAction = "UNLOCK_MODULE"
)

// PhaseActionPayload carries action-specific data.
type PhaseActionPayload struct {
	Action PhaseAction     `json:"action"`
	Target string          `json:"target,omitempty"`
	Params json.RawMessage `json:"params,omitempty"`
}

// PhaseInfo holds the runtime state of the current phase.
type PhaseInfo struct {
	ID       string          `json:"id"`
	Name     string          `json:"name"`
	Type     string          `json:"type"`
	Index    int             `json:"index"`
	Duration int             `json:"duration"`
	Elapsed  int             `json:"elapsed"`
	State    json.RawMessage `json:"state,omitempty"`
}

// ActionRequiresModule maps PhaseActions to the module that must be enabled.
// Actions not in this map are module-independent (e.g. BROADCAST_MESSAGE).
var ActionRequiresModule = map[PhaseAction]string{
	ActionResetDrawCount:      "clue_interaction",
	ActionResetFloorSelection: "floor_exploration",
	ActionSetClueLevel:        "clue_interaction",
	ActionOpenVoting:          "voting",
	ActionCloseVoting:         "voting",
	ActionAllowExchange:       "trade_clue",
	ActionMuteChat:            "text_chat",
	ActionUnmuteChat:          "text_chat",
	ActionOpenGroupChat:       "group_chat",
	ActionCloseGroupChat:      "group_chat",
}

// --- Module Interfaces ---

// Module is the core interface all game modules must implement.
type Module interface {
	// Name returns the unique module identifier.
	Name() string

	// Init initializes the module with session context and config.
	Init(ctx context.Context, deps ModuleDeps, config json.RawMessage) error

	// BuildState returns the module's current state for client sync.
	BuildState() (json.RawMessage, error)

	// HandleMessage processes a player action routed to this module.
	HandleMessage(ctx context.Context, playerID uuid.UUID, msgType string, payload json.RawMessage) error

	// Cleanup releases resources when the session ends.
	Cleanup(ctx context.Context) error
}

// PlayerAwareModule is an optional interface for modules that must redact
// or shape their state on a per-player basis (role-private data, whispers,
// per-player clues, etc.). Modules that do NOT implement this interface are
// assumed to have public state; BuildModuleStateFor falls back to BuildState.
//
// Implementations MUST NOT include any data the given player is not entitled
// to see — this is the trust boundary for Phase 18.1 B-2 (snapshot redaction).
type PlayerAwareModule interface {
	// BuildStateFor returns the module state as visible to the given player.
	BuildStateFor(playerID uuid.UUID) (json.RawMessage, error)
}

// BuildModuleStateFor returns the player-aware state for a module.
// If the module implements PlayerAwareModule, its redacted state is returned;
// otherwise the public BuildState() is used.
func BuildModuleStateFor(m Module, playerID uuid.UUID) (json.RawMessage, error) {
	if pam, ok := m.(PlayerAwareModule); ok {
		return pam.BuildStateFor(playerID)
	}
	return m.BuildState()
}

// PhaseReactor is an optional interface for modules that respond to PhaseActions.
// Only modules that need to react to phase transitions implement this.
type PhaseReactor interface {
	// ReactTo handles a PhaseAction dispatched by the engine.
	ReactTo(ctx context.Context, action PhaseActionPayload) error

	// SupportedActions returns the set of PhaseActions this module handles.
	SupportedActions() []PhaseAction
}

// ConfigSchema is an optional interface for modules that expose their settings schema.
// Used by the editor to auto-generate UI.
type ConfigSchema interface {
	// Schema returns the JSON Schema for this module's settings.
	Schema() json.RawMessage
}

// Logger is the logging interface used throughout the engine package.
type Logger interface {
	Printf(format string, v ...any)
}

// ModuleDeps provides session-scoped dependencies to modules.
type ModuleDeps struct {
	SessionID uuid.UUID
	EventBus  *EventBus
	Logger    Logger
}

// ModuleFactory creates a new module instance per session (no singletons).
type ModuleFactory func() Module
