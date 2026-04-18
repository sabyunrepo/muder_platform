package exploration

import (
	"bytes"
	"context"
	"encoding/json"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/mmp-platform/server/internal/engine"
)

func TestTimedExplorationModule_Name(t *testing.T) {
	m := NewTimedExplorationModule()
	if m.Name() != "timed_exploration" {
		t.Fatalf("expected %q, got %q", "timed_exploration", m.Name())
	}
}

func TestTimedExplorationModule_Init(t *testing.T) {
	tests := []struct {
		name    string
		config  json.RawMessage
		wantErr bool
		check   func(t *testing.T, m *TimedExplorationModule)
	}{
		{
			name:    "default config",
			config:  nil,
			wantErr: false,
			check: func(t *testing.T, m *TimedExplorationModule) {
				if m.config.ExplorationTime != 180 {
					t.Fatalf("expected ExplorationTime 180, got %d", m.config.ExplorationTime)
				}
				if m.config.WarningTime != 30 {
					t.Fatalf("expected WarningTime 30, got %d", m.config.WarningTime)
				}
				if m.config.AutoEndAction != "lock" {
					t.Fatalf("expected AutoEndAction %q, got %q", "lock", m.config.AutoEndAction)
				}
				if !m.config.FreeRoam {
					t.Fatal("expected FreeRoam true")
				}
			},
		},
		{
			name:    "custom config",
			config:  json.RawMessage(`{"explorationTime":60,"warningTime":10,"autoEndAction":"next_phase","freeRoam":false}`),
			wantErr: false,
			check: func(t *testing.T, m *TimedExplorationModule) {
				if m.config.ExplorationTime != 60 {
					t.Fatalf("expected ExplorationTime 60, got %d", m.config.ExplorationTime)
				}
				if m.config.AutoEndAction != "next_phase" {
					t.Fatalf("expected AutoEndAction %q, got %q", "next_phase", m.config.AutoEndAction)
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
			m := NewTimedExplorationModule()
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

func TestTimedExplorationModule_ExploreStart(t *testing.T) {
	deps := newTestDeps()
	m := NewTimedExplorationModule()
	_ = m.Init(context.Background(), deps, nil)

	var published bool
	deps.EventBus.Subscribe("explore.started", func(e engine.Event) { published = true })

	err := m.HandleMessage(context.Background(), uuid.New(), "explore:start", nil)
	if err != nil {
		t.Fatalf("explore:start failed: %v", err)
	}

	m.mu.RLock()
	if !m.isActive {
		t.Fatal("expected isActive true")
	}
	m.mu.RUnlock()

	if !published {
		t.Fatal("explore.started event not published")
	}

	// Starting again should fail.
	err = m.HandleMessage(context.Background(), uuid.New(), "explore:start", nil)
	if err == nil {
		t.Fatal("expected error for double start")
	}
}

func TestTimedExplorationModule_ExploreMove(t *testing.T) {
	baseTime := time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC)
	player1 := uuid.MustParse("00000000-0000-0000-0000-000000000001")

	tests := []struct {
		name    string
		config  json.RawMessage
		setup   func(m *TimedExplorationModule)
		player  uuid.UUID
		payload exploreMovePayload
		wantErr bool
	}{
		{
			name: "move success",
			setup: func(m *TimedExplorationModule) {
				m.isActive = true
				m.startTime = baseTime
			},
			player:  player1,
			payload: exploreMovePayload{LocationID: "loc_a"},
			wantErr: false,
		},
		{
			name:    "not active",
			player:  player1,
			payload: exploreMovePayload{LocationID: "loc_a"},
			wantErr: true,
		},
		{
			name:   "free roam disabled",
			config: json.RawMessage(`{"freeRoam":false}`),
			setup: func(m *TimedExplorationModule) {
				m.isActive = true
				m.startTime = baseTime
			},
			player:  player1,
			payload: exploreMovePayload{LocationID: "loc_a"},
			wantErr: true,
		},
		{
			name: "locked",
			setup: func(m *TimedExplorationModule) {
				m.isActive = true
				m.isLocked = true
				m.startTime = baseTime
			},
			player:  player1,
			payload: exploreMovePayload{LocationID: "loc_a"},
			wantErr: true,
		},
		{
			name: "empty locationId",
			setup: func(m *TimedExplorationModule) {
				m.isActive = true
				m.startTime = baseTime
			},
			player:  player1,
			payload: exploreMovePayload{LocationID: ""},
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			m := NewTimedExplorationModule()
			_ = m.Init(context.Background(), newTestDeps(), tt.config)
			m.nowFunc = func() time.Time { return baseTime.Add(10 * time.Second) }
			if tt.setup != nil {
				tt.setup(m)
			}

			payload, _ := json.Marshal(tt.payload)
			err := m.HandleMessage(context.Background(), tt.player, "explore:move", payload)
			if (err != nil) != tt.wantErr {
				t.Fatalf("error = %v, wantErr %v", err, tt.wantErr)
			}
		})
	}
}

func TestTimedExplorationModule_BuildState_TimerLogic(t *testing.T) {
	baseTime := time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC)

	tests := []struct {
		name          string
		config        json.RawMessage
		setup         func(m *TimedExplorationModule)
		now           time.Time
		wantActive    bool
		wantLocked    bool
		wantWarning   bool
		wantElapsed   int
		wantRemaining int
	}{
		{
			name: "inactive",
			now:  baseTime,
			setup: func(m *TimedExplorationModule) {
				// not started
			},
			wantActive:    false,
			wantLocked:    false,
			wantElapsed:   0,
			wantRemaining: 180,
		},
		{
			name: "active mid-exploration",
			now:  baseTime.Add(60 * time.Second),
			setup: func(m *TimedExplorationModule) {
				m.isActive = true
				m.startTime = baseTime
			},
			wantActive:    true,
			wantLocked:    false,
			wantWarning:   false,
			wantElapsed:   60,
			wantRemaining: 120,
		},
		{
			name: "warning zone",
			now:  baseTime.Add(155 * time.Second), // 180-30=150, so 155 is in warning zone
			setup: func(m *TimedExplorationModule) {
				m.isActive = true
				m.startTime = baseTime
			},
			wantActive:    true,
			wantLocked:    false,
			wantWarning:   true,
			wantElapsed:   155,
			wantRemaining: 25,
		},
		{
			name: "time expired - auto lock",
			now:  baseTime.Add(200 * time.Second),
			setup: func(m *TimedExplorationModule) {
				m.isActive = true
				m.startTime = baseTime
			},
			wantActive:    true,
			wantLocked:    true,
			wantWarning:   false,
			wantElapsed:   200,
			wantRemaining: 0,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			m := NewTimedExplorationModule()
			_ = m.Init(context.Background(), newTestDeps(), tt.config)
			m.nowFunc = func() time.Time { return tt.now }
			if tt.setup != nil {
				tt.setup(m)
			}

			// Run CheckExpiry to apply time-based state mutations (e.g., auto-lock).
			m.CheckExpiry()

			data, err := m.BuildState()
			if err != nil {
				t.Fatalf("BuildState failed: %v", err)
			}

			var state timedExplorationState
			if err := json.Unmarshal(data, &state); err != nil {
				t.Fatalf("unmarshal failed: %v", err)
			}

			if state.IsActive != tt.wantActive {
				t.Fatalf("isActive = %v, want %v", state.IsActive, tt.wantActive)
			}
			if state.IsLocked != tt.wantLocked {
				t.Fatalf("isLocked = %v, want %v", state.IsLocked, tt.wantLocked)
			}
			if state.Warning != tt.wantWarning {
				t.Fatalf("warning = %v, want %v", state.Warning, tt.wantWarning)
			}
			if state.Elapsed != tt.wantElapsed {
				t.Fatalf("elapsed = %d, want %d", state.Elapsed, tt.wantElapsed)
			}
			if state.Remaining != tt.wantRemaining {
				t.Fatalf("remaining = %d, want %d", state.Remaining, tt.wantRemaining)
			}
		})
	}
}

func TestTimedExplorationModule_ExploreMove_PublishesEvent(t *testing.T) {
	deps := newTestDeps()
	m := NewTimedExplorationModule()
	_ = m.Init(context.Background(), deps, nil)
	m.isActive = true
	m.startTime = time.Now()
	m.nowFunc = time.Now

	var published bool
	deps.EventBus.Subscribe("explore.player_moved", func(e engine.Event) { published = true })

	payload, _ := json.Marshal(exploreMovePayload{LocationID: "loc_a"})
	_ = m.HandleMessage(context.Background(), uuid.New(), "explore:move", payload)
	if !published {
		t.Fatal("explore.player_moved event not published")
	}
}

func TestTimedExplorationModule_UnknownMessage(t *testing.T) {
	m := NewTimedExplorationModule()
	_ = m.Init(context.Background(), newTestDeps(), nil)

	err := m.HandleMessage(context.Background(), uuid.New(), "explore:unknown", nil)
	if err == nil {
		t.Fatal("expected error for unknown message type")
	}
}

func TestTimedExplorationModule_Cleanup(t *testing.T) {
	m := NewTimedExplorationModule()
	_ = m.Init(context.Background(), newTestDeps(), nil)
	_ = m.Cleanup(context.Background())
	if m.playerLocations != nil {
		t.Fatal("expected playerLocations nil after cleanup")
	}
	if m.isActive {
		t.Fatal("expected isActive false after cleanup")
	}
}

func TestTimedExplorationModule_Schema(t *testing.T) {
	m := NewTimedExplorationModule()
	schema := m.Schema()
	if len(schema) == 0 {
		t.Fatal("expected non-empty schema")
	}
	var parsed map[string]any
	if err := json.Unmarshal(schema, &parsed); err != nil {
		t.Fatalf("schema is not valid JSON: %v", err)
	}
}

// --- PR-2b: PlayerAware redaction ---

func startTimedExploration(t *testing.T, m *TimedExplorationModule, pid uuid.UUID) {
	t.Helper()
	if err := m.HandleMessage(context.Background(), pid, "explore:start", nil); err != nil {
		t.Fatalf("explore:start: %v", err)
	}
}

func TestTimedExplorationModule_BuildStateFor_CallerOnly(t *testing.T) {
	m := NewTimedExplorationModule()
	if err := m.Init(context.Background(), newTestDeps(), nil); err != nil {
		t.Fatalf("Init: %v", err)
	}
	alice := uuid.New()
	bob := uuid.New()
	startTimedExploration(t, m, alice)
	_ = m.HandleMessage(context.Background(), alice, "explore:move",
		json.RawMessage(`{"locationId":"lobby"}`))
	_ = m.HandleMessage(context.Background(), bob, "explore:move",
		json.RawMessage(`{"locationId":"study"}`))

	data, _ := m.BuildStateFor(alice)
	var s timedExplorationState
	_ = json.Unmarshal(data, &s)
	if s.PlayerLocations[alice] != "lobby" {
		t.Fatalf("alice should see her own location, got %v", s.PlayerLocations)
	}
	if _, leaked := s.PlayerLocations[bob]; leaked {
		t.Fatalf("bob's location leaked to alice: %v", s.PlayerLocations)
	}
	if !s.IsActive {
		t.Error("IsActive should be true")
	}
	_ = time.Now()
}

func TestTimedExplorationModule_BuildStateFor_NoEntry(t *testing.T) {
	m := NewTimedExplorationModule()
	_ = m.Init(context.Background(), newTestDeps(), nil)
	data, _ := m.BuildStateFor(uuid.New())
	var s timedExplorationState
	_ = json.Unmarshal(data, &s)
	if s.PlayerLocations == nil || len(s.PlayerLocations) != 0 {
		t.Fatalf("expected empty non-nil PlayerLocations, got %v", s.PlayerLocations)
	}
}

func TestTimedExplorationModule_BuildStateFor_NoCrossLeak(t *testing.T) {
	m := NewTimedExplorationModule()
	_ = m.Init(context.Background(), newTestDeps(), nil)
	alice := uuid.New()
	bob := uuid.New()
	startTimedExploration(t, m, alice)
	_ = m.HandleMessage(context.Background(), bob, "explore:move",
		json.RawMessage(`{"locationId":"study"}`))

	aliceData, _ := m.BuildStateFor(alice)
	if bytes.Contains(aliceData, []byte(bob.String())) {
		t.Fatalf("alice leaked bob's uuid: %s", aliceData)
	}
	if bytes.Contains(aliceData, []byte(`"study"`)) {
		t.Fatalf("alice leaked bob's location string: %s", aliceData)
	}
}
