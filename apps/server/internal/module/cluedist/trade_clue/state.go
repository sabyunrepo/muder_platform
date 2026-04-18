package trade_clue

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/google/uuid"
	"github.com/mmp-platform/server/internal/engine"
)

type tradeClueState struct {
	ActiveProposals map[string]*TradeProposal `json:"activeProposals"`
	ActiveShows     map[string]*ShowSession   `json:"activeShows"`
	ExchangeAllowed bool                      `json:"exchangeAllowed"`
	Config          TradeClueConfig           `json:"config"`
}

// BuildState returns the public module state for client sync.
func (m *TradeClueModule) BuildState() (json.RawMessage, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	return json.Marshal(tradeClueState{
		ActiveProposals: m.activeProposals,
		ActiveShows:     m.activeShows,
		ExchangeAllowed: m.exchangeAllowed,
		Config:          m.config,
	})
}

// BuildStateFor implements engine.PlayerAwareModule — exposes only the trade
// proposals and show sessions the caller is party to (as proposer or target).
// Other players' pending trades are never revealed.
func (m *TradeClueModule) BuildStateFor(playerID uuid.UUID) (json.RawMessage, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	ownProposals := make(map[string]*TradeProposal)
	for id, p := range m.activeProposals {
		if p == nil {
			continue
		}
		if p.ProposerID == playerID || p.TargetID == playerID.String() {
			ownProposals[id] = p
		}
	}

	ownShows := make(map[string]*ShowSession)
	for id, s := range m.activeShows {
		if s == nil {
			continue
		}
		if s.OwnerID == playerID || s.ViewerID == playerID.String() {
			ownShows[id] = s
		}
	}

	return json.Marshal(tradeClueState{
		ActiveProposals: ownProposals,
		ActiveShows:     ownShows,
		ExchangeAllowed: m.exchangeAllowed,
		Config:          m.config,
	})
}

// --- SerializableModule ---

// SaveState snapshots the module's persistable state.
func (m *TradeClueModule) SaveState(_ context.Context) (engine.GameState, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	data, err := json.Marshal(tradeClueState{
		ActiveProposals: m.activeProposals,
		ActiveShows:     m.activeShows,
		ExchangeAllowed: m.exchangeAllowed,
		Config:          m.config,
	})
	if err != nil {
		return engine.GameState{}, fmt.Errorf("trade_clue: save state: %w", err)
	}
	return engine.GameState{
		Modules: map[string]json.RawMessage{
			m.Name(): data,
		},
	}, nil
}

// RestoreState deserialises a previously persisted state.
func (m *TradeClueModule) RestoreState(_ context.Context, _ uuid.UUID, state engine.GameState) error {
	raw, ok := state.Modules[m.Name()]
	if !ok {
		return nil
	}
	var s tradeClueState
	if err := json.Unmarshal(raw, &s); err != nil {
		return fmt.Errorf("trade_clue: restore state: %w", err)
	}
	m.mu.Lock()
	defer m.mu.Unlock()
	m.activeProposals = s.ActiveProposals
	if m.activeProposals == nil {
		m.activeProposals = make(map[string]*TradeProposal)
	}
	m.activeShows = s.ActiveShows
	if m.activeShows == nil {
		m.activeShows = make(map[string]*ShowSession)
	}
	m.exchangeAllowed = s.ExchangeAllowed
	m.config = s.Config
	return nil
}
