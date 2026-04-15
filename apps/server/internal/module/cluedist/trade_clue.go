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
	engine.Register("trade_clue", func() engine.Module { return NewTradeClueModule() })
}

// TradeClueConfig defines settings for the trade clue module.
type TradeClueConfig struct {
	AllowTrade           bool `json:"allowTrade"`
	AllowShow            bool `json:"allowShow"`
	ShowDuration         int  `json:"showDuration"` // seconds
	ShowMaxViewers       int  `json:"showMaxViewers"`
	RequireMutualTrade   bool `json:"requireMutualTrade"`
	TradeProposalTimeout int  `json:"tradeProposalTimeout"` // seconds
}

// TradeProposal represents an active clue trade proposal.
type TradeProposal struct {
	ID              string    `json:"id"`
	ProposerID      uuid.UUID `json:"proposerId"`
	TargetID        string    `json:"targetId"` // character code
	OfferedClueID   string    `json:"offeredClueId"`
	RequestedClueID string    `json:"requestedClueId"`
	CreatedAt       time.Time `json:"createdAt"`
	Status          string    `json:"status"` // "pending", "accepted", "declined", "expired"
}

// ShowSession represents an active clue-showing session.
type ShowSession struct {
	ID        string    `json:"id"`
	OwnerID   uuid.UUID `json:"ownerId"`
	ViewerID  string    `json:"viewerId"` // character code
	ClueID    string    `json:"clueId"`
	ExpiresAt time.Time `json:"expiresAt"`
	Status    string    `json:"status"` // "pending", "active", "declined", "expired"
}

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

func (m *TradeClueModule) Name() string { return "trade_clue" }

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

// --- HandleMessage ---

type tradeProposalPayload struct {
	TargetCode      string `json:"targetCode"`
	OfferedClueID   string `json:"offeredClueId"`
	RequestedClueID string `json:"requestedClueId"`
}

type tradeResponsePayload struct {
	ProposalID string `json:"proposalId"`
}

type showRequestPayload struct {
	TargetCode string `json:"targetCode"`
	ClueID     string `json:"clueId"`
}

type showResponsePayload struct {
	SessionID string `json:"sessionId"`
}

func (m *TradeClueModule) HandleMessage(_ context.Context, playerID uuid.UUID, msgType string, payload json.RawMessage) error {
	switch msgType {
	case "clue:trade_propose":
		return m.handleTradePropose(playerID, payload)
	case "clue:trade_accept":
		return m.handleTradeAccept(playerID, payload)
	case "clue:trade_decline":
		return m.handleTradeDecline(playerID, payload)
	case "clue:show_request":
		return m.handleShowRequest(playerID, payload)
	case "clue:show_accept":
		return m.handleShowAccept(playerID, payload)
	case "clue:show_decline":
		return m.handleShowDecline(playerID, payload)
	default:
		return fmt.Errorf("trade_clue: unknown message type %q", msgType)
	}
}

func (m *TradeClueModule) handleTradePropose(playerID uuid.UUID, payload json.RawMessage) error {
	var p tradeProposalPayload
	if err := json.Unmarshal(payload, &p); err != nil {
		return fmt.Errorf("trade_clue: invalid trade_propose payload: %w", err)
	}

	m.mu.Lock()
	if !m.exchangeAllowed {
		m.mu.Unlock()
		return fmt.Errorf("trade_clue: exchange not allowed in current phase")
	}
	if !m.config.AllowTrade {
		m.mu.Unlock()
		return fmt.Errorf("trade_clue: trading is disabled")
	}

	proposalID := uuid.New().String()
	now := m.nowFunc()
	proposal := &TradeProposal{
		ID:              proposalID,
		ProposerID:      playerID,
		TargetID:        p.TargetCode,
		OfferedClueID:   p.OfferedClueID,
		RequestedClueID: p.RequestedClueID,
		CreatedAt:       now,
		Status:          "pending",
	}
	m.activeProposals[proposalID] = proposal
	m.mu.Unlock()

	m.deps.EventBus.Publish(engine.Event{
		Type: "clue.trade_proposed",
		Payload: map[string]any{
			"proposalId":      proposalID,
			"proposerId":      playerID.String(),
			"targetCode":      p.TargetCode,
			"offeredClueId":   p.OfferedClueID,
			"requestedClueId": p.RequestedClueID,
		},
	})
	return nil
}

func (m *TradeClueModule) handleTradeAccept(playerID uuid.UUID, payload json.RawMessage) error {
	var p tradeResponsePayload
	if err := json.Unmarshal(payload, &p); err != nil {
		return fmt.Errorf("trade_clue: invalid trade_accept payload: %w", err)
	}

	m.mu.Lock()
	proposal, ok := m.activeProposals[p.ProposalID]
	if !ok {
		m.mu.Unlock()
		return fmt.Errorf("trade_clue: proposal %q not found", p.ProposalID)
	}
	if proposal.Status != "pending" {
		m.mu.Unlock()
		return fmt.Errorf("trade_clue: proposal %q is not pending (status: %s)", p.ProposalID, proposal.Status)
	}

	// Check timeout.
	now := m.nowFunc()
	if now.Sub(proposal.CreatedAt) > time.Duration(m.config.TradeProposalTimeout)*time.Second {
		delete(m.activeProposals, p.ProposalID)
		m.mu.Unlock()
		return fmt.Errorf("trade_clue: proposal %q has expired", p.ProposalID)
	}

	// Remove completed proposal from map.
	delete(m.activeProposals, p.ProposalID)
	m.mu.Unlock()

	m.deps.EventBus.Publish(engine.Event{
		Type: "clue.trade_accepted",
		Payload: map[string]any{
			"proposalId":      p.ProposalID,
			"proposerId":      proposal.ProposerID.String(),
			"accepterId":      playerID.String(),
			"offeredClueId":   proposal.OfferedClueID,
			"requestedClueId": proposal.RequestedClueID,
		},
	})
	return nil
}

func (m *TradeClueModule) handleTradeDecline(playerID uuid.UUID, payload json.RawMessage) error {
	var p tradeResponsePayload
	if err := json.Unmarshal(payload, &p); err != nil {
		return fmt.Errorf("trade_clue: invalid trade_decline payload: %w", err)
	}

	m.mu.Lock()
	proposal, ok := m.activeProposals[p.ProposalID]
	if !ok {
		m.mu.Unlock()
		return fmt.Errorf("trade_clue: proposal %q not found", p.ProposalID)
	}
	if proposal.Status != "pending" {
		m.mu.Unlock()
		return fmt.Errorf("trade_clue: proposal %q is not pending (status: %s)", p.ProposalID, proposal.Status)
	}
	// Remove completed proposal from map.
	delete(m.activeProposals, p.ProposalID)
	m.mu.Unlock()

	m.deps.EventBus.Publish(engine.Event{
		Type: "clue.trade_declined",
		Payload: map[string]any{
			"proposalId": p.ProposalID,
			"declinerId": playerID.String(),
		},
	})
	return nil
}

func (m *TradeClueModule) handleShowRequest(playerID uuid.UUID, payload json.RawMessage) error {
	var p showRequestPayload
	if err := json.Unmarshal(payload, &p); err != nil {
		return fmt.Errorf("trade_clue: invalid show_request payload: %w", err)
	}

	m.mu.Lock()
	if !m.exchangeAllowed {
		m.mu.Unlock()
		return fmt.Errorf("trade_clue: exchange not allowed in current phase")
	}
	if !m.config.AllowShow {
		m.mu.Unlock()
		return fmt.Errorf("trade_clue: showing is disabled")
	}

	// Check max viewers for this clue.
	activeViewers := 0
	for _, s := range m.activeShows {
		if s.OwnerID == playerID && s.ClueID == p.ClueID && (s.Status == "pending" || s.Status == "active") {
			activeViewers++
		}
	}
	if activeViewers >= m.config.ShowMaxViewers {
		m.mu.Unlock()
		return fmt.Errorf("trade_clue: max viewers (%d) reached for clue %q", m.config.ShowMaxViewers, p.ClueID)
	}

	sessionID := uuid.New().String()
	session := &ShowSession{
		ID:       sessionID,
		OwnerID:  playerID,
		ViewerID: p.TargetCode,
		ClueID:   p.ClueID,
		Status:   "pending",
	}
	m.activeShows[sessionID] = session
	m.mu.Unlock()

	m.deps.EventBus.Publish(engine.Event{
		Type: "clue.show_requested",
		Payload: map[string]any{
			"sessionId":  sessionID,
			"ownerId":    playerID.String(),
			"targetCode": p.TargetCode,
			"clueId":     p.ClueID,
		},
	})
	return nil
}

func (m *TradeClueModule) handleShowAccept(_ uuid.UUID, payload json.RawMessage) error {
	var p showResponsePayload
	if err := json.Unmarshal(payload, &p); err != nil {
		return fmt.Errorf("trade_clue: invalid show_accept payload: %w", err)
	}

	m.mu.Lock()
	session, ok := m.activeShows[p.SessionID]
	if !ok {
		m.mu.Unlock()
		return fmt.Errorf("trade_clue: show session %q not found", p.SessionID)
	}
	if session.Status != "pending" {
		m.mu.Unlock()
		return fmt.Errorf("trade_clue: show session %q is not pending (status: %s)", p.SessionID, session.Status)
	}

	session.Status = "active"
	session.ExpiresAt = m.nowFunc().Add(time.Duration(m.config.ShowDuration) * time.Second)
	m.mu.Unlock()

	m.deps.EventBus.Publish(engine.Event{
		Type: "clue.show_started",
		Payload: map[string]any{
			"sessionId": p.SessionID,
			"ownerId":   session.OwnerID.String(),
			"viewerId":  session.ViewerID,
			"clueId":    session.ClueID,
			"expiresAt": session.ExpiresAt.Unix(),
		},
	})
	return nil
}

func (m *TradeClueModule) handleShowDecline(_ uuid.UUID, payload json.RawMessage) error {
	var p showResponsePayload
	if err := json.Unmarshal(payload, &p); err != nil {
		return fmt.Errorf("trade_clue: invalid show_decline payload: %w", err)
	}

	m.mu.Lock()
	session, ok := m.activeShows[p.SessionID]
	if !ok {
		m.mu.Unlock()
		return fmt.Errorf("trade_clue: show session %q not found", p.SessionID)
	}
	if session.Status != "pending" {
		m.mu.Unlock()
		return fmt.Errorf("trade_clue: show session %q is not pending (status: %s)", p.SessionID, session.Status)
	}
	// Remove completed show session from map.
	delete(m.activeShows, p.SessionID)
	m.mu.Unlock()

	m.deps.EventBus.Publish(engine.Event{
		Type: "clue.show_declined",
		Payload: map[string]any{
			"sessionId": p.SessionID,
		},
	})
	return nil
}

// --- PhaseReactor ---

func (m *TradeClueModule) ReactTo(_ context.Context, action engine.PhaseActionPayload) error {
	switch action.Action {
	case engine.ActionAllowExchange:
		var params struct {
			Allowed bool `json:"allowed"`
		}
		// Default to true if no params provided.
		params.Allowed = true
		if action.Params != nil && len(action.Params) > 0 {
			if err := json.Unmarshal(action.Params, &params); err != nil {
				return fmt.Errorf("trade_clue: invalid ALLOW_EXCHANGE params: %w", err)
			}
		}
		m.mu.Lock()
		m.exchangeAllowed = params.Allowed
		m.mu.Unlock()
		return nil
	default:
		return fmt.Errorf("trade_clue: unsupported action %q", action.Action)
	}
}

func (m *TradeClueModule) SupportedActions() []engine.PhaseAction {
	return []engine.PhaseAction{engine.ActionAllowExchange}
}

// --- ConfigSchema ---

func (m *TradeClueModule) Schema() json.RawMessage {
	schema := map[string]any{
		"type": "object",
		"properties": map[string]any{
			"allowTrade":           map[string]any{"type": "boolean", "default": true, "description": "Allow clue trading between players"},
			"allowShow":            map[string]any{"type": "boolean", "default": true, "description": "Allow showing clues to other players"},
			"showDuration":         map[string]any{"type": "integer", "default": 30, "minimum": 1, "description": "Duration in seconds for show sessions"},
			"showMaxViewers":       map[string]any{"type": "integer", "default": 1, "minimum": 1, "description": "Maximum concurrent viewers per clue show"},
			"requireMutualTrade":   map[string]any{"type": "boolean", "default": false, "description": "Require both parties to offer a clue"},
			"tradeProposalTimeout": map[string]any{"type": "integer", "default": 60, "minimum": 1, "description": "Seconds before a trade proposal expires"},
		},
		"additionalProperties": false,
	}
	data, _ := json.Marshal(schema)
	return data
}

type tradeClueState struct {
	ActiveProposals map[string]*TradeProposal `json:"activeProposals"`
	ActiveShows     map[string]*ShowSession   `json:"activeShows"`
	ExchangeAllowed bool                      `json:"exchangeAllowed"`
	Config          TradeClueConfig           `json:"config"`
}

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

func (m *TradeClueModule) Cleanup(_ context.Context) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	m.activeProposals = nil
	m.activeShows = nil
	return nil
}

// --- SerializableModule ---

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

// Compile-time interface assertions.
var (
	_ engine.Module             = (*TradeClueModule)(nil)
	_ engine.ConfigSchema       = (*TradeClueModule)(nil)
	_ engine.PhaseReactor       = (*TradeClueModule)(nil)
	_ engine.SerializableModule = (*TradeClueModule)(nil)
)
