package progression

import (
	"context"
	"encoding/json"
	"fmt"
	"sync"

	"github.com/google/uuid"
	"github.com/mmp-platform/server/internal/engine"
)

// SkipConsensusModule manages skip vote consensus for script progression.
// Requires: script_progression module.
//
// PR-2a: declares public state — active request flag, votes, and required
// ratio are shared by all players for the skip-prompt UI.
type SkipConsensusModule struct {
	engine.PublicStateMarker

	mu   sync.RWMutex
	deps engine.ModuleDeps

	// config
	autoAgreeTimeout int
	requiredRatio    int

	// state
	skipVotes     map[uuid.UUID]bool
	totalPlayers  int
	activeRequest bool
}

type skipConsensusConfig struct {
	AutoAgreeTimeout int `json:"AutoAgreeTimeout"`
	RequiredRatio    int `json:"RequiredRatio"`
	TotalPlayers     int `json:"TotalPlayers"`
}

// NewSkipConsensusModule creates a new SkipConsensusModule instance.
func NewSkipConsensusModule() *SkipConsensusModule {
	return &SkipConsensusModule{}
}

func (m *SkipConsensusModule) Name() string { return "skip_consensus" }

func (m *SkipConsensusModule) Init(ctx context.Context, deps engine.ModuleDeps, config json.RawMessage) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	m.deps = deps

	var cfg skipConsensusConfig
	if config != nil && len(config) > 0 {
		if err := json.Unmarshal(config, &cfg); err != nil {
			return fmt.Errorf("skip_consensus: invalid config: %w", err)
		}
	}

	// Apply defaults
	if cfg.AutoAgreeTimeout <= 0 {
		cfg.AutoAgreeTimeout = 10
	}
	if cfg.RequiredRatio <= 0 {
		cfg.RequiredRatio = 100
	}

	m.autoAgreeTimeout = cfg.AutoAgreeTimeout
	m.requiredRatio = cfg.RequiredRatio
	m.totalPlayers = cfg.TotalPlayers
	m.skipVotes = make(map[uuid.UUID]bool)
	m.activeRequest = false

	return nil
}

func (m *SkipConsensusModule) HandleMessage(ctx context.Context, playerID uuid.UUID, msgType string, payload json.RawMessage) error {
	m.mu.Lock()

	switch msgType {
	case "skip:request":
		if m.activeRequest {
			m.mu.Unlock()
			return fmt.Errorf("skip_consensus: skip vote already active")
		}
		m.activeRequest = true
		m.skipVotes = make(map[uuid.UUID]bool)
		m.skipVotes[playerID] = true // requester auto-agrees

		ratioMet := m.checkRatio()
		m.mu.Unlock()

		m.deps.EventBus.Publish(engine.Event{
			Type:    "skip.requested",
			Payload: map[string]any{"requestedBy": playerID.String()},
		})

		// Check if single player already meets ratio
		if ratioMet {
			m.resolveSkip(true)
		}
		return nil

	case "skip:agree":
		if !m.activeRequest {
			m.mu.Unlock()
			return fmt.Errorf("skip_consensus: no active skip request")
		}
		m.skipVotes[playerID] = true

		ratioMet := m.checkRatio()
		m.mu.Unlock()

		if ratioMet {
			m.resolveSkip(true)
		}
		return nil

	case "skip:disagree":
		if !m.activeRequest {
			m.mu.Unlock()
			return fmt.Errorf("skip_consensus: no active skip request")
		}
		m.skipVotes[playerID] = false

		// Check if it's impossible to reach threshold
		impossible := m.checkImpossible()
		m.mu.Unlock()

		if impossible {
			m.resolveSkip(false)
		}
		return nil

	default:
		m.mu.Unlock()
		return fmt.Errorf("skip_consensus: unknown message type %q", msgType)
	}
}

// checkRatio returns true if the approval ratio meets the required threshold.
// Must be called with m.mu held.
func (m *SkipConsensusModule) checkRatio() bool {
	if m.totalPlayers <= 0 {
		return false
	}
	approvals := 0
	for _, v := range m.skipVotes {
		if v {
			approvals++
		}
	}
	ratio := (approvals * 100) / m.totalPlayers
	return ratio >= m.requiredRatio
}

// checkImpossible returns true if the required ratio can no longer be reached.
// Must be called with m.mu held.
func (m *SkipConsensusModule) checkImpossible() bool {
	if m.totalPlayers <= 0 {
		return false
	}
	disagrees := 0
	for _, v := range m.skipVotes {
		if !v {
			disagrees++
		}
	}
	maxApprovals := m.totalPlayers - disagrees
	maxRatio := (maxApprovals * 100) / m.totalPlayers
	return maxRatio < m.requiredRatio
}

// resolveSkip publishes the resolution and resets the vote state.
func (m *SkipConsensusModule) resolveSkip(approved bool) {
	m.deps.EventBus.Publish(engine.Event{
		Type:    "skip.resolved",
		Payload: map[string]any{"Approved": approved},
	})

	m.mu.Lock()
	m.activeRequest = false
	m.skipVotes = make(map[uuid.UUID]bool)
	m.mu.Unlock()
}

func (m *SkipConsensusModule) BuildState() (json.RawMessage, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	votes := make(map[string]bool, len(m.skipVotes))
	for id, v := range m.skipVotes {
		votes[id.String()] = v
	}

	state := map[string]any{
		"activeRequest": m.activeRequest,
		"votes":         votes,
		"requiredRatio": m.requiredRatio,
	}
	return json.Marshal(state)
}

func (m *SkipConsensusModule) Cleanup(ctx context.Context) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	m.skipVotes = nil
	m.activeRequest = false
	return nil
}

// Schema returns the JSON Schema for SkipConsensusModule settings.
func (m *SkipConsensusModule) Schema() json.RawMessage {
	return json.RawMessage(`{
		"type": "object",
		"properties": {
			"AutoAgreeTimeout": {"type": "integer", "default": 10},
			"RequiredRatio": {"type": "integer", "default": 100, "minimum": 1, "maximum": 100},
			"TotalPlayers": {"type": "integer", "minimum": 1}
		}
	}`)
}

// --- PhaseHookModule ---

func (m *SkipConsensusModule) OnPhaseEnter(_ context.Context, _ engine.Phase) error {
	return nil
}

func (m *SkipConsensusModule) OnPhaseExit(_ context.Context, _ engine.Phase) error {
	return nil
}

// Compile-time interface checks.
var (
	_ engine.Module            = (*SkipConsensusModule)(nil)
	_ engine.ConfigSchema      = (*SkipConsensusModule)(nil)
	_ engine.PhaseHookModule   = (*SkipConsensusModule)(nil)
	_ engine.PublicStateModule = (*SkipConsensusModule)(nil)
)

func init() {
	engine.Register("skip_consensus", func() engine.Module { return NewSkipConsensusModule() })
}
