package cluedist

import (
	"context"
	"encoding/json"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/mmp-platform/server/internal/engine"
)

func TestTradeClueModule_Name(t *testing.T) {
	m := NewTradeClueModule()
	if m.Name() != "trade_clue" {
		t.Fatalf("expected %q, got %q", "trade_clue", m.Name())
	}
}

func TestTradeClueModule_Init(t *testing.T) {
	tests := []struct {
		name          string
		config        json.RawMessage
		wantTrade     bool
		wantShow      bool
		wantDuration  int
		wantTimeout   int
		wantErr       bool
	}{
		{
			name:         "defaults with nil config",
			config:       nil,
			wantTrade:    true,
			wantShow:     true,
			wantDuration: 30,
			wantTimeout:  60,
		},
		{
			name:         "custom config",
			config:       json.RawMessage(`{"allowTrade":false,"allowShow":false,"showDuration":10,"tradeProposalTimeout":30}`),
			wantTrade:    false,
			wantShow:     false,
			wantDuration: 10,
			wantTimeout:  30,
		},
		{
			name:    "invalid JSON",
			config:  json.RawMessage(`{bad}`),
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			m := NewTradeClueModule()
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
			if m.config.AllowTrade != tt.wantTrade {
				t.Fatalf("allowTrade = %v, want %v", m.config.AllowTrade, tt.wantTrade)
			}
			if m.config.AllowShow != tt.wantShow {
				t.Fatalf("allowShow = %v, want %v", m.config.AllowShow, tt.wantShow)
			}
			if m.config.ShowDuration != tt.wantDuration {
				t.Fatalf("showDuration = %d, want %d", m.config.ShowDuration, tt.wantDuration)
			}
			if m.config.TradeProposalTimeout != tt.wantTimeout {
				t.Fatalf("tradeProposalTimeout = %d, want %d", m.config.TradeProposalTimeout, tt.wantTimeout)
			}
		})
	}
}

// Helper to enable exchange on a trade module.
func enableExchange(t *testing.T, m *TradeClueModule) {
	t.Helper()
	err := m.ReactTo(context.Background(), engine.PhaseActionPayload{
		Action: engine.ActionAllowExchange,
		Params: json.RawMessage(`{"allowed":true}`),
	})
	if err != nil {
		t.Fatalf("ReactTo ALLOW_EXCHANGE failed: %v", err)
	}
}

func TestTradeClueModule_TradePropose(t *testing.T) {
	deps := newTestDeps()
	m := NewTradeClueModule()
	_ = m.Init(context.Background(), deps, nil)
	enableExchange(t, m)

	var proposed bool
	deps.EventBus.Subscribe("clue.trade_proposed", func(_ engine.Event) {
		proposed = true
	})

	playerID := uuid.New()
	payload, _ := json.Marshal(tradeProposalPayload{
		TargetCode:      "butler",
		OfferedClueID:   "c1",
		RequestedClueID: "c2",
	})

	err := m.HandleMessage(context.Background(), playerID, "clue:trade_propose", payload)
	if err != nil {
		t.Fatalf("trade_propose failed: %v", err)
	}
	if !proposed {
		t.Fatal("clue.trade_proposed event not published")
	}

	m.mu.RLock()
	if len(m.activeProposals) != 1 {
		t.Fatalf("expected 1 active proposal, got %d", len(m.activeProposals))
	}
	m.mu.RUnlock()
}

func TestTradeClueModule_TradePropose_ExchangeNotAllowed(t *testing.T) {
	m := NewTradeClueModule()
	_ = m.Init(context.Background(), newTestDeps(), nil)
	// Do not enable exchange.

	payload, _ := json.Marshal(tradeProposalPayload{
		TargetCode:    "butler",
		OfferedClueID: "c1",
	})

	err := m.HandleMessage(context.Background(), uuid.New(), "clue:trade_propose", payload)
	if err == nil {
		t.Fatal("expected error when exchange not allowed")
	}
}

func TestTradeClueModule_TradePropose_TradingDisabled(t *testing.T) {
	m := NewTradeClueModule()
	_ = m.Init(context.Background(), newTestDeps(), json.RawMessage(`{"allowTrade":false}`))
	enableExchange(t, m)

	payload, _ := json.Marshal(tradeProposalPayload{
		TargetCode:    "butler",
		OfferedClueID: "c1",
	})

	err := m.HandleMessage(context.Background(), uuid.New(), "clue:trade_propose", payload)
	if err == nil {
		t.Fatal("expected error when trading disabled")
	}
}

func TestTradeClueModule_TradeAccept(t *testing.T) {
	deps := newTestDeps()
	m := NewTradeClueModule()
	_ = m.Init(context.Background(), deps, nil)
	enableExchange(t, m)

	now := time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC)
	m.nowFunc = func() time.Time { return now }

	// Create a proposal.
	playerID := uuid.New()
	payload, _ := json.Marshal(tradeProposalPayload{
		TargetCode:      "butler",
		OfferedClueID:   "c1",
		RequestedClueID: "c2",
	})
	_ = m.HandleMessage(context.Background(), playerID, "clue:trade_propose", payload)

	// Get proposal ID.
	m.mu.RLock()
	var proposalID string
	for id := range m.activeProposals {
		proposalID = id
	}
	m.mu.RUnlock()

	var accepted bool
	deps.EventBus.Subscribe("clue.trade_accepted", func(_ engine.Event) {
		accepted = true
	})

	acceptPayload, _ := json.Marshal(tradeResponsePayload{ProposalID: proposalID})
	err := m.HandleMessage(context.Background(), uuid.New(), "clue:trade_accept", acceptPayload)
	if err != nil {
		t.Fatalf("trade_accept failed: %v", err)
	}
	if !accepted {
		t.Fatal("clue.trade_accepted event not published")
	}

	// After acceptance, the proposal should be removed from the map.
	m.mu.RLock()
	if _, exists := m.activeProposals[proposalID]; exists {
		t.Fatal("expected proposal to be removed from activeProposals after acceptance")
	}
	m.mu.RUnlock()
}

func TestTradeClueModule_TradeAccept_Expired(t *testing.T) {
	deps := newTestDeps()
	m := NewTradeClueModule()
	_ = m.Init(context.Background(), deps, json.RawMessage(`{"tradeProposalTimeout":10}`))
	enableExchange(t, m)

	now := time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC)
	m.nowFunc = func() time.Time { return now }

	payload, _ := json.Marshal(tradeProposalPayload{
		TargetCode:    "butler",
		OfferedClueID: "c1",
	})
	_ = m.HandleMessage(context.Background(), uuid.New(), "clue:trade_propose", payload)

	m.mu.RLock()
	var proposalID string
	for id := range m.activeProposals {
		proposalID = id
	}
	m.mu.RUnlock()

	// Advance time past timeout.
	now = now.Add(11 * time.Second)

	acceptPayload, _ := json.Marshal(tradeResponsePayload{ProposalID: proposalID})
	err := m.HandleMessage(context.Background(), uuid.New(), "clue:trade_accept", acceptPayload)
	if err == nil {
		t.Fatal("expected error for expired proposal")
	}
}

func TestTradeClueModule_TradeDecline(t *testing.T) {
	deps := newTestDeps()
	m := NewTradeClueModule()
	_ = m.Init(context.Background(), deps, nil)
	enableExchange(t, m)

	now := time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC)
	m.nowFunc = func() time.Time { return now }

	payload, _ := json.Marshal(tradeProposalPayload{
		TargetCode:    "butler",
		OfferedClueID: "c1",
	})
	_ = m.HandleMessage(context.Background(), uuid.New(), "clue:trade_propose", payload)

	m.mu.RLock()
	var proposalID string
	for id := range m.activeProposals {
		proposalID = id
	}
	m.mu.RUnlock()

	var declined bool
	deps.EventBus.Subscribe("clue.trade_declined", func(_ engine.Event) {
		declined = true
	})

	declinePayload, _ := json.Marshal(tradeResponsePayload{ProposalID: proposalID})
	err := m.HandleMessage(context.Background(), uuid.New(), "clue:trade_decline", declinePayload)
	if err != nil {
		t.Fatalf("trade_decline failed: %v", err)
	}
	if !declined {
		t.Fatal("clue.trade_declined event not published")
	}

	// After decline, the proposal should be removed from the map.
	m.mu.RLock()
	if _, exists := m.activeProposals[proposalID]; exists {
		t.Fatal("expected proposal to be removed from activeProposals after decline")
	}
	m.mu.RUnlock()
}

func TestTradeClueModule_TradeAccept_NotFound(t *testing.T) {
	m := NewTradeClueModule()
	_ = m.Init(context.Background(), newTestDeps(), nil)

	payload, _ := json.Marshal(tradeResponsePayload{ProposalID: "nonexistent"})
	err := m.HandleMessage(context.Background(), uuid.New(), "clue:trade_accept", payload)
	if err == nil {
		t.Fatal("expected error for nonexistent proposal")
	}
}

func TestTradeClueModule_ShowRequest(t *testing.T) {
	deps := newTestDeps()
	m := NewTradeClueModule()
	_ = m.Init(context.Background(), deps, nil)
	enableExchange(t, m)

	var requested bool
	deps.EventBus.Subscribe("clue.show_requested", func(_ engine.Event) {
		requested = true
	})

	payload, _ := json.Marshal(showRequestPayload{TargetCode: "nurse", ClueID: "c5"})
	err := m.HandleMessage(context.Background(), uuid.New(), "clue:show_request", payload)
	if err != nil {
		t.Fatalf("show_request failed: %v", err)
	}
	if !requested {
		t.Fatal("clue.show_requested event not published")
	}

	m.mu.RLock()
	if len(m.activeShows) != 1 {
		t.Fatalf("expected 1 active show, got %d", len(m.activeShows))
	}
	m.mu.RUnlock()
}

func TestTradeClueModule_ShowRequest_MaxViewers(t *testing.T) {
	deps := newTestDeps()
	m := NewTradeClueModule()
	_ = m.Init(context.Background(), deps, json.RawMessage(`{"showMaxViewers":1}`))
	enableExchange(t, m)

	playerID := uuid.New()
	payload, _ := json.Marshal(showRequestPayload{TargetCode: "nurse", ClueID: "c5"})
	_ = m.HandleMessage(context.Background(), playerID, "clue:show_request", payload)

	// Second request for same clue by same owner should fail.
	payload2, _ := json.Marshal(showRequestPayload{TargetCode: "butler", ClueID: "c5"})
	err := m.HandleMessage(context.Background(), playerID, "clue:show_request", payload2)
	if err == nil {
		t.Fatal("expected error for max viewers exceeded")
	}
}

func TestTradeClueModule_ShowAccept(t *testing.T) {
	deps := newTestDeps()
	m := NewTradeClueModule()
	_ = m.Init(context.Background(), deps, nil)
	enableExchange(t, m)

	now := time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC)
	m.nowFunc = func() time.Time { return now }

	playerID := uuid.New()
	payload, _ := json.Marshal(showRequestPayload{TargetCode: "nurse", ClueID: "c5"})
	_ = m.HandleMessage(context.Background(), playerID, "clue:show_request", payload)

	m.mu.RLock()
	var sessionID string
	for id := range m.activeShows {
		sessionID = id
	}
	m.mu.RUnlock()

	var started bool
	deps.EventBus.Subscribe("clue.show_started", func(_ engine.Event) {
		started = true
	})

	acceptPayload, _ := json.Marshal(showResponsePayload{SessionID: sessionID})
	err := m.HandleMessage(context.Background(), uuid.New(), "clue:show_accept", acceptPayload)
	if err != nil {
		t.Fatalf("show_accept failed: %v", err)
	}
	if !started {
		t.Fatal("clue.show_started event not published")
	}

	m.mu.RLock()
	session := m.activeShows[sessionID]
	if session.Status != "active" {
		t.Fatalf("expected status active, got %q", session.Status)
	}
	expectedExpiry := now.Add(30 * time.Second)
	if !session.ExpiresAt.Equal(expectedExpiry) {
		t.Fatalf("expected expiresAt %v, got %v", expectedExpiry, session.ExpiresAt)
	}
	m.mu.RUnlock()
}

func TestTradeClueModule_ShowDecline(t *testing.T) {
	deps := newTestDeps()
	m := NewTradeClueModule()
	_ = m.Init(context.Background(), deps, nil)
	enableExchange(t, m)

	payload, _ := json.Marshal(showRequestPayload{TargetCode: "nurse", ClueID: "c5"})
	_ = m.HandleMessage(context.Background(), uuid.New(), "clue:show_request", payload)

	m.mu.RLock()
	var sessionID string
	for id := range m.activeShows {
		sessionID = id
	}
	m.mu.RUnlock()

	var declinedEvent bool
	deps.EventBus.Subscribe("clue.show_declined", func(_ engine.Event) {
		declinedEvent = true
	})

	declinePayload, _ := json.Marshal(showResponsePayload{SessionID: sessionID})
	err := m.HandleMessage(context.Background(), uuid.New(), "clue:show_decline", declinePayload)
	if err != nil {
		t.Fatalf("show_decline failed: %v", err)
	}
	if !declinedEvent {
		t.Fatal("clue.show_declined event not published")
	}

	// After decline, the show session should be removed from the map.
	m.mu.RLock()
	if _, exists := m.activeShows[sessionID]; exists {
		t.Fatal("expected show session to be removed from activeShows after decline")
	}
	m.mu.RUnlock()
}

func TestTradeClueModule_ShowAccept_NotFound(t *testing.T) {
	m := NewTradeClueModule()
	_ = m.Init(context.Background(), newTestDeps(), nil)

	payload, _ := json.Marshal(showResponsePayload{SessionID: "nonexistent"})
	err := m.HandleMessage(context.Background(), uuid.New(), "clue:show_accept", payload)
	if err == nil {
		t.Fatal("expected error for nonexistent session")
	}
}

// --- PhaseReactor tests ---

func TestTradeClueModule_SupportedActions(t *testing.T) {
	m := NewTradeClueModule()
	actions := m.SupportedActions()
	if len(actions) != 1 {
		t.Fatalf("expected 1 supported action, got %d", len(actions))
	}
	if actions[0] != engine.ActionAllowExchange {
		t.Fatalf("expected ALLOW_EXCHANGE, got %q", actions[0])
	}
}

func TestTradeClueModule_ReactTo_AllowExchange(t *testing.T) {
	m := NewTradeClueModule()
	_ = m.Init(context.Background(), newTestDeps(), nil)

	// Enable.
	err := m.ReactTo(context.Background(), engine.PhaseActionPayload{
		Action: engine.ActionAllowExchange,
		Params: json.RawMessage(`{"allowed":true}`),
	})
	if err != nil {
		t.Fatalf("ReactTo ALLOW_EXCHANGE (enable) failed: %v", err)
	}
	m.mu.RLock()
	if !m.exchangeAllowed {
		t.Fatal("expected exchangeAllowed true")
	}
	m.mu.RUnlock()

	// Disable.
	err = m.ReactTo(context.Background(), engine.PhaseActionPayload{
		Action: engine.ActionAllowExchange,
		Params: json.RawMessage(`{"allowed":false}`),
	})
	if err != nil {
		t.Fatalf("ReactTo ALLOW_EXCHANGE (disable) failed: %v", err)
	}
	m.mu.RLock()
	if m.exchangeAllowed {
		t.Fatal("expected exchangeAllowed false")
	}
	m.mu.RUnlock()
}

func TestTradeClueModule_ReactTo_DefaultTrueWithNoParams(t *testing.T) {
	m := NewTradeClueModule()
	_ = m.Init(context.Background(), newTestDeps(), nil)

	err := m.ReactTo(context.Background(), engine.PhaseActionPayload{
		Action: engine.ActionAllowExchange,
	})
	if err != nil {
		t.Fatalf("ReactTo failed: %v", err)
	}
	m.mu.RLock()
	if !m.exchangeAllowed {
		t.Fatal("expected exchangeAllowed true with no params")
	}
	m.mu.RUnlock()
}

func TestTradeClueModule_ReactTo_UnsupportedAction(t *testing.T) {
	m := NewTradeClueModule()
	_ = m.Init(context.Background(), newTestDeps(), nil)

	err := m.ReactTo(context.Background(), engine.PhaseActionPayload{
		Action: engine.ActionOpenVoting,
	})
	if err == nil {
		t.Fatal("expected error for unsupported action")
	}
}

func TestTradeClueModule_HandleMessage_UnknownType(t *testing.T) {
	m := NewTradeClueModule()
	_ = m.Init(context.Background(), newTestDeps(), nil)

	err := m.HandleMessage(context.Background(), uuid.New(), "unknown", nil)
	if err == nil {
		t.Fatal("expected error for unknown message type")
	}
}

func TestTradeClueModule_BuildState(t *testing.T) {
	m := NewTradeClueModule()
	_ = m.Init(context.Background(), newTestDeps(), nil)

	data, err := m.BuildState()
	if err != nil {
		t.Fatalf("BuildState failed: %v", err)
	}

	var state tradeClueState
	if err := json.Unmarshal(data, &state); err != nil {
		t.Fatalf("unmarshal failed: %v", err)
	}
	if state.ExchangeAllowed {
		t.Fatal("expected exchangeAllowed false initially")
	}
	if state.Config.AllowTrade != true {
		t.Fatal("expected allowTrade true by default")
	}
}

func TestTradeClueModule_Schema(t *testing.T) {
	m := NewTradeClueModule()
	schema := m.Schema()
	if schema == nil {
		t.Fatal("Schema returned nil")
	}
	var parsed map[string]any
	if err := json.Unmarshal(schema, &parsed); err != nil {
		t.Fatalf("Schema not valid JSON: %v", err)
	}
	props := parsed["properties"].(map[string]any)
	expectedFields := []string{"allowTrade", "allowShow", "showDuration", "showMaxViewers", "requireMutualTrade", "tradeProposalTimeout"}
	for _, f := range expectedFields {
		if _, ok := props[f]; !ok {
			t.Fatalf("missing field %q in schema", f)
		}
	}
}

func TestTradeClueModule_Cleanup(t *testing.T) {
	m := NewTradeClueModule()
	_ = m.Init(context.Background(), newTestDeps(), nil)
	_ = m.Cleanup(context.Background())
	if m.activeProposals != nil {
		t.Fatal("expected activeProposals nil after cleanup")
	}
	if m.activeShows != nil {
		t.Fatal("expected activeShows nil after cleanup")
	}
}

func TestTradeClueModule_SaveRestoreState(t *testing.T) {
	m := NewTradeClueModule()
	deps := newTestDeps()
	if err := m.Init(context.Background(), deps, nil); err != nil {
		t.Fatalf("Init failed: %v", err)
	}

	// Set some state.
	m.mu.Lock()
	m.exchangeAllowed = true
	m.activeProposals["p1"] = &TradeProposal{
		ID:            "p1",
		ProposerID:    uuid.New(),
		TargetID:      "butler",
		OfferedClueID: "c1",
		Status:        "pending",
	}
	m.mu.Unlock()

	// Save state.
	gs, err := m.SaveState(context.Background())
	if err != nil {
		t.Fatalf("SaveState failed: %v", err)
	}
	if _, ok := gs.Modules["trade_clue"]; !ok {
		t.Fatal("expected trade_clue key in GameState.Modules")
	}

	// Restore into fresh module.
	m2 := NewTradeClueModule()
	_ = m2.Init(context.Background(), newTestDeps(), nil)
	if err := m2.RestoreState(context.Background(), uuid.New(), gs); err != nil {
		t.Fatalf("RestoreState failed: %v", err)
	}

	m2.mu.RLock()
	if !m2.exchangeAllowed {
		t.Fatal("expected exchangeAllowed=true after restore")
	}
	if len(m2.activeProposals) != 1 {
		t.Fatalf("expected 1 active proposal, got %d", len(m2.activeProposals))
	}
	m2.mu.RUnlock()
}
