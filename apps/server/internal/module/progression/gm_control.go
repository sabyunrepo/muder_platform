package progression

import (
	"context"
	"encoding/json"
	"fmt"
	"sync"

	"github.com/google/uuid"
	"github.com/mmp-platform/server/internal/engine"
)

// GmControlModule provides GM (Game Master) controls for session management.
// Auto-enabled when gmMode is REQUIRED or OPTIONAL.
// Does not implement ConfigSchema or PhaseReactor.
type GmControlModule struct {
	mu   sync.RWMutex
	deps engine.ModuleDeps

	// state
	gmPlayerID uuid.UUID
	isActive   bool
}

type gmControlConfig struct {
	GmPlayerID string `json:"GmPlayerID"`
}

// NewGmControlModule creates a new GmControlModule instance.
func NewGmControlModule() *GmControlModule {
	return &GmControlModule{}
}

func (m *GmControlModule) Name() string { return "gm_control" }

func (m *GmControlModule) Init(ctx context.Context, deps engine.ModuleDeps, config json.RawMessage) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	m.deps = deps

	var cfg gmControlConfig
	if config != nil && len(config) > 0 {
		if err := json.Unmarshal(config, &cfg); err != nil {
			return fmt.Errorf("gm_control: invalid config: %w", err)
		}
	}

	if cfg.GmPlayerID != "" {
		id, err := uuid.Parse(cfg.GmPlayerID)
		if err != nil {
			return fmt.Errorf("gm_control: invalid GM player ID: %w", err)
		}
		m.gmPlayerID = id
	}
	m.isActive = true

	return nil
}

func (m *GmControlModule) HandleMessage(ctx context.Context, playerID uuid.UUID, msgType string, payload json.RawMessage) error {
	m.mu.Lock()

	// GM auth check: only the designated GM can issue commands
	if m.gmPlayerID != uuid.Nil && playerID != m.gmPlayerID {
		m.mu.Unlock()
		return fmt.Errorf("gm_control: player %s is not the GM", playerID)
	}

	var event engine.Event

	switch msgType {
	case "gm:advance_phase":
		event = engine.Event{
			Type:    "gm.advance_phase",
			Payload: map[string]any{"gmID": playerID.String()},
		}

	case "gm:start_prologue":
		event = engine.Event{
			Type:    "gm.start_prologue",
			Payload: map[string]any{"gmID": playerID.String()},
		}

	case "gm:start_playing":
		event = engine.Event{
			Type:    "gm.start_playing",
			Payload: map[string]any{"gmID": playerID.String()},
		}

	case "gm:show_ending":
		event = engine.Event{
			Type:    "gm.show_ending",
			Payload: map[string]any{"gmID": playerID.String()},
		}

	case "gm:toggle_voting":
		event = engine.Event{
			Type:    "gm.toggle_voting",
			Payload: map[string]any{"gmID": playerID.String()},
		}

	case "gm:play_media":
		var p struct {
			MediaID string `json:"MediaID"`
		}
		if err := json.Unmarshal(payload, &p); err != nil {
			m.mu.Unlock()
			return fmt.Errorf("gm_control: invalid payload: %w", err)
		}
		event = engine.Event{
			Type:    "gm.play_media",
			Payload: map[string]any{"gmID": playerID.String(), "mediaID": p.MediaID},
		}

	case "gm:broadcast_message":
		var p struct {
			Message string `json:"Message"`
		}
		if err := json.Unmarshal(payload, &p); err != nil {
			m.mu.Unlock()
			return fmt.Errorf("gm_control: invalid payload: %w", err)
		}
		event = engine.Event{
			Type:    "gm.broadcast_message",
			Payload: map[string]any{"gmID": playerID.String(), "message": p.Message},
		}

	default:
		m.mu.Unlock()
		return fmt.Errorf("gm_control: unknown message type %q", msgType)
	}

	m.mu.Unlock()
	m.deps.EventBus.Publish(event)
	return nil
}

func (m *GmControlModule) BuildState() (json.RawMessage, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	gmID := ""
	if m.gmPlayerID != uuid.Nil {
		gmID = m.gmPlayerID.String()
	}

	state := map[string]any{
		"gmPlayerId": gmID,
		"isActive":   m.isActive,
	}
	return json.Marshal(state)
}

func (m *GmControlModule) Cleanup(ctx context.Context) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	m.isActive = false
	return nil
}

// --- PhaseHookModule ---

func (m *GmControlModule) OnPhaseEnter(_ context.Context, _ engine.Phase) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.isActive = true
	return nil
}

func (m *GmControlModule) OnPhaseExit(_ context.Context, _ engine.Phase) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.isActive = false
	return nil
}

// Compile-time interface checks.
var (
	_ engine.Module          = (*GmControlModule)(nil)
	_ engine.PhaseHookModule = (*GmControlModule)(nil)
)

func init() {
	engine.Register("gm_control", func() engine.Module { return NewGmControlModule() })
}
