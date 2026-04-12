package core

import (
	"context"
	"encoding/json"
	"fmt"
	"sync"
	"time"

	"github.com/google/uuid"
	"github.com/mmp-platform/server/internal/engine"
)

func init() {
	engine.Register("connection", func() engine.Module { return NewConnectionModule() })
}

// PlayerStatus represents a player's connection state in a session.
type PlayerStatus struct {
	PlayerID      uuid.UUID `json:"playerId"`
	CharacterCode string    `json:"characterCode"`
	IsOnline      bool      `json:"isOnline"`
	JoinedAt      time.Time `json:"joinedAt"`
}

// ConnectionModule tracks online players in a game session.
type ConnectionModule struct {
	mu      sync.RWMutex
	deps    engine.ModuleDeps
	players map[uuid.UUID]*PlayerStatus
}

// NewConnectionModule creates a new ConnectionModule instance.
func NewConnectionModule() *ConnectionModule {
	return &ConnectionModule{}
}

func (m *ConnectionModule) Name() string { return "connection" }

func (m *ConnectionModule) Init(_ context.Context, deps engine.ModuleDeps, _ json.RawMessage) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	m.deps = deps
	m.players = make(map[uuid.UUID]*PlayerStatus)
	return nil
}

type joinGamePayload struct {
	SessionID     string `json:"sessionId"`
	CharacterCode string `json:"characterCode"`
	SecretKey     string `json:"secretKey"`
}

type reconnectSyncPayload struct {
	SessionID string `json:"sessionId"`
}

func (m *ConnectionModule) HandleMessage(ctx context.Context, playerID uuid.UUID, msgType string, payload json.RawMessage) error {
	switch msgType {
	case "join_game":
		return m.handleJoinGame(ctx, playerID, payload)
	case "reconnect_sync":
		return m.handleReconnectSync(ctx, playerID, payload)
	default:
		return fmt.Errorf("connection: unknown message type %q", msgType)
	}
}

func (m *ConnectionModule) handleJoinGame(_ context.Context, playerID uuid.UUID, payload json.RawMessage) error {
	var p joinGamePayload
	if err := json.Unmarshal(payload, &p); err != nil {
		return fmt.Errorf("connection: invalid join_game payload: %w", err)
	}

	m.mu.Lock()
	m.players[playerID] = &PlayerStatus{
		PlayerID:      playerID,
		CharacterCode: p.CharacterCode,
		IsOnline:      true,
		JoinedAt:      time.Now(),
	}
	m.mu.Unlock()

	m.deps.EventBus.Publish(engine.Event{
		Type: "player.joined",
		Payload: map[string]any{
			"playerId":      playerID.String(),
			"characterCode": p.CharacterCode,
			"sessionId":     p.SessionID,
		},
	})
	return nil
}

func (m *ConnectionModule) handleReconnectSync(_ context.Context, playerID uuid.UUID, payload json.RawMessage) error {
	var p reconnectSyncPayload
	if err := json.Unmarshal(payload, &p); err != nil {
		return fmt.Errorf("connection: invalid reconnect_sync payload: %w", err)
	}

	m.mu.Lock()
	ps, exists := m.players[playerID]
	if exists {
		ps.IsOnline = true
	}
	m.mu.Unlock()

	if exists {
		m.deps.EventBus.Publish(engine.Event{
			Type: "player.reconnected",
			Payload: map[string]any{
				"playerId":  playerID.String(),
				"sessionId": p.SessionID,
			},
		})
	}

	return nil
}

func (m *ConnectionModule) BuildState() (json.RawMessage, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	statuses := make([]*PlayerStatus, 0, len(m.players))
	for _, ps := range m.players {
		statuses = append(statuses, ps)
	}
	return json.Marshal(statuses)
}

func (m *ConnectionModule) Cleanup(_ context.Context) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	m.players = nil
	return nil
}

// --- SerializableModule ---

func (m *ConnectionModule) SaveState(_ context.Context) (engine.GameState, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	statuses := make([]*PlayerStatus, 0, len(m.players))
	for _, ps := range m.players {
		statuses = append(statuses, ps)
	}
	data, err := json.Marshal(statuses)
	if err != nil {
		return engine.GameState{}, fmt.Errorf("connection: save state: %w", err)
	}
	return engine.GameState{Modules: map[string]json.RawMessage{m.Name(): data}}, nil
}

func (m *ConnectionModule) RestoreState(_ context.Context, _ uuid.UUID, state engine.GameState) error {
	raw, ok := state.Modules[m.Name()]
	if !ok {
		return nil
	}
	var statuses []*PlayerStatus
	if err := json.Unmarshal(raw, &statuses); err != nil {
		return fmt.Errorf("connection: restore state: %w", err)
	}
	m.mu.Lock()
	defer m.mu.Unlock()
	m.players = make(map[uuid.UUID]*PlayerStatus, len(statuses))
	for _, ps := range statuses {
		m.players[ps.PlayerID] = ps
	}
	return nil
}

// Compile-time interface checks.
var (
	_ engine.Module             = (*ConnectionModule)(nil)
	_ engine.SerializableModule = (*ConnectionModule)(nil)
)
