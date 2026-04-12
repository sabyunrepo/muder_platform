package cluedist

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
	engine.Register("timed_clue", func() engine.Module { return NewTimedClueModule() })
}

// TimedClueConfig defines settings for the timed clue module.
type TimedClueConfig struct {
	Interval     int    `json:"interval"`     // seconds between auto-distributions
	MaxAutoClues int    `json:"maxAutoClues"` // maximum number of auto-distributed clues
	TargetMode   string `json:"targetMode"`   // "all", "random_player", "least_clues"
}

// TimedClueModule distributes clues automatically at timed intervals.
type TimedClueModule struct {
	mu                sync.RWMutex
	deps              engine.ModuleDeps
	config            TimedClueConfig
	distributedCount  int
	lastDistribution  time.Time
	isActive          bool
	playerClueCount   map[uuid.UUID]int
	timedCluePool     []string // pool of clue IDs to distribute
	nextClueIndex     int

	// nowFunc allows testing with a controllable clock.
	nowFunc func() time.Time
}

// NewTimedClueModule creates a new TimedClueModule instance.
func NewTimedClueModule() *TimedClueModule {
	return &TimedClueModule{
		nowFunc: time.Now,
	}
}

func (m *TimedClueModule) Name() string { return "timed_clue" }

func (m *TimedClueModule) Init(_ context.Context, deps engine.ModuleDeps, config json.RawMessage) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	m.deps = deps
	m.playerClueCount = make(map[uuid.UUID]int)
	m.distributedCount = 0
	m.isActive = false
	m.nextClueIndex = 0

	// Apply defaults.
	m.config = TimedClueConfig{
		Interval:     120,
		MaxAutoClues: 5,
		TargetMode:   "all",
	}

	if config != nil && len(config) > 0 {
		var combined struct {
			TimedClueConfig
			CluePool []string `json:"cluePool"`
		}
		// Unmarshal into combined to extract cluePool separately.
		if err := json.Unmarshal(config, &combined); err != nil {
			return fmt.Errorf("timed_clue: invalid config: %w", err)
		}
		// Unmarshal directly into m.config — only provided fields overwrite defaults.
		if err := json.Unmarshal(config, &m.config); err != nil {
			return fmt.Errorf("timed_clue: invalid config: %w", err)
		}
		m.timedCluePool = combined.CluePool
	}

	// Validate target mode.
	switch m.config.TargetMode {
	case "all", "random_player", "least_clues":
		// valid
	default:
		return fmt.Errorf("timed_clue: invalid targetMode %q", m.config.TargetMode)
	}

	// Subscribe to clue.acquired to track per-player counts for least_clues mode.
	deps.EventBus.Subscribe("clue.acquired", func(e engine.Event) {
		payload, ok := e.Payload.(map[string]any)
		if !ok {
			return
		}
		pidStr, _ := payload["playerId"].(string)
		if pidStr == "" {
			return
		}
		pid, err := uuid.Parse(pidStr)
		if err != nil {
			return
		}
		m.mu.Lock()
		m.playerClueCount[pid]++
		m.mu.Unlock()
	})

	return nil
}

func (m *TimedClueModule) HandleMessage(ctx context.Context, playerID uuid.UUID, msgType string, payload json.RawMessage) error {
	switch msgType {
	case "timed_clue:tick":
		return m.handleTick()
	case "timed_clue:start":
		return m.handleStart()
	case "timed_clue:stop":
		return m.handleStop()
	default:
		return fmt.Errorf("timed_clue: unknown message type %q", msgType)
	}
}

func (m *TimedClueModule) handleStart() error {
	m.mu.Lock()
	defer m.mu.Unlock()

	m.isActive = true
	m.lastDistribution = m.nowFunc()
	return nil
}

func (m *TimedClueModule) handleStop() error {
	m.mu.Lock()
	defer m.mu.Unlock()

	m.isActive = false
	return nil
}

func (m *TimedClueModule) handleTick() error {
	m.mu.Lock()

	if !m.isActive {
		m.mu.Unlock()
		return nil
	}

	if m.distributedCount >= m.config.MaxAutoClues {
		m.mu.Unlock()
		return nil
	}

	now := m.nowFunc()
	elapsed := now.Sub(m.lastDistribution)
	if elapsed < time.Duration(m.config.Interval)*time.Second {
		m.mu.Unlock()
		return nil
	}

	// Select the next clue to distribute.
	clueID := m.selectNextClue()
	if clueID == "" {
		m.mu.Unlock()
		return nil
	}

	// Select target based on mode.
	targetMode := m.config.TargetMode
	var targetPlayerID string

	if targetMode == "least_clues" && len(m.playerClueCount) > 0 {
		minCount := -1
		var minPlayer uuid.UUID
		for pid, count := range m.playerClueCount {
			if minCount < 0 || count < minCount {
				minCount = count
				minPlayer = pid
			}
		}
		targetPlayerID = minPlayer.String()
	}

	m.distributedCount++
	m.lastDistribution = now
	count := m.distributedCount
	m.mu.Unlock()

	m.deps.EventBus.Publish(engine.Event{
		Type: "clue.timed_distributed",
		Payload: map[string]any{
			"clueId":           clueID,
			"targetMode":       targetMode,
			"targetPlayerId":   targetPlayerID,
			"distributedCount": count,
		},
	})

	return nil
}

// selectNextClue returns the next clue ID from the pool, or a generated ID.
// Must be called with m.mu held.
func (m *TimedClueModule) selectNextClue() string {
	if len(m.timedCluePool) > 0 && m.nextClueIndex < len(m.timedCluePool) {
		clueID := m.timedCluePool[m.nextClueIndex]
		m.nextClueIndex++
		return clueID
	}
	// Generate a clue ID if no pool.
	return fmt.Sprintf("timed_clue_%d", m.distributedCount+1)
}

type timedClueState struct {
	DistributedCount int    `json:"distributedCount"`
	MaxAutoClues     int    `json:"maxAutoClues"`
	IsActive         bool   `json:"isActive"`
	Interval         int    `json:"interval"`
	TargetMode       string `json:"targetMode"`
}

func (m *TimedClueModule) BuildState() (json.RawMessage, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	return json.Marshal(timedClueState{
		DistributedCount: m.distributedCount,
		MaxAutoClues:     m.config.MaxAutoClues,
		IsActive:         m.isActive,
		Interval:         m.config.Interval,
		TargetMode:       m.config.TargetMode,
	})
}

func (m *TimedClueModule) Cleanup(_ context.Context) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	m.playerClueCount = nil
	m.timedCluePool = nil
	m.isActive = false
	return nil
}

// --- ConfigSchema ---

func (m *TimedClueModule) Schema() json.RawMessage {
	schema := map[string]any{
		"type": "object",
		"properties": map[string]any{
			"interval":     map[string]any{"type": "integer", "default": 120, "minimum": 1, "description": "Seconds between auto-distributions"},
			"maxAutoClues": map[string]any{"type": "integer", "default": 5, "minimum": 1, "description": "Maximum number of auto-distributed clues"},
			"targetMode": map[string]any{
				"type":    "string",
				"enum":    []string{"all", "random_player", "least_clues"},
				"default": "all",
				"description": "Target selection mode for timed clue distribution",
			},
			"cluePool": map[string]any{
				"type":  "array",
				"items": map[string]any{"type": "string"},
				"description": "Pool of clue IDs to distribute in order",
			},
		},
		"additionalProperties": false,
	}
	data, _ := json.Marshal(schema)
	return data
}

// --- SerializableModule ---

func (m *TimedClueModule) SaveState(_ context.Context) (engine.GameState, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	data, err := json.Marshal(timedClueState{
		DistributedCount: m.distributedCount,
		MaxAutoClues:     m.config.MaxAutoClues,
		IsActive:         m.isActive,
		Interval:         m.config.Interval,
		TargetMode:       m.config.TargetMode,
	})
	if err != nil {
		return engine.GameState{}, fmt.Errorf("timed_clue: save state: %w", err)
	}
	return engine.GameState{
		Modules: map[string]json.RawMessage{
			m.Name(): data,
		},
	}, nil
}

func (m *TimedClueModule) RestoreState(_ context.Context, _ uuid.UUID, state engine.GameState) error {
	raw, ok := state.Modules[m.Name()]
	if !ok {
		return nil
	}
	var s timedClueState
	if err := json.Unmarshal(raw, &s); err != nil {
		return fmt.Errorf("timed_clue: restore state: %w", err)
	}
	m.mu.Lock()
	defer m.mu.Unlock()
	m.distributedCount = s.DistributedCount
	m.isActive = s.IsActive
	return nil
}

// Compile-time interface assertions.
var (
	_ engine.Module             = (*TimedClueModule)(nil)
	_ engine.ConfigSchema       = (*TimedClueModule)(nil)
	_ engine.SerializableModule = (*TimedClueModule)(nil)
)
