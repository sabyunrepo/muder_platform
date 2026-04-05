package exploration

import (
	"context"
	"encoding/json"
	"testing"

	"github.com/google/uuid"
	"github.com/mmp-platform/server/internal/engine"
)

func TestLocationClueModule_Name(t *testing.T) {
	m := NewLocationClueModule()
	if m.Name() != "location_clue" {
		t.Fatalf("expected %q, got %q", "location_clue", m.Name())
	}
}

func TestLocationClueModule_Init(t *testing.T) {
	tests := []struct {
		name    string
		config  json.RawMessage
		wantErr bool
		check   func(t *testing.T, m *LocationClueModule)
	}{
		{
			name:    "default config",
			config:  nil,
			wantErr: false,
			check: func(t *testing.T, m *LocationClueModule) {
				if m.config.ShowClueCount {
					t.Fatal("expected ShowClueCount false")
				}
				if !m.config.AllowRepeatSearch {
					t.Fatal("expected AllowRepeatSearch true")
				}
			},
		},
		{
			name:    "custom config",
			config:  json.RawMessage(`{"showClueCount":true,"allowRepeatSearch":false}`),
			wantErr: false,
			check: func(t *testing.T, m *LocationClueModule) {
				if !m.config.ShowClueCount {
					t.Fatal("expected ShowClueCount true")
				}
				if m.config.AllowRepeatSearch {
					t.Fatal("expected AllowRepeatSearch false")
				}
			},
		},
		{
			name:    "invalid config",
			config:  json.RawMessage(`{bad`),
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			m := NewLocationClueModule()
			err := m.Init(context.Background(), newTestDeps(), tt.config)
			if (err != nil) != tt.wantErr {
				t.Fatalf("error = %v, wantErr %v", err, tt.wantErr)
			}
			if tt.check != nil && err == nil {
				tt.check(t, m)
			}
		})
	}
}

func TestLocationClueModule_LocationSearch(t *testing.T) {
	player1 := uuid.MustParse("00000000-0000-0000-0000-000000000001")

	tests := []struct {
		name    string
		config  json.RawMessage
		setup   func(m *LocationClueModule)
		player  uuid.UUID
		payload locationSearchPayload
		wantErr bool
	}{
		{
			name:    "search success",
			player:  player1,
			payload: locationSearchPayload{LocationID: "library"},
			wantErr: false,
		},
		{
			name:    "empty locationId",
			player:  player1,
			payload: locationSearchPayload{LocationID: ""},
			wantErr: true,
		},
		{
			name: "repeat search allowed by default",
			setup: func(m *LocationClueModule) {
				m.searchedLocations[player1] = map[string]bool{"library": true}
			},
			player:  player1,
			payload: locationSearchPayload{LocationID: "library"},
			wantErr: false,
		},
		{
			name:   "repeat search rejected",
			config: json.RawMessage(`{"allowRepeatSearch":false}`),
			setup: func(m *LocationClueModule) {
				m.searchedLocations[player1] = map[string]bool{"library": true}
			},
			player:  player1,
			payload: locationSearchPayload{LocationID: "library"},
			wantErr: true,
		},
		{
			name:   "different location after search - no repeat",
			config: json.RawMessage(`{"allowRepeatSearch":false}`),
			setup: func(m *LocationClueModule) {
				m.searchedLocations[player1] = map[string]bool{"library": true}
			},
			player:  player1,
			payload: locationSearchPayload{LocationID: "kitchen"},
			wantErr: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			m := NewLocationClueModule()
			_ = m.Init(context.Background(), newTestDeps(), tt.config)
			if tt.setup != nil {
				tt.setup(m)
			}

			payload, _ := json.Marshal(tt.payload)
			err := m.HandleMessage(context.Background(), tt.player, "location:search", payload)
			if (err != nil) != tt.wantErr {
				t.Fatalf("error = %v, wantErr %v", err, tt.wantErr)
			}
		})
	}
}

func TestLocationClueModule_LocationSearch_RecordsSearch(t *testing.T) {
	m := NewLocationClueModule()
	_ = m.Init(context.Background(), newTestDeps(), nil)

	player := uuid.New()
	payload, _ := json.Marshal(locationSearchPayload{LocationID: "kitchen"})
	_ = m.HandleMessage(context.Background(), player, "location:search", payload)

	m.mu.RLock()
	if !m.searchedLocations[player]["kitchen"] {
		t.Fatal("expected kitchen to be recorded as searched")
	}
	m.mu.RUnlock()
}

func TestLocationClueModule_LocationSearch_PublishesEvent(t *testing.T) {
	deps := newTestDeps()
	m := NewLocationClueModule()
	_ = m.Init(context.Background(), deps, nil)

	var published bool
	deps.EventBus.Subscribe("location.searched", func(e engine.Event) { published = true })

	payload, _ := json.Marshal(locationSearchPayload{LocationID: "library"})
	_ = m.HandleMessage(context.Background(), uuid.New(), "location:search", payload)
	if !published {
		t.Fatal("location.searched event not published")
	}
}

func TestLocationClueModule_AddFoundClue(t *testing.T) {
	m := NewLocationClueModule()
	_ = m.Init(context.Background(), newTestDeps(), nil)

	player := uuid.New()
	m.AddFoundClue(player, "clue_001")
	m.AddFoundClue(player, "clue_002")

	m.mu.RLock()
	clues := m.foundClues[player]
	m.mu.RUnlock()

	if len(clues) != 2 {
		t.Fatalf("expected 2 clues, got %d", len(clues))
	}
	if clues[0] != "clue_001" || clues[1] != "clue_002" {
		t.Fatalf("unexpected clues: %v", clues)
	}
}

func TestLocationClueModule_BuildState(t *testing.T) {
	m := NewLocationClueModule()
	_ = m.Init(context.Background(), newTestDeps(), nil)

	player := uuid.New()
	payload, _ := json.Marshal(locationSearchPayload{LocationID: "library"})
	_ = m.HandleMessage(context.Background(), player, "location:search", payload)
	m.AddFoundClue(player, "clue_001")

	data, err := m.BuildState()
	if err != nil {
		t.Fatalf("BuildState failed: %v", err)
	}

	var state locationClueState
	if err := json.Unmarshal(data, &state); err != nil {
		t.Fatalf("unmarshal failed: %v", err)
	}
	if len(state.SearchedLocations) != 1 {
		t.Fatalf("expected 1 player in searchedLocations, got %d", len(state.SearchedLocations))
	}
	if len(state.FoundClues) != 1 {
		t.Fatalf("expected 1 player in foundClues, got %d", len(state.FoundClues))
	}
}

func TestLocationClueModule_UnknownMessage(t *testing.T) {
	m := NewLocationClueModule()
	_ = m.Init(context.Background(), newTestDeps(), nil)

	err := m.HandleMessage(context.Background(), uuid.New(), "location:unknown", nil)
	if err == nil {
		t.Fatal("expected error for unknown message type")
	}
}

func TestLocationClueModule_Cleanup(t *testing.T) {
	m := NewLocationClueModule()
	_ = m.Init(context.Background(), newTestDeps(), nil)
	_ = m.Cleanup(context.Background())
	if m.searchedLocations != nil {
		t.Fatal("expected searchedLocations nil after cleanup")
	}
	if m.foundClues != nil {
		t.Fatal("expected foundClues nil after cleanup")
	}
}

func TestLocationClueModule_Schema(t *testing.T) {
	m := NewLocationClueModule()
	schema := m.Schema()
	if len(schema) == 0 {
		t.Fatal("expected non-empty schema")
	}
	var parsed map[string]any
	if err := json.Unmarshal(schema, &parsed); err != nil {
		t.Fatalf("schema is not valid JSON: %v", err)
	}
}
