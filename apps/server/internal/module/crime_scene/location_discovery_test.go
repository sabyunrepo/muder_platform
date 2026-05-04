package crime_scene

import (
	"bytes"
	"context"
	"encoding/json"
	"testing"

	"github.com/google/uuid"
	"github.com/mmp-platform/server/internal/engine"
)

func locationDiscoveryCfg(clueID string) json.RawMessage {
	data, _ := json.Marshal(LocationConfig{
		Locations: []LocationDef{
			{ID: "hall", Name: "Hall", Description: "Entry hall"},
			{ID: "library", Name: "Library", Description: "Book room"},
		},
		StartingLoc: "hall",
		Discoveries: []LocationClueDiscovery{
			{LocationID: "library", ClueID: clueID, OncePerPlayer: true},
		},
	})
	return data
}

func TestLocationModule_Init_InvalidDiscovery(t *testing.T) {
	m := NewLocationModule()
	err := m.Init(context.Background(), newTestDeps(), json.RawMessage(`{
		"locations":[{"id":"hall","name":"Hall"}],
		"discoveries":[{"locationId":"nowhere","clueId":"clue-1"}]
	}`))
	if err == nil {
		t.Fatal("expected error for discovery pointing to unknown location")
	}
}

func TestLocationModule_Init_DiscoveryDefaultsOncePerPlayer(t *testing.T) {
	m := NewLocationModule()
	if err := m.Init(context.Background(), newTestDeps(), json.RawMessage(`{
		"locations":[{"id":"hall","name":"Hall"}],
		"discoveries":[{"locationId":"hall","clueId":"clue-1"}]
	}`)); err != nil {
		t.Fatalf("Init: %v", err)
	}
	if !m.discoveriesByLocation["hall"][0].OncePerPlayer {
		t.Fatal("expected discovery to default to oncePerPlayer")
	}
}

func TestLocationModule_HandleMessage_ExamineDiscoversLocationClue(t *testing.T) {
	deps := newTestDeps()
	m := NewLocationModule()
	playerID := uuid.New()
	clueID := uuid.New().String()
	if err := m.Init(context.Background(), deps, locationDiscoveryCfg(clueID)); err != nil {
		t.Fatalf("Init: %v", err)
	}

	var examined, discovered, acquired bool
	deps.EventBus.Subscribe("location.examined", func(e engine.Event) {
		payload := e.Payload.(map[string]any)
		ids := payload["discoveredClueIDs"].([]string)
		examined = len(ids) == 1 && ids[0] == clueID
	})
	deps.EventBus.Subscribe("location.clue_discovered", func(e engine.Event) {
		payload := e.Payload.(map[string]any)
		discovered = payload["clueID"] == clueID
	})
	deps.EventBus.Subscribe("clue.acquired", func(e engine.Event) {
		payload := e.Payload.(map[string]any)
		acquired = payload["clueId"] == clueID && payload["source"] == "location_discovery"
	})

	err := m.HandleMessage(context.Background(), playerID,
		"examine", json.RawMessage(`{"location_id":"library"}`))
	if err != nil {
		t.Fatalf("examine: %v", err)
	}
	if !examined || !discovered || !acquired {
		t.Fatalf(
			"expected examined/discovered/acquired events, got examined=%v discovered=%v acquired=%v",
			examined,
			discovered,
			acquired,
		)
	}

	data, err := m.BuildStateFor(playerID)
	if err != nil {
		t.Fatalf("BuildStateFor: %v", err)
	}
	var state locationState
	if err := json.Unmarshal(data, &state); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if got := state.DiscoveredClues[playerID.String()]; len(got) != 1 || got[0] != clueID {
		t.Fatalf("expected discovered clue %q, got %v", clueID, got)
	}
}

func TestLocationModule_HandleMessage_ExamineDiscoveryIsIdempotent(t *testing.T) {
	deps := newTestDeps()
	m := NewLocationModule()
	playerID := uuid.New()
	clueID := uuid.New().String()
	if err := m.Init(context.Background(), deps, locationDiscoveryCfg(clueID)); err != nil {
		t.Fatalf("Init: %v", err)
	}

	acquiredEvents := 0
	deps.EventBus.Subscribe("clue.acquired", func(e engine.Event) { acquiredEvents++ })
	for i := 0; i < 2; i++ {
		if err := m.HandleMessage(context.Background(), playerID,
			"examine", json.RawMessage(`{"location_id":"library"}`)); err != nil {
			t.Fatalf("examine %d: %v", i+1, err)
		}
	}

	m.mu.RLock()
	defer m.mu.RUnlock()
	if got := m.discoveredClues[playerID]; len(got) != 1 || got[0] != clueID {
		t.Fatalf("expected one discovered clue, got %v", got)
	}
	if acquiredEvents != 1 {
		t.Fatalf("expected one clue.acquired event, got %d", acquiredEvents)
	}
}

func TestLocationModule_HandleMessage_ExamineDiscoveryRequiresClue(t *testing.T) {
	m := NewLocationModule()
	playerID := uuid.New()
	keyID := uuid.New().String()
	rewardID := uuid.New().String()
	config, _ := json.Marshal(LocationConfig{
		Locations: []LocationDef{{ID: "hall", Name: "Hall"}, {ID: "safe", Name: "Safe"}},
		Discoveries: []LocationClueDiscovery{
			{LocationID: "hall", ClueID: keyID, OncePerPlayer: true},
			{LocationID: "safe", ClueID: rewardID, RequiredClueIDs: []string{keyID}, OncePerPlayer: true},
		},
	})
	if err := m.Init(context.Background(), newTestDeps(), config); err != nil {
		t.Fatalf("Init: %v", err)
	}

	if err := m.HandleMessage(context.Background(), playerID,
		"examine", json.RawMessage(`{"location_id":"safe"}`)); err != nil {
		t.Fatalf("safe examine before key: %v", err)
	}
	m.mu.RLock()
	if len(m.discoveredClues[playerID]) != 0 {
		t.Fatalf("reward should not be discovered before key, got %v", m.discoveredClues[playerID])
	}
	m.mu.RUnlock()

	if err := m.HandleMessage(context.Background(), playerID,
		"examine", json.RawMessage(`{"location_id":"hall"}`)); err != nil {
		t.Fatalf("hall examine: %v", err)
	}
	if err := m.HandleMessage(context.Background(), playerID,
		"examine", json.RawMessage(`{"location_id":"safe"}`)); err != nil {
		t.Fatalf("safe examine after key: %v", err)
	}
	m.mu.RLock()
	defer m.mu.RUnlock()
	if !playerHasDiscoveredClue(m.discoveredClues[playerID], rewardID) {
		t.Fatalf("reward should be discovered after key, got %v", m.discoveredClues[playerID])
	}
}

func TestLocationModule_BuildStateFor_DiscoveredCluesCallerOnly(t *testing.T) {
	m := NewLocationModule()
	if err := m.Init(context.Background(), newTestDeps(), locationCfg()); err != nil {
		t.Fatalf("Init: %v", err)
	}
	alice := uuid.New()
	bob := uuid.New()
	m.mu.Lock()
	m.discoveredClues[alice] = []string{"alice-clue"}
	m.discoveredClues[bob] = []string{"bob-secret"}
	m.mu.Unlock()

	aliceData, err := m.BuildStateFor(alice)
	if err != nil {
		t.Fatalf("BuildStateFor: %v", err)
	}
	if !bytes.Contains(aliceData, []byte("alice-clue")) {
		t.Fatalf("alice should see her discovered clue: %s", aliceData)
	}
	if bytes.Contains(aliceData, []byte("bob-secret")) || bytes.Contains(aliceData, []byte(bob.String())) {
		t.Fatalf("alice leaked bob discovery: %s", aliceData)
	}
}
