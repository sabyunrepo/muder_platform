package voting

import (
	"context"
	"encoding/json"
	"testing"

	"github.com/google/uuid"
	"github.com/mmp-platform/server/internal/engine"
)

type mutablePlayerInfoProvider struct {
	players map[uuid.UUID]engine.PlayerRuntimeInfo
}

func (p *mutablePlayerInfoProvider) PlayerRuntimeInfo(_ context.Context, playerID uuid.UUID) (engine.PlayerRuntimeInfo, bool) {
	info, ok := p.players[playerID]
	return info, ok
}

func (p *mutablePlayerInfoProvider) ResolvePlayerID(_ context.Context, targetCode string) (uuid.UUID, bool) {
	if playerID, err := uuid.Parse(targetCode); err == nil {
		if _, ok := p.players[playerID]; ok {
			return playerID, true
		}
		return uuid.Nil, false
	}
	for playerID, info := range p.players {
		if info.TargetCode == targetCode {
			return playerID, true
		}
	}
	return uuid.Nil, false
}

func (p *mutablePlayerInfoProvider) PlayerRuntimeRoster(_ context.Context) []engine.PlayerRuntimeInfo {
	players := make([]engine.PlayerRuntimeInfo, 0, len(p.players))
	for _, info := range p.players {
		players = append(players, info)
	}
	return players
}

func TestVotingModule_PlayerStatusChangedRemovesDeadVoterAndDeadCandidateVotes(t *testing.T) {
	bus := newTestEventBus()
	voterA := uuid.New()
	voterB := uuid.New()
	provider := &mutablePlayerInfoProvider{players: map[uuid.UUID]engine.PlayerRuntimeInfo{
		voterA: {PlayerID: voterA, TargetCode: "char_a", Role: "civilian", IsAlive: false},
		voterB: {PlayerID: voterB, TargetCode: "char_b", Role: "civilian", IsAlive: true},
	}}
	deps := newTestDeps()
	deps.EventBus = bus
	deps.PlayerInfoProvider = provider
	m := initVotingModuleWithDeps(t, `{"mode":"open","minParticipation":0}`, deps)
	if err := m.ReactTo(context.Background(), engine.PhaseActionPayload{
		Action: engine.ActionOpenVoting,
		Params: json.RawMessage(`{"totalPlayers":2,"alivePlayers":2}`),
	}); err != nil {
		t.Fatalf("open voting: %v", err)
	}

	m.mu.Lock()
	m.votes[voterA] = "char_b"
	m.votes[voterB] = "char_a"
	m.mu.Unlock()

	var reconciled map[string]any
	bus.Subscribe("vote.reconciled", func(event engine.Event) {
		var ok bool
		reconciled, ok = event.Payload.(map[string]any)
		if !ok {
			t.Fatalf("payload type = %T, want map[string]any", event.Payload)
		}
	})
	bus.Publish(engine.Event{
		Type: "player.status_changed",
		Payload: map[string]any{
			"playerId": voterA.String(),
			"isAlive":  false,
		},
	})

	m.mu.RLock()
	_, voterAVoteExists := m.votes[voterA]
	_, voterBVoteExists := m.votes[voterB]
	alivePlayers := m.alivePlayers
	votedCount := len(m.votes)
	m.mu.RUnlock()

	if voterAVoteExists {
		t.Fatal("dead voter vote should be removed")
	}
	if voterBVoteExists {
		t.Fatal("vote targeting dead candidate should be removed")
	}
	if alivePlayers != 1 {
		t.Fatalf("alivePlayers = %d, want 1", alivePlayers)
	}
	if votedCount != 0 {
		t.Fatalf("votedCount = %d, want 0", votedCount)
	}
	if reconciled == nil {
		t.Fatal("vote.reconciled event was not published")
	}
	if reconciled["removedVotes"] != 2 {
		t.Fatalf("removedVotes = %v, want 2", reconciled["removedVotes"])
	}
	if reconciled["votedCount"] != 0 {
		t.Fatalf("event votedCount = %v, want 0", reconciled["votedCount"])
	}
}

func TestVotingModule_PlayerStatusChangedKeepsVotesWhenDeadVotingAndCandidatesAllowed(t *testing.T) {
	bus := newTestEventBus()
	voter := uuid.New()
	target := uuid.New()
	provider := &mutablePlayerInfoProvider{players: map[uuid.UUID]engine.PlayerRuntimeInfo{
		voter:  {PlayerID: voter, TargetCode: "char_voter", Role: "civilian", IsAlive: false},
		target: {PlayerID: target, TargetCode: "char_target", Role: "civilian", IsAlive: false},
	}}
	deps := newTestDeps()
	deps.EventBus = bus
	deps.PlayerInfoProvider = provider
	m := initVotingModuleWithDeps(t,
		`{"deadCanVote":true,"candidatePolicy":{"includeDeadPlayers":true,"includeSelf":true,"includeDetective":true},"minParticipation":0}`,
		deps,
	)
	if err := m.ReactTo(context.Background(), engine.PhaseActionPayload{
		Action: engine.ActionOpenVoting,
		Params: json.RawMessage(`{"totalPlayers":2,"alivePlayers":2}`),
	}); err != nil {
		t.Fatalf("open voting: %v", err)
	}
	m.mu.Lock()
	m.votes[voter] = "char_target"
	m.mu.Unlock()

	bus.Publish(engine.Event{
		Type: "player.status_changed",
		Payload: map[string]any{
			"playerId": voter.String(),
			"isAlive":  false,
		},
	})

	m.mu.RLock()
	got := m.votes[voter]
	result := m.tallyResults()
	m.mu.RUnlock()

	if got != "char_target" {
		t.Fatalf("vote = %q, want char_target", got)
	}
	if result.EligibleVoters != 2 {
		t.Fatalf("EligibleVoters = %d, want 2", result.EligibleVoters)
	}
	if result.TotalVotes != 1 {
		t.Fatalf("TotalVotes = %d, want 1", result.TotalVotes)
	}
}

func TestVotingModule_PlayerStatusChangedSecretModeDoesNotExposeVotes(t *testing.T) {
	bus := newTestEventBus()
	voter := uuid.New()
	provider := &mutablePlayerInfoProvider{players: map[uuid.UUID]engine.PlayerRuntimeInfo{
		voter: {PlayerID: voter, TargetCode: "char_voter", Role: "civilian", IsAlive: false},
	}}
	deps := newTestDeps()
	deps.EventBus = bus
	deps.PlayerInfoProvider = provider
	m := initVotingModuleWithDeps(t, `{"mode":"secret","minParticipation":0}`, deps)
	if err := m.ReactTo(context.Background(), engine.PhaseActionPayload{
		Action: engine.ActionOpenVoting,
		Params: json.RawMessage(`{"totalPlayers":1,"alivePlayers":1}`),
	}); err != nil {
		t.Fatalf("open voting: %v", err)
	}
	m.mu.Lock()
	m.votes[voter] = "char_target"
	m.mu.Unlock()

	var reconciled map[string]any
	bus.Subscribe("vote.reconciled", func(event engine.Event) {
		var ok bool
		reconciled, ok = event.Payload.(map[string]any)
		if !ok {
			t.Fatalf("payload type = %T, want map[string]any", event.Payload)
		}
	})
	bus.Publish(engine.Event{
		Type: "player.status_changed",
		Payload: map[string]any{
			"playerId": voter.String(),
			"isAlive":  false,
		},
	})

	if reconciled == nil {
		t.Fatal("vote.reconciled event was not published")
	}
	if _, ok := reconciled["votes"]; ok {
		t.Fatal("secret mode vote.reconciled should not expose votes")
	}
	if reconciled["votedCount"] != 0 {
		t.Fatalf("votedCount = %v, want 0", reconciled["votedCount"])
	}
}

func TestVotingModule_PlayerStatusChangedIgnoredWhenVotingClosed(t *testing.T) {
	bus := newTestEventBus()
	playerID := uuid.New()
	deps := newTestDeps()
	deps.EventBus = bus
	m := initVotingModuleWithDeps(t, "", deps)
	m.mu.Lock()
	m.votes[playerID] = "char_a"
	m.alivePlayers = 1
	m.mu.Unlock()

	bus.Publish(engine.Event{
		Type: "player.status_changed",
		Payload: map[string]any{
			"playerId": playerID.String(),
			"isAlive":  false,
		},
	})

	m.mu.RLock()
	defer m.mu.RUnlock()
	if _, ok := m.votes[playerID]; !ok {
		t.Fatal("closed voting should not remove votes")
	}
	if m.alivePlayers != 1 {
		t.Fatalf("alivePlayers = %d, want 1", m.alivePlayers)
	}
}
