package engine

import (
	"context"
	"encoding/json"
)

// PluginConfigSchema describes the JSON Schema for a Plugin's configuration.
// Used by the editor to auto-generate configuration UI.
// Named PluginConfigSchema to avoid collision with the legacy ConfigSchema interface
// in types.go (owned by PR-A4 for deletion).
type PluginConfigSchema struct {
	// Schema is a JSON Schema document (draft-07 or later).
	Schema json.RawMessage `json:"schema"`
}

// Plugin is the core interface that every genre plugin must implement.
// It contains exactly 7 methods — the minimum required for the engine to
// manage the plugin lifecycle. Additional capabilities are expressed through
// optional interfaces in module_optional.go (interface-segregation principle).
//
// Thread-safety contract: all Plugin methods are called by the session actor
// goroutine only. Plugins must NOT spawn goroutines that call back into
// session-owned state without external synchronisation.
type Plugin interface {
	// ID returns the unique machine-readable identifier for this plugin
	// (e.g. "murder_mystery"). Must be stable across versions.
	ID() string

	// Name returns the human-readable display name (e.g. "Murder Mystery").
	Name() string

	// Version returns the semver string for this plugin build (e.g. "1.0.0").
	Version() string

	// GetConfigSchema returns the JSON Schema that describes the plugin's
	// configuration surface. The editor uses this to render configuration UI.
	GetConfigSchema() PluginConfigSchema

	// DefaultConfig returns the plugin's default configuration as raw JSON.
	// The engine uses this when no session-specific config is provided.
	DefaultConfig() json.RawMessage

	// Init is called once after the plugin instance is created for a session.
	// config contains the session-specific plugin configuration (may be nil,
	// in which case the plugin should fall back to DefaultConfig).
	Init(ctx context.Context, config json.RawMessage) error

	// Cleanup releases any resources held by the plugin instance.
	// Called once when the session ends (win, timeout, or error).
	Cleanup(ctx context.Context) error
}
