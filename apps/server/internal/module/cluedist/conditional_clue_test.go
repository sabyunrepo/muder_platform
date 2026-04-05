package cluedist

import (
	"context"
	"encoding/json"
	"sync"
	"testing"

	"github.com/google/uuid"
	"github.com/mmp-platform/server/internal/engine"
)

func newTestDeps() engine.ModuleDeps {
	return engine.ModuleDeps{
		SessionID: uuid.New(),
		EventBus:  engine.NewEventBus(nil),
		Logger:    nil,
	}
}

func TestConditionalClueModule_Name(t *testing.T) {
	m := NewConditionalClueModule()
	if m.Name() != "conditional_clue" {
		t.Fatalf("expected %q, got %q", "conditional_clue", m.Name())
	}
}

func TestConditionalClueModule_Init(t *testing.T) {
	tests := []struct {
		name             string
		config           json.RawMessage
		wantAnnounceAll  bool
		wantAnnounceFinder bool
		wantDepsLen      int
		wantErr          bool
	}{
		{
			name:               "defaults with nil config",
			config:             nil,
			wantAnnounceAll:    false,
			wantAnnounceFinder: true,
			wantDepsLen:        0,
		},
		{
			name: "custom config with dependencies",
			config: json.RawMessage(`{
				"announceToAll": true,
				"announceToFinder": false,
				"dependencies": [
					{"clueId": "c3", "prerequisiteClueIds": ["c1", "c2"], "mode": "ALL"}
				]
			}`),
			wantAnnounceAll:    true,
			wantAnnounceFinder: false,
			wantDepsLen:        1,
		},
		{
			name:    "invalid JSON",
			config:  json.RawMessage(`{invalid}`),
			wantErr: true,
		},
		{
			name:    "invalid mode",
			config:  json.RawMessage(`{"dependencies":[{"clueId":"x","prerequisiteClueIds":["y"],"mode":"INVALID"}]}`),
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			m := NewConditionalClueModule()
			err := m.Init(context.Background(), newTestDeps(), tt.config)
			if tt.wantErr {
				if err == nil {
					t.Fatal("expected error, got nil")
				}
				return
			}
			if err != nil {
				t.Fatalf("Init failed: %v", err)
			}
			if m.config.AnnounceToAll != tt.wantAnnounceAll {
				t.Fatalf("announceToAll = %v, want %v", m.config.AnnounceToAll, tt.wantAnnounceAll)
			}
			if m.config.AnnounceToFinder != tt.wantAnnounceFinder {
				t.Fatalf("announceToFinder = %v, want %v", m.config.AnnounceToFinder, tt.wantAnnounceFinder)
			}
			if len(m.dependencies) != tt.wantDepsLen {
				t.Fatalf("dependencies len = %d, want %d", len(m.dependencies), tt.wantDepsLen)
			}
		})
	}
}

func TestConditionalClueModule_AllMode(t *testing.T) {
	deps := newTestDeps()
	cfg := json.RawMessage(`{
		"dependencies": [
			{"clueId": "c3", "prerequisiteClueIds": ["c1", "c2"], "mode": "ALL"}
		]
	}`)
	m := NewConditionalClueModule()
	if err := m.Init(context.Background(), deps, cfg); err != nil {
		t.Fatalf("Init failed: %v", err)
	}

	var mu sync.Mutex
	var unlocked bool
	deps.EventBus.Subscribe("clue.conditional_unlocked", func(e engine.Event) {
		mu.Lock()
		unlocked = true
		mu.Unlock()
	})

	// Acquire c1 only — not enough.
	deps.EventBus.Publish(engine.Event{Type: "clue.acquired", Payload: map[string]any{"clueId": "c1"}})

	m.mu.RLock()
	if m.unlockedClues["c3"] {
		t.Fatal("c3 should not be unlocked with only c1 acquired")
	}
	m.mu.RUnlock()

	// Acquire c2 — now both prereqs met.
	deps.EventBus.Publish(engine.Event{Type: "clue.acquired", Payload: map[string]any{"clueId": "c2"}})

	m.mu.RLock()
	if !m.unlockedClues["c3"] {
		t.Fatal("c3 should be unlocked after acquiring c1 and c2")
	}
	m.mu.RUnlock()

	mu.Lock()
	if !unlocked {
		t.Fatal("clue.conditional_unlocked event not published")
	}
	mu.Unlock()
}

func TestConditionalClueModule_AnyMode(t *testing.T) {
	deps := newTestDeps()
	cfg := json.RawMessage(`{
		"dependencies": [
			{"clueId": "c3", "prerequisiteClueIds": ["c1", "c2"], "mode": "ANY"}
		]
	}`)
	m := NewConditionalClueModule()
	if err := m.Init(context.Background(), deps, cfg); err != nil {
		t.Fatalf("Init failed: %v", err)
	}

	// Acquire just c1 — ANY mode should unlock.
	deps.EventBus.Publish(engine.Event{Type: "clue.acquired", Payload: map[string]any{"clueId": "c1"}})

	m.mu.RLock()
	if !m.unlockedClues["c3"] {
		t.Fatal("c3 should be unlocked with ANY mode after acquiring c1")
	}
	m.mu.RUnlock()
}

func TestConditionalClueModule_ChainUnlock(t *testing.T) {
	deps := newTestDeps()
	cfg := json.RawMessage(`{
		"dependencies": [
			{"clueId": "c2", "prerequisiteClueIds": ["c1"], "mode": "ALL"},
			{"clueId": "c3", "prerequisiteClueIds": ["c2"], "mode": "ALL"}
		]
	}`)
	m := NewConditionalClueModule()
	if err := m.Init(context.Background(), deps, cfg); err != nil {
		t.Fatalf("Init failed: %v", err)
	}

	var mu sync.Mutex
	var unlockedClues []string
	deps.EventBus.Subscribe("clue.conditional_unlocked", func(e engine.Event) {
		payload := e.Payload.(map[string]any)
		mu.Lock()
		unlockedClues = append(unlockedClues, payload["clueId"].(string))
		mu.Unlock()
	})

	// Acquiring c1 should chain-unlock c2 then c3 (synchronously now).
	deps.EventBus.Publish(engine.Event{Type: "clue.acquired", Payload: map[string]any{"clueId": "c1"}})

	m.mu.RLock()
	if !m.unlockedClues["c2"] {
		t.Fatal("c2 should be unlocked via chain")
	}
	if !m.unlockedClues["c3"] {
		t.Fatal("c3 should be unlocked via chain from c2")
	}
	m.mu.RUnlock()
}

func TestConditionalClueModule_HandleMessage_UnknownType(t *testing.T) {
	m := NewConditionalClueModule()
	_ = m.Init(context.Background(), newTestDeps(), nil)

	err := m.HandleMessage(context.Background(), uuid.New(), "unknown", nil)
	if err == nil {
		t.Fatal("expected error for unknown message type")
	}
}

func TestConditionalClueModule_HandleMessage_Status(t *testing.T) {
	m := NewConditionalClueModule()
	_ = m.Init(context.Background(), newTestDeps(), nil)

	err := m.HandleMessage(context.Background(), uuid.New(), "conditional:status", nil)
	if err != nil {
		t.Fatalf("conditional:status failed: %v", err)
	}
}

func TestConditionalClueModule_BuildState(t *testing.T) {
	m := NewConditionalClueModule()
	_ = m.Init(context.Background(), newTestDeps(), nil)

	data, err := m.BuildState()
	if err != nil {
		t.Fatalf("BuildState failed: %v", err)
	}

	var state conditionalClueState
	if err := json.Unmarshal(data, &state); err != nil {
		t.Fatalf("unmarshal failed: %v", err)
	}
	if state.UnlockedClues == nil {
		t.Fatal("expected non-nil unlockedClues")
	}
}

func TestConditionalClueModule_Schema(t *testing.T) {
	m := NewConditionalClueModule()
	schema := m.Schema()
	if schema == nil {
		t.Fatal("Schema returned nil")
	}
	var parsed map[string]any
	if err := json.Unmarshal(schema, &parsed); err != nil {
		t.Fatalf("Schema not valid JSON: %v", err)
	}
	if parsed["type"] != "object" {
		t.Fatalf("expected schema type %q, got %v", "object", parsed["type"])
	}
}

func TestConditionalClueModule_Cleanup(t *testing.T) {
	m := NewConditionalClueModule()
	_ = m.Init(context.Background(), newTestDeps(), nil)
	_ = m.Cleanup(context.Background())
	if m.unlockedClues != nil {
		t.Fatal("expected unlockedClues nil after cleanup")
	}
	if m.acquiredClues != nil {
		t.Fatal("expected acquiredClues nil after cleanup")
	}
}
