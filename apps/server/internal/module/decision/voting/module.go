// Package voting implements the voting module — an open / secret multi-round
// plurality vote with configurable tie-breaking, minimum participation, and
// optional abstentions. Sessions typically open one round of voting per phase
// via the ActionOpenVoting reaction.
package voting

import (
	"context"
	"encoding/json"
	"fmt"
	"sync"

	"github.com/google/uuid"
	"github.com/mmp-platform/server/internal/engine"
)

// VotingModule handles voting mechanics during game phases.
type VotingModule struct {
	mu           sync.RWMutex
	deps         engine.ModuleDeps
	config       VotingConfig
	votes        map[uuid.UUID]string // playerID → targetCode
	isOpen       bool
	currentRound int
	totalPlayers int
	alivePlayers int
	lastResult   *VoteResult // populated after each closeVoting
}

// NewVotingModule creates a new VotingModule instance.
func NewVotingModule() *VotingModule {
	return &VotingModule{}
}

// Name returns the module identifier.
func (m *VotingModule) Name() string { return "voting" }

// Init initialises the module with session context and configuration.
func (m *VotingModule) Init(_ context.Context, deps engine.ModuleDeps, config json.RawMessage) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	m.deps = deps
	m.votes = make(map[uuid.UUID]string)

	// Apply defaults.
	m.config = VotingConfig{
		Mode:             "open",
		MinParticipation: 75,
		TieBreaker:       "revote",
		ShowRealtime:     true,
		RevealVoters:     false,
		AllowAbstain:     false,
		MaxRounds:        3,
		DeadCanVote:      false,
	}

	if config != nil && len(config) > 0 {
		var cfg VotingConfig
		if err := json.Unmarshal(config, &cfg); err != nil {
			return fmt.Errorf("voting: invalid config: %w", err)
		}
		if cfg.Mode != "" {
			m.config.Mode = cfg.Mode
		}
		if cfg.MinParticipation > 0 {
			m.config.MinParticipation = cfg.MinParticipation
		}
		if cfg.TieBreaker != "" {
			m.config.TieBreaker = cfg.TieBreaker
		}
		m.config.ShowRealtime = cfg.ShowRealtime
		m.config.RevealVoters = cfg.RevealVoters
		m.config.AllowAbstain = cfg.AllowAbstain
		m.config.DeadCanVote = cfg.DeadCanVote
		if cfg.MaxRounds > 0 {
			m.config.MaxRounds = cfg.MaxRounds
		}
	}

	m.currentRound = 0
	return nil
}

// Cleanup releases resources when the session ends.
func (m *VotingModule) Cleanup(_ context.Context) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	m.votes = nil
	m.isOpen = false
	m.lastResult = nil
	return nil
}

// Compile-time interface checks.
var (
	_ engine.Module             = (*VotingModule)(nil)
	_ engine.PhaseReactor       = (*VotingModule)(nil)
	_ engine.ConfigSchema       = (*VotingModule)(nil)
	_ engine.GameEventHandler   = (*VotingModule)(nil)
	_ engine.WinChecker         = (*VotingModule)(nil)
	_ engine.SerializableModule = (*VotingModule)(nil)
	_ engine.RuleProvider       = (*VotingModule)(nil)
	_ engine.PlayerAwareModule  = (*VotingModule)(nil)
)

func init() {
	engine.Register("voting", func() engine.Module { return NewVotingModule() })
}
