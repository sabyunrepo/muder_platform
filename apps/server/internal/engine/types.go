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
	ActionDeliverInformation  PhaseAction = "DELIVER_INFORMATION"
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
	ActionDeliverInformation:  "information_delivery",
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

// PlayerAwareModule is an interface for modules that must redact or shape
// their state on a per-player basis (role-private data, whispers, per-player
// clues, etc.).
//
// PR-2a (Phase 19, F-sec-2): Every registered module MUST implement this
// interface OR explicitly declare itself as public-state via PublicStateModule
// (embed engine.PublicStateMarker). The registry enforces this at init() time
// so module authors cannot silently fall back to BuildState for data that
// should be per-player redacted.
//
// Implementations MUST NOT include any data the given player is not entitled
// to see — this is the trust boundary for Phase 18.1 B-2 (snapshot redaction).
type PlayerAwareModule interface {
	// BuildStateFor returns the module state as visible to the given player.
	BuildStateFor(playerID uuid.UUID) (json.RawMessage, error)
}

// PublicStateModule is a sentinel marker declaring that a module's state is
// intentionally identical for every player (no per-player redaction required).
// Modules with truly public state (room meta, audio cues, phase index, etc.)
// embed engine.PublicStateMarker to satisfy this interface and pass the
// PR-2a gate without implementing BuildStateFor.
//
// The sole method is unexported on purpose: only types that embed
// PublicStateMarker can satisfy PublicStateModule, preventing external
// packages from forging the opt-out by defining their own stub method.
type PublicStateModule interface {
	isPublicState()
}

// PublicStateMarker is the helper type module authors embed to satisfy
// PublicStateModule from outside the engine package.
//
//	type RoomModule struct {
//	    engine.PublicStateMarker
//	    // ...fields
//	}
//
// Embedding this marker is an explicit, auditable declaration that the
// module's BuildState() output is safe to broadcast to every player.
type PublicStateMarker struct{}

// isPublicState satisfies PublicStateModule. Never call directly.
func (PublicStateMarker) isPublicState() {}

// BuildModuleStateFor returns the player-aware state for a module.
//
// Gate hierarchy (PR-2a / Phase 19.1 PR-A):
//  1. If the module implements PlayerAwareModule → BuildStateFor is called.
//  2. Else the module MUST implement PublicStateModule (engine.PublicStateMarker
//     embed) — BuildState is called because the author has explicitly declared
//     that the state is identical for every player.
//
// The env-driven escape hatch (MMP_PLAYERAWARE_STRICT) has been retired: any
// module that satisfies neither interface would have been rejected by
// Register() at init time. The BuildState() fallback below therefore runs
// only against explicitly-public modules; it is NOT a safety net for
// accidental leakage.
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

// PlayerRuntimeInfo is the minimal, session-owned player metadata that modules
// may need to validate player-targeted actions without owning the full session
// roster.
type PlayerRuntimeInfo struct {
	PlayerID   uuid.UUID
	TargetCode string
	Role       string
	IsAlive    bool
}

// PlayerInfoProvider resolves runtime player metadata for modules that must
// validate action targets against the current session roster. Modules must
// tolerate a nil provider for legacy sessions that do not expose roster data.
type PlayerInfoProvider interface {
	ResolvePlayerID(ctx context.Context, targetCode string) (uuid.UUID, bool)
	PlayerRuntimeInfo(ctx context.Context, playerID uuid.UUID) (PlayerRuntimeInfo, bool)
}

// ModuleDeps provides session-scoped dependencies to modules.
type ModuleDeps struct {
	SessionID          uuid.UUID
	EventBus           *EventBus
	Logger             Logger
	PlayerInfoProvider PlayerInfoProvider
}

// ModuleFactory creates a new module instance per session (no singletons).
type ModuleFactory func() Module
