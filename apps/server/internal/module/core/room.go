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
	engine.Register("room", func() engine.Module { return NewRoomModule() })
}

// RoomModule manages character selection and room phase.
//
// PR-2a: declares public state — character map is broadcast to all players
// for the lobby UI, and phase is a single game-wide value.
type RoomModule struct {
	engine.PublicStateMarker

	mu         sync.RWMutex
	deps       engine.ModuleDeps
	characters map[string]uuid.UUID // characterCode → playerID
	phase      string
}

// NewRoomModule creates a new RoomModule instance.
func NewRoomModule() *RoomModule {
	return &RoomModule{}
}

func (m *RoomModule) Name() string { return "room" }

func (m *RoomModule) Init(_ context.Context, deps engine.ModuleDeps, _ json.RawMessage) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	m.deps = deps
	m.characters = make(map[string]uuid.UUID)
	m.phase = "waiting"
	return nil
}

type selectCharacterPayload struct {
	CharacterCode string `json:"characterCode"`
}

func (m *RoomModule) HandleMessage(ctx context.Context, playerID uuid.UUID, msgType string, payload json.RawMessage) error {
	switch msgType {
	case "room:select_character":
		return m.handleSelectCharacter(ctx, playerID, payload)
	case "room:deselect_character":
		return m.handleDeselectCharacter(ctx, playerID, payload)
	default:
		return fmt.Errorf("room: unknown message type %q", msgType)
	}
}

func (m *RoomModule) handleSelectCharacter(_ context.Context, playerID uuid.UUID, payload json.RawMessage) error {
	var p selectCharacterPayload
	if err := json.Unmarshal(payload, &p); err != nil {
		return fmt.Errorf("room: invalid select_character payload: %w", err)
	}

	m.mu.Lock()
	// Check if character is already taken by another player.
	if existingPlayer, taken := m.characters[p.CharacterCode]; taken && existingPlayer != playerID {
		m.mu.Unlock()
		return fmt.Errorf("room: character %q already selected by another player", p.CharacterCode)
	}
	// Remove any existing selection by this player to prevent multiple character selections.
	for code, pid := range m.characters {
		if pid == playerID && code != p.CharacterCode {
			delete(m.characters, code)
			break
		}
	}
	m.characters[p.CharacterCode] = playerID
	m.mu.Unlock()

	m.deps.EventBus.Publish(engine.Event{
		Type: "room.character_selected",
		Payload: map[string]any{
			"playerId":      playerID.String(),
			"characterCode": p.CharacterCode,
		},
	})
	return nil
}

func (m *RoomModule) handleDeselectCharacter(_ context.Context, playerID uuid.UUID, _ json.RawMessage) error {
	m.mu.Lock()
	var deselectedCode string
	for code, pid := range m.characters {
		if pid == playerID {
			deselectedCode = code
			delete(m.characters, code)
			break
		}
	}
	m.mu.Unlock()

	if deselectedCode == "" {
		return fmt.Errorf("room: player has no character selected")
	}

	m.deps.EventBus.Publish(engine.Event{
		Type: "room.character_deselected",
		Payload: map[string]any{
			"playerId":      playerID.String(),
			"characterCode": deselectedCode,
		},
	})
	return nil
}

type roomState struct {
	Characters map[string]uuid.UUID `json:"characters"`
	Phase      string               `json:"phase"`
}

func (m *RoomModule) BuildState() (json.RawMessage, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	return json.Marshal(roomState{
		Characters: m.characters,
		Phase:      m.phase,
	})
}

func (m *RoomModule) Cleanup(_ context.Context) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	m.characters = nil
	m.phase = ""
	return nil
}

// Compile-time interface checks.
var (
	_ engine.Module            = (*RoomModule)(nil)
	_ engine.PublicStateModule = (*RoomModule)(nil)
)
