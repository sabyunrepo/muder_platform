package trade_clue

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/mmp-platform/server/internal/engine"
)

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

// HandleMessage dispatches trade / show related WS messages.
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
