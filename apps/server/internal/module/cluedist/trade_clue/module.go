// Package trade_clue implements the clue trade / show mechanic — players
// may propose swaps of their private clues, respond to proposals, or show
// a clue to another player for a bounded window. All actions are gated by
// an ALLOW_EXCHANGE phase action so the engine controls when trading is
// permitted.
package trade_clue

import (
	"context"
	"encoding/json"
	"fmt"
	"sync"
	"time"

	"github.com/mmp-platform/server/internal/engine"
)

// TradeClueModule manages clue trading and showing between players.
type TradeClueModule struct {
	mu              sync.RWMutex
	deps            engine.ModuleDeps
	config          TradeClueConfig
	activeProposals map[string]*TradeProposal
	activeShows     map[string]*ShowSession
	exchangeAllowed bool

	// nowFunc allows testing with a controllable clock.
	nowFunc func() time.Time
}

// NewTradeClueModule creates a new TradeClueModule instance.
func NewTradeClueModule() *TradeClueModule {
	return &TradeClueModule{
		nowFunc: time.Now,
	}
}

// Name returns the module identifier.
func (m *TradeClueModule) Name() string { return "trade_clue" }

// Init initialises the module with session context and configuration.
func (m *TradeClueModule) Init(_ context.Context, deps engine.ModuleDeps, config json.RawMessage) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	m.deps = deps
	m.activeProposals = make(map[string]*TradeProposal)
	m.activeShows = make(map[string]*ShowSession)
	m.exchangeAllowed = false

	// Apply defaults.
	m.config = TradeClueConfig{
		AllowTrade:           true,
		AllowShow:            true,
		ShowDuration:         30,
		ShowMaxViewers:       1,
		RequireMutualTrade:   false,
		TradeProposalTimeout: 60,
	}

	// Unmarshal directly into m.config — only provided JSON fields overwrite defaults.
	if config != nil && len(config) > 0 {
		if err := json.Unmarshal(config, &m.config); err != nil {
			return fmt.Errorf("trade_clue: invalid config: %w", err)
		}
	}

	return nil
}

// Cleanup releases resources when the session ends.
func (m *TradeClueModule) Cleanup(_ context.Context) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	m.activeProposals = nil
	m.activeShows = nil
	return nil
}

// Compile-time interface assertions.
var (
	_ engine.Module             = (*TradeClueModule)(nil)
	_ engine.ConfigSchema       = (*TradeClueModule)(nil)
	_ engine.PhaseReactor       = (*TradeClueModule)(nil)
	_ engine.SerializableModule = (*TradeClueModule)(nil)
	_ engine.PlayerAwareModule  = (*TradeClueModule)(nil)
)

func init() {
	engine.Register("trade_clue", func() engine.Module { return NewTradeClueModule() })
}
