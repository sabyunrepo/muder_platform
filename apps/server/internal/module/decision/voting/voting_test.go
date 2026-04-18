package voting

import (
	"context"
	"encoding/json"
	"sync"
	"testing"

	"github.com/google/uuid"
	"github.com/mmp-platform/server/internal/engine"
)

// testLogger implements engine.Logger for tests.
type testLogger struct{}

func (l *testLogger) Printf(format string, v ...any) {}

func newTestEventBus() *engine.EventBus {
	return engine.NewEventBus(&testLogger{})
}

func newTestDeps() engine.ModuleDeps {
	return engine.ModuleDeps{
		SessionID: uuid.New(),
		EventBus:  newTestEventBus(),
		Logger:    &testLogger{},
	}
}

func initVotingModule(t *testing.T, configJSON string) *VotingModule {
	t.Helper()
	m := NewVotingModule()
	var cfg json.RawMessage
	if configJSON != "" {
		cfg = json.RawMessage(configJSON)
	}
	if err := m.Init(context.Background(), newTestDeps(), cfg); err != nil {
		t.Fatalf("Init failed: %v", err)
	}
	return m
}

func TestVotingModule_Name(t *testing.T) {
	m := NewVotingModule()
	if got := m.Name(); got != "voting" {
		t.Errorf("Name() = %q, want %q", got, "voting")
	}
}

func TestVotingModule_InitDefaults(t *testing.T) {
	m := initVotingModule(t, "")
	if m.config.Mode != "open" {
		t.Errorf("default Mode = %q, want %q", m.config.Mode, "open")
	}
	if m.config.MinParticipation != 75 {
		t.Errorf("default MinParticipation = %d, want 75", m.config.MinParticipation)
	}
	if m.config.TieBreaker != "revote" {
		t.Errorf("default TieBreaker = %q, want %q", m.config.TieBreaker, "revote")
	}
	if m.config.MaxRounds != 3 {
		t.Errorf("default MaxRounds = %d, want 3", m.config.MaxRounds)
	}
}

func TestVotingModule_InitCustomConfig(t *testing.T) {
	m := initVotingModule(t, `{"mode":"secret","minParticipation":50,"tieBreaker":"random","maxRounds":5}`)
	if m.config.Mode != "secret" {
		t.Errorf("Mode = %q, want %q", m.config.Mode, "secret")
	}
	if m.config.MinParticipation != 50 {
		t.Errorf("MinParticipation = %d, want 50", m.config.MinParticipation)
	}
	if m.config.TieBreaker != "random" {
		t.Errorf("TieBreaker = %q, want %q", m.config.TieBreaker, "random")
	}
	if m.config.MaxRounds != 5 {
		t.Errorf("MaxRounds = %d, want 5", m.config.MaxRounds)
	}
}

func TestVotingModule_VoteCast(t *testing.T) {
	tests := []struct {
		name    string
		config  string
		setup   func(m *VotingModule)
		payload string
		wantErr bool
	}{
		{
			name:   "successful vote when open",
			config: "",
			setup: func(m *VotingModule) {
				m.mu.Lock()
				m.isOpen = true
				m.mu.Unlock()
			},
			payload: `{"targetCode":"char_A"}`,
			wantErr: false,
		},
		{
			name:    "vote when closed",
			config:  "",
			setup:   func(m *VotingModule) {},
			payload: `{"targetCode":"char_A"}`,
			wantErr: true,
		},
		{
			name:   "abstain not allowed",
			config: "",
			setup: func(m *VotingModule) {
				m.mu.Lock()
				m.isOpen = true
				m.mu.Unlock()
			},
			payload: `{"targetCode":""}`,
			wantErr: true,
		},
		{
			name:   "abstain allowed",
			config: `{"allowAbstain":true}`,
			setup: func(m *VotingModule) {
				m.mu.Lock()
				m.isOpen = true
				m.mu.Unlock()
			},
			payload: `{"targetCode":""}`,
			wantErr: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			m := initVotingModule(t, tt.config)
			tt.setup(m)
			err := m.HandleMessage(context.Background(), uuid.New(), "vote:cast", json.RawMessage(tt.payload))
			if (err != nil) != tt.wantErr {
				t.Errorf("HandleMessage() error = %v, wantErr = %v", err, tt.wantErr)
			}
		})
	}
}

func TestVotingModule_VoteChange(t *testing.T) {
	m := initVotingModule(t, "")
	pid := uuid.New()

	m.mu.Lock()
	m.isOpen = true
	m.mu.Unlock()

	// Cast initial vote.
	if err := m.HandleMessage(context.Background(), pid, "vote:cast", json.RawMessage(`{"targetCode":"char_A"}`)); err != nil {
		t.Fatalf("initial vote failed: %v", err)
	}

	// Change vote.
	if err := m.HandleMessage(context.Background(), pid, "vote:change", json.RawMessage(`{"targetCode":"char_B"}`)); err != nil {
		t.Fatalf("vote change failed: %v", err)
	}

	m.mu.RLock()
	if m.votes[pid] != "char_B" {
		t.Errorf("vote = %q, want %q", m.votes[pid], "char_B")
	}
	m.mu.RUnlock()
}

func TestVotingModule_VoteChangeNoExisting(t *testing.T) {
	m := initVotingModule(t, "")
	m.mu.Lock()
	m.isOpen = true
	m.mu.Unlock()

	err := m.HandleMessage(context.Background(), uuid.New(), "vote:change", json.RawMessage(`{"targetCode":"char_A"}`))
	if err == nil {
		t.Error("expected error when changing non-existent vote")
	}
}

func TestVotingModule_DuplicateVote(t *testing.T) {
	m := initVotingModule(t, "")
	pid := uuid.New()
	m.mu.Lock()
	m.isOpen = true
	m.mu.Unlock()

	if err := m.HandleMessage(context.Background(), pid, "vote:cast", json.RawMessage(`{"targetCode":"char_A"}`)); err != nil {
		t.Fatalf("first vote: %v", err)
	}
	err := m.HandleMessage(context.Background(), pid, "vote:cast", json.RawMessage(`{"targetCode":"char_B"}`))
	if err == nil {
		t.Error("expected error on duplicate vote:cast")
	}
}

func TestVotingModule_ReactToOpenClose(t *testing.T) {
	m := initVotingModule(t, "")
	ctx := context.Background()

	// Open voting.
	err := m.ReactTo(ctx, engine.PhaseActionPayload{
		Action: engine.ActionOpenVoting,
		Params: json.RawMessage(`{"totalPlayers":6,"alivePlayers":5}`),
	})
	if err != nil {
		t.Fatalf("OPEN_VOTING: %v", err)
	}
	if !m.isOpen {
		t.Error("expected isOpen=true after OPEN_VOTING")
	}
	if m.currentRound != 1 {
		t.Errorf("currentRound = %d, want 1", m.currentRound)
	}

	// Close voting.
	err = m.ReactTo(ctx, engine.PhaseActionPayload{Action: engine.ActionCloseVoting})
	if err != nil {
		t.Fatalf("CLOSE_VOTING: %v", err)
	}
	if m.isOpen {
		t.Error("expected isOpen=false after CLOSE_VOTING")
	}
}

func TestVotingModule_TallyResults(t *testing.T) {
	tests := []struct {
		name       string
		config     string
		votes      map[uuid.UUID]string
		alive      int
		total      int
		wantWinner string
		wantTie    bool
	}{
		{
			name:   "clear winner",
			config: `{"minParticipation":0}`,
			votes: map[uuid.UUID]string{
				uuid.New(): "char_A",
				uuid.New(): "char_A",
				uuid.New(): "char_B",
			},
			alive:      3,
			total:      3,
			wantWinner: "char_A",
			wantTie:    false,
		},
		{
			name:   "tie with revote",
			config: `{"minParticipation":0,"tieBreaker":"revote"}`,
			votes: map[uuid.UUID]string{
				uuid.New(): "char_A",
				uuid.New(): "char_B",
			},
			alive:      2,
			total:      2,
			wantWinner: "",
			wantTie:    true,
		},
		{
			name:   "tie with no_result",
			config: `{"minParticipation":0,"tieBreaker":"no_result"}`,
			votes: map[uuid.UUID]string{
				uuid.New(): "char_A",
				uuid.New(): "char_B",
			},
			alive:      2,
			total:      2,
			wantWinner: "",
			wantTie:    true,
		},
		{
			name:   "insufficient participation",
			config: `{"minParticipation":75}`,
			votes: map[uuid.UUID]string{
				uuid.New(): "char_A",
			},
			alive:      4,
			total:      4,
			wantWinner: "",
			wantTie:    true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			m := initVotingModule(t, tt.config)
			m.votes = tt.votes
			m.alivePlayers = tt.alive
			m.totalPlayers = tt.total

			result := m.tallyResults()
			if result.Winner != tt.wantWinner {
				t.Errorf("Winner = %q, want %q", result.Winner, tt.wantWinner)
			}
			if result.IsTie != tt.wantTie {
				t.Errorf("IsTie = %v, want %v", result.IsTie, tt.wantTie)
			}
		})
	}
}

func TestVotingModule_TallyRandomTieBreaker(t *testing.T) {
	m := initVotingModule(t, `{"minParticipation":0,"tieBreaker":"random"}`)
	m.alivePlayers = 2
	m.totalPlayers = 2
	m.votes = map[uuid.UUID]string{
		uuid.New(): "char_A",
		uuid.New(): "char_B",
	}

	result := m.tallyResults()
	if result.IsTie {
		t.Error("random tie-breaker should resolve tie")
	}
	if result.Winner != "char_A" && result.Winner != "char_B" {
		t.Errorf("unexpected winner %q", result.Winner)
	}
}

func TestVotingModule_BuildState_OpenMode(t *testing.T) {
	m := initVotingModule(t, "")
	pid := uuid.New()
	m.mu.Lock()
	m.isOpen = true
	m.votes[pid] = "char_A"
	m.mu.Unlock()

	data, err := m.BuildState()
	if err != nil {
		t.Fatalf("BuildState: %v", err)
	}

	var state votingState
	if err := json.Unmarshal(data, &state); err != nil {
		t.Fatalf("unmarshal state: %v", err)
	}
	if !state.IsOpen {
		t.Error("expected isOpen=true")
	}
	if len(state.Votes) != 1 {
		t.Errorf("expected 1 vote in open mode state, got %d", len(state.Votes))
	}
}

func TestVotingModule_BuildState_SecretMode(t *testing.T) {
	m := initVotingModule(t, `{"mode":"secret"}`)
	pid := uuid.New()
	m.mu.Lock()
	m.isOpen = true
	m.votes[pid] = "char_A"
	m.mu.Unlock()

	data, err := m.BuildState()
	if err != nil {
		t.Fatalf("BuildState: %v", err)
	}

	var state votingState
	if err := json.Unmarshal(data, &state); err != nil {
		t.Fatalf("unmarshal state: %v", err)
	}
	if state.Votes != nil {
		t.Error("secret mode should not expose individual votes")
	}
	if state.VotedCount != 1 {
		t.Errorf("VotedCount = %d, want 1", state.VotedCount)
	}
}

func TestVotingModule_Schema(t *testing.T) {
	m := NewVotingModule()
	schema := m.Schema()
	if len(schema) == 0 {
		t.Error("Schema() returned empty")
	}
	var parsed map[string]any
	if err := json.Unmarshal(schema, &parsed); err != nil {
		t.Fatalf("Schema() not valid JSON: %v", err)
	}
}

func TestVotingModule_Cleanup(t *testing.T) {
	m := initVotingModule(t, "")
	m.mu.Lock()
	m.isOpen = true
	m.votes[uuid.New()] = "char_A"
	m.mu.Unlock()

	if err := m.Cleanup(context.Background()); err != nil {
		t.Fatalf("Cleanup: %v", err)
	}
	if m.votes != nil {
		t.Error("votes should be nil after cleanup")
	}
	if m.isOpen {
		t.Error("isOpen should be false after cleanup")
	}
}

func TestVotingModule_ConcurrentVotes(t *testing.T) {
	m := initVotingModule(t, "")
	m.mu.Lock()
	m.isOpen = true
	m.mu.Unlock()

	var wg sync.WaitGroup
	for i := 0; i < 50; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			pid := uuid.New()
			_ = m.HandleMessage(context.Background(), pid, "vote:cast", json.RawMessage(`{"targetCode":"char_A"}`))
		}()
	}
	wg.Wait()

	m.mu.RLock()
	count := len(m.votes)
	m.mu.RUnlock()
	if count != 50 {
		t.Errorf("expected 50 votes, got %d", count)
	}
}

func TestVotingModule_UnknownMessageType(t *testing.T) {
	m := initVotingModule(t, "")
	err := m.HandleMessage(context.Background(), uuid.New(), "unknown", nil)
	if err == nil {
		t.Error("expected error for unknown message type")
	}
}

func TestVotingModule_UnsupportedAction(t *testing.T) {
	m := initVotingModule(t, "")
	err := m.ReactTo(context.Background(), engine.PhaseActionPayload{Action: "UNSUPPORTED"})
	if err == nil {
		t.Error("expected error for unsupported action")
	}
}

func TestVotingModule_CloseWhenNotOpen(t *testing.T) {
	m := initVotingModule(t, "")
	err := m.ReactTo(context.Background(), engine.PhaseActionPayload{Action: engine.ActionCloseVoting})
	if err == nil {
		t.Error("expected error when closing voting that is not open")
	}
}

// --- GameEventHandler tests ---

func TestVotingModule_Validate(t *testing.T) {
	tests := []struct {
		name    string
		config  string
		setup   func(m *VotingModule)
		event   engine.GameEvent
		wantErr bool
	}{
		{
			name:   "valid vote:cast",
			config: "",
			setup: func(m *VotingModule) {
				m.mu.Lock()
				m.isOpen = true
				m.mu.Unlock()
			},
			event: engine.GameEvent{
				Type:    "vote:cast",
				Payload: json.RawMessage(`{"playerId":"` + uuid.New().String() + `","targetCode":"char_A"}`),
			},
			wantErr: false,
		},
		{
			name:   "vote:cast when closed",
			config: "",
			setup:  func(m *VotingModule) {},
			event: engine.GameEvent{
				Type:    "vote:cast",
				Payload: json.RawMessage(`{"playerId":"` + uuid.New().String() + `","targetCode":"char_A"}`),
			},
			wantErr: true,
		},
		{
			name:   "vote:cast abstain not allowed",
			config: "",
			setup: func(m *VotingModule) {
				m.mu.Lock()
				m.isOpen = true
				m.mu.Unlock()
			},
			event: engine.GameEvent{
				Type:    "vote:cast",
				Payload: json.RawMessage(`{"playerId":"` + uuid.New().String() + `","targetCode":""}`),
			},
			wantErr: true,
		},
		{
			name:   "vote:change with no prior vote",
			config: "",
			setup: func(m *VotingModule) {
				m.mu.Lock()
				m.isOpen = true
				m.mu.Unlock()
			},
			event: engine.GameEvent{
				Type:    "vote:change",
				Payload: json.RawMessage(`{"playerId":"` + uuid.New().String() + `","targetCode":"char_A"}`),
			},
			wantErr: true,
		},
		{
			name:   "unsupported event type",
			config: "",
			setup:  func(m *VotingModule) {},
			event: engine.GameEvent{
				Type:    "unknown",
				Payload: json.RawMessage(`{}`),
			},
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			m := initVotingModule(t, tt.config)
			tt.setup(m)
			err := m.Validate(context.Background(), tt.event, engine.GameState{})
			if (err != nil) != tt.wantErr {
				t.Errorf("Validate() error = %v, wantErr = %v", err, tt.wantErr)
			}
		})
	}
}

func TestVotingModule_Apply(t *testing.T) {
	m := initVotingModule(t, "")
	m.mu.Lock()
	m.isOpen = true
	m.mu.Unlock()

	pid := uuid.New()
	state := engine.GameState{Modules: make(map[string]json.RawMessage)}
	event := engine.GameEvent{
		Type:    "vote:cast",
		Payload: json.RawMessage(`{"playerId":"` + pid.String() + `","targetCode":"char_A"}`),
	}

	err := m.Apply(context.Background(), event, &state)
	if err != nil {
		t.Fatalf("Apply: %v", err)
	}

	// Verify state was updated.
	if _, ok := state.Modules["voting"]; !ok {
		t.Error("expected voting state in GameState.Modules")
	}

	// Verify internal vote recorded.
	m.mu.RLock()
	if m.votes[pid] != "char_A" {
		t.Errorf("vote = %q, want %q", m.votes[pid], "char_A")
	}
	m.mu.RUnlock()
}

// --- WinChecker tests ---

func TestVotingModule_CheckWin(t *testing.T) {
	tests := []struct {
		name    string
		state   engine.GameState
		wantWon bool
	}{
		{
			name:    "no voting state",
			state:   engine.GameState{},
			wantWon: false,
		},
		{
			name: "voting open, no winner",
			state: engine.GameState{
				Modules: map[string]json.RawMessage{
					"voting": json.RawMessage(`{"isOpen":true,"winner":""}`),
				},
			},
			wantWon: false,
		},
		{
			name: "voting closed with winner",
			state: engine.GameState{
				Modules: map[string]json.RawMessage{
					"voting": json.RawMessage(`{"isOpen":false,"winner":"char_A","round":1}`),
				},
			},
			wantWon: true,
		},
		{
			name: "voting closed, tie (no winner)",
			state: engine.GameState{
				Modules: map[string]json.RawMessage{
					"voting": json.RawMessage(`{"isOpen":false,"winner":"","round":1}`),
				},
			},
			wantWon: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			m := NewVotingModule()
			result, err := m.CheckWin(context.Background(), tt.state)
			if err != nil {
				t.Fatalf("CheckWin: %v", err)
			}
			if result.Won != tt.wantWon {
				t.Errorf("Won = %v, want %v", result.Won, tt.wantWon)
			}
		})
	}
}

// --- SerializableModule tests ---

func TestVotingModule_SaveRestoreState(t *testing.T) {
	m := initVotingModule(t, `{"mode":"open","minParticipation":50}`)
	pid := uuid.New()

	// Open voting and cast a vote.
	_ = m.ReactTo(context.Background(), engine.PhaseActionPayload{
		Action: engine.ActionOpenVoting,
		Params: json.RawMessage(`{"totalPlayers":6,"alivePlayers":5}`),
	})
	_ = m.HandleMessage(context.Background(), pid, "vote:cast", json.RawMessage(`{"targetCode":"char_A"}`))

	// Save state.
	savedState, err := m.SaveState(context.Background())
	if err != nil {
		t.Fatalf("SaveState: %v", err)
	}

	// Create fresh module and restore.
	m2 := initVotingModule(t, "")
	if err := m2.RestoreState(context.Background(), uuid.Nil, savedState); err != nil {
		t.Fatalf("RestoreState: %v", err)
	}

	m2.mu.RLock()
	defer m2.mu.RUnlock()

	if !m2.isOpen {
		t.Error("expected isOpen=true after restore")
	}
	if m2.currentRound != 1 {
		t.Errorf("currentRound = %d, want 1", m2.currentRound)
	}
	if m2.votes[pid] != "char_A" {
		t.Errorf("restored vote = %q, want %q", m2.votes[pid], "char_A")
	}
	if m2.totalPlayers != 6 {
		t.Errorf("totalPlayers = %d, want 6", m2.totalPlayers)
	}
	if m2.alivePlayers != 5 {
		t.Errorf("alivePlayers = %d, want 5", m2.alivePlayers)
	}
	if m2.config.MinParticipation != 50 {
		t.Errorf("config.MinParticipation = %d, want 50", m2.config.MinParticipation)
	}
}

func TestVotingModule_RestoreState_NoModule(t *testing.T) {
	m := initVotingModule(t, "")
	err := m.RestoreState(context.Background(), uuid.Nil, engine.GameState{})
	if err != nil {
		t.Fatalf("RestoreState with empty state should not error: %v", err)
	}
}

// --- RuleProvider tests ---

func TestVotingModule_GetRules(t *testing.T) {
	m := NewVotingModule()
	rules := m.GetRules()
	if len(rules) != 3 {
		t.Fatalf("GetRules() returned %d rules, want 3", len(rules))
	}

	for _, rule := range rules {
		if rule.ID == "" {
			t.Error("rule has empty ID")
		}
		if rule.Description == "" {
			t.Error("rule has empty Description")
		}
		var parsed any
		if err := json.Unmarshal(rule.Logic, &parsed); err != nil {
			t.Errorf("rule %q: Logic is not valid JSON: %v", rule.ID, err)
		}
	}
}
