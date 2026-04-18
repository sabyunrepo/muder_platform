// Package accusation implements the player-vs-player accusation mechanic:
// one player accuses another, a bounded defense window opens, remaining
// players vote guilty/innocent, and the outcome is resolved once the
// threshold is met or all eligible voters have voted.
package accusation

import (
	"context"
	"encoding/json"
	"fmt"
	"sync"
	"time"

	"github.com/mmp-platform/server/internal/engine"
)

// AccusationModule handles player accusation mechanics.
type AccusationModule struct {
	mu                sync.RWMutex
	deps              engine.ModuleDeps
	config            AccusationConfig
	activeAccusation  *Accusation
	accusationCount   int
	isActive          bool
	expelledCode      string // code of most recently expelled player
	expelledIsCulprit bool   // true when expelled player was the actual culprit

	// timeNow is injectable for testing.
	timeNow func() time.Time
}

// NewAccusationModule creates a new AccusationModule instance.
func NewAccusationModule() *AccusationModule {
	return &AccusationModule{
		timeNow: time.Now,
	}
}

// Name returns the module identifier.
func (m *AccusationModule) Name() string { return "accusation" }

// Init initialises the module with session context and configuration.
func (m *AccusationModule) Init(_ context.Context, deps engine.ModuleDeps, config json.RawMessage) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	m.deps = deps

	// Apply defaults.
	m.config = AccusationConfig{
		MaxPerRound:     1,
		DefenseTime:     60,
		VoteThreshold:   50,
		AllowSelfAccuse: false,
		DeadCanAccuse:   false,
	}

	if config != nil && len(config) > 0 {
		var cfg AccusationConfig
		if err := json.Unmarshal(config, &cfg); err != nil {
			return fmt.Errorf("accusation: invalid config: %w", err)
		}
		if cfg.MaxPerRound > 0 {
			m.config.MaxPerRound = cfg.MaxPerRound
		}
		if cfg.DefenseTime > 0 {
			m.config.DefenseTime = cfg.DefenseTime
		}
		if cfg.VoteThreshold > 0 {
			m.config.VoteThreshold = cfg.VoteThreshold
		}
		m.config.AllowSelfAccuse = cfg.AllowSelfAccuse
		m.config.DeadCanAccuse = cfg.DeadCanAccuse
	}

	m.activeAccusation = nil
	m.accusationCount = 0
	m.isActive = false
	return nil
}

// Cleanup releases resources when the session ends.
func (m *AccusationModule) Cleanup(_ context.Context) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	m.activeAccusation = nil
	m.isActive = false
	m.expelledCode = ""
	m.expelledIsCulprit = false
	return nil
}

// Compile-time interface checks.
var (
	_ engine.Module            = (*AccusationModule)(nil)
	_ engine.ConfigSchema      = (*AccusationModule)(nil)
	_ engine.GameEventHandler  = (*AccusationModule)(nil)
	_ engine.WinChecker        = (*AccusationModule)(nil)
	_ engine.PhaseHookModule   = (*AccusationModule)(nil)
	_ engine.PlayerAwareModule = (*AccusationModule)(nil)
)

func init() {
	engine.Register("accusation", func() engine.Module { return NewAccusationModule() })
}

// OnPhaseEnter resets accusation count for a new phase / round.
func (m *AccusationModule) OnPhaseEnter(_ context.Context, _ engine.Phase) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	// Reset accusation count when entering a new phase (new round of accusations).
	m.accusationCount = 0
	m.activeAccusation = nil
	m.isActive = false
	return nil
}

// OnPhaseExit locks any in-progress accusation when leaving a phase.
func (m *AccusationModule) OnPhaseExit(_ context.Context, _ engine.Phase) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	// Lock down any in-progress accusation when leaving a phase.
	m.activeAccusation = nil
	m.isActive = false
	return nil
}
