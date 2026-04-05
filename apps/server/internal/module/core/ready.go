package core

import (
	"context"
	"encoding/json"
	"fmt"
	"sync"

	"github.com/google/uuid"
	"github.com/mmp-platform/server/internal/engine"
)

func init() {
	engine.Register("ready", func() engine.Module { return NewReadyModule() })
}

// ReadyModule tracks player ready states before game start.
type ReadyModule struct {
	mu           sync.RWMutex
	deps         engine.ModuleDeps
	readyPlayers map[uuid.UUID]bool
	totalPlayers int
}

// NewReadyModule creates a new ReadyModule instance.
func NewReadyModule() *ReadyModule {
	return &ReadyModule{}
}

func (m *ReadyModule) Name() string { return "ready" }

type readyConfig struct {
	TotalPlayers int `json:"totalPlayers"`
}

func (m *ReadyModule) Init(_ context.Context, deps engine.ModuleDeps, config json.RawMessage) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	m.deps = deps
	m.readyPlayers = make(map[uuid.UUID]bool)

	if config != nil && len(config) > 0 {
		var cfg readyConfig
		if err := json.Unmarshal(config, &cfg); err == nil && cfg.TotalPlayers > 0 {
			m.totalPlayers = cfg.TotalPlayers
		}
	}
	return nil
}

func (m *ReadyModule) HandleMessage(_ context.Context, playerID uuid.UUID, msgType string, _ json.RawMessage) error {
	switch msgType {
	case "ready:toggle":
		return m.handleToggle(playerID)
	default:
		return fmt.Errorf("ready: unknown message type %q", msgType)
	}
}

func (m *ReadyModule) handleToggle(playerID uuid.UUID) error {
	m.mu.Lock()
	current := m.readyPlayers[playerID]
	m.readyPlayers[playerID] = !current

	allReady := m.checkAllReady()
	m.mu.Unlock()

	m.deps.EventBus.Publish(engine.Event{
		Type: "ready.status_changed",
		Payload: map[string]any{
			"playerId": playerID.String(),
			"isReady":  !current,
		},
	})

	if allReady {
		m.deps.EventBus.Publish(engine.Event{
			Type:    "ready.all_ready",
			Payload: nil,
		})
	}
	return nil
}

// checkAllReady returns true when totalPlayers > 0 and all are ready.
// Must be called with mu held.
func (m *ReadyModule) checkAllReady() bool {
	if m.totalPlayers <= 0 || len(m.readyPlayers) < m.totalPlayers {
		return false
	}
	for _, ready := range m.readyPlayers {
		if !ready {
			return false
		}
	}
	return true
}

type readyState struct {
	Players  map[uuid.UUID]bool `json:"players"`
	AllReady bool               `json:"allReady"`
}

func (m *ReadyModule) BuildState() (json.RawMessage, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	return json.Marshal(readyState{
		Players:  m.readyPlayers,
		AllReady: m.checkAllReady(),
	})
}

func (m *ReadyModule) Cleanup(_ context.Context) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	m.readyPlayers = nil
	m.totalPlayers = 0
	return nil
}
