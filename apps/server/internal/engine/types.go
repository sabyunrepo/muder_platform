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
	Action  PhaseAction     `json:"action"`
	Target  string          `json:"target,omitempty"`  // target module name
	Params  json.RawMessage `json:"params,omitempty"`  // action-specific params
}

// PhaseConfig defines a single phase in configJson.phases[].
type PhaseConfig struct {
	ID             string                `json:"id"`
	Name           string                `json:"name"`
	Type           string                `json:"type"`                     // e.g. "discussion", "investigation", "voting"
	Duration       int                   `json:"duration,omitempty"`       // seconds, 0 = unlimited
	BGMId          string                `json:"bgmId,omitempty"`          // phase-level BGM (auto SET_BGM on enter)
	ReadingSection *ReadingSectionConfig `json:"readingSection,omitempty"` // optional reading dialogue section
	OnEnter        []PhaseActionPayload  `json:"onEnter,omitempty"`
	OnExit         []PhaseActionPayload  `json:"onExit,omitempty"`
	Triggers       []TriggerConfig       `json:"triggers,omitempty"`    // Hybrid/Event용
	NextPhaseID    string                `json:"nextPhaseId,omitempty"` // Event용 (비선형)
}

// ReadingSectionConfig describes an optional reading (dialogue) section inside a phase.
// When present, the ReadingModule takes over and the BGMId here overrides phase BGM.
type ReadingSectionConfig struct {
	BGMId string `json:"bgmId,omitempty"`
}

// TriggerConfig defines a conditional trigger for Hybrid/Event strategies.
type TriggerConfig struct {
	Type      string          `json:"type"`      // "timer", "consensus", "event"
	Condition json.RawMessage `json:"condition"` // strategy-specific
	TargetID  string          `json:"targetId"`  // target phase ID
}

// PhaseInfo holds the runtime state of the current phase.
type PhaseInfo struct {
	ID        string          `json:"id"`
	Name      string          `json:"name"`
	Type      string          `json:"type"`
	Index     int             `json:"index"`
	Duration  int             `json:"duration"`
	Elapsed   int             `json:"elapsed"`
	State     json.RawMessage `json:"state,omitempty"`
}

// GameConfig represents the parsed configJson from a theme.
type GameConfig struct {
	Strategy    string          `json:"strategy"` // "script", "hybrid", "event"
	GmMode      string          `json:"gmMode"`   // "REQUIRED", "NONE", "OPTIONAL"
	Phases      []PhaseConfig   `json:"phases"`
	Modules     []ModuleConfig  `json:"modules"`
	MediaAssets []MediaAsset    `json:"mediaAssets,omitempty"` // media asset catalog for reference validation
	Settings    json.RawMessage `json:"settings,omitempty"`
}

// MediaAsset is a minimal media catalog entry included in configJson for validation.
// Populated on theme publish from theme_media; used by validators to check bgmId references.
type MediaAsset struct {
	ID       string `json:"id"`                 // theme_media.id
	Type     string `json:"type"`               // "BGM" | "SFX" | "VOICE"
	URL      string `json:"url,omitempty"`      // resolved URL (CDN or YouTube)
	Duration int    `json:"duration,omitempty"` // seconds, 0 = unknown
}

// PlayMediaPayload is the params shape for ActionPlayMedia phase actions.
// The server validates the enum shape; clients decide actual playback.
type PlayMediaPayload struct {
	MediaID     string `json:"mediaId"`
	Mode        string `json:"mode,omitempty"`        // "" | "cutscene" | "inline"
	Skippable   bool   `json:"skippable,omitempty"`
	BgmBehavior string `json:"bgmBehavior,omitempty"` // "" | "pause" | "keep" | "stop"
}

// ModuleConfig is the per-module configuration from configJson.modules[].
type ModuleConfig struct {
	Name     string          `json:"name"`
	Enabled  bool            `json:"enabled"`
	Settings json.RawMessage `json:"settings,omitempty"` // module-specific ConfigSchema
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

// PhaseReactor is an optional interface for modules that respond to PhaseActions.
// Only modules that need to react to phase transitions implement this.
type PhaseReactor interface {
	// ReactTo handles a PhaseAction dispatched by the ActionDispatcher.
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

// ProgressionStrategy defines how the game advances through phases.
// All methods must be called by the session actor goroutine — no external
// synchronization is required because GameProgressionEngine is not thread-safe.
type ProgressionStrategy interface {
	// Init initializes the strategy with the phase configuration.
	Init(ctx context.Context, config GameConfig) error

	// CurrentPhase returns the active phase info.
	CurrentPhase() *PhaseInfo

	// Advance moves to the next phase. Returns false if no more phases.
	Advance(ctx context.Context) (hasNext bool, err error)

	// SkipTo jumps to a specific phase (GM override).
	SkipTo(ctx context.Context, phaseID string) error

	// HandleTrigger evaluates a trigger event and returns the target phase ID
	// if a transition should occur. Empty string means no transition.
	// The engine orchestrator is responsible for running the exit/enter lifecycle.
	HandleTrigger(ctx context.Context, triggerType string, condition json.RawMessage) (targetPhaseID string, err error)

	// HandleConsensus processes a player consensus action.
	HandleConsensus(ctx context.Context, playerID uuid.UUID, action string) error

	// BuildState returns the strategy's current state for serialization.
	BuildState() map[string]any

	// Cleanup releases strategy resources.
	Cleanup(ctx context.Context) error
}
