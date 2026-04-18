package crime_scene

import (
	"bytes"
	"context"
	"encoding/json"
	"testing"

	"github.com/google/uuid"
	"github.com/mmp-platform/server/internal/engine"
)

func evidenceCfg() json.RawMessage {
	return json.RawMessage(`{
		"evidence": [
			{"id":"knife","name":"Knife","locationId":"hall","availableAtPhase":"","hidden":false},
			{"id":"note","name":"Note","locationId":"library","availableAtPhase":"investigation","hidden":false},
			{"id":"glove","name":"Glove","locationId":"hall","availableAtPhase":"","hidden":true}
		],
		"autoDiscover": false
	}`)
}

func TestEvidenceModule_Name(t *testing.T) {
	m := NewEvidenceModule()
	if m.Name() != "evidence" {
		t.Fatalf("expected %q, got %q", "evidence", m.Name())
	}
}

func TestEvidenceModule_Init_ValidConfig(t *testing.T) {
	m := NewEvidenceModule()
	if err := m.Init(context.Background(), newTestDeps(), evidenceCfg()); err != nil {
		t.Fatalf("Init: %v", err)
	}
	m.mu.RLock()
	if len(m.evidenceSet) != 3 {
		t.Fatalf("expected 3 evidence, got %d", len(m.evidenceSet))
	}
	// knife is phase="" so unlocked at start; note requires investigation phase
	if !m.unlockedByID["knife"] {
		t.Fatal("knife should be unlocked at start")
	}
	if m.unlockedByID["note"] {
		t.Fatal("note should not be unlocked yet")
	}
	m.mu.RUnlock()
}

func TestEvidenceModule_Init_InvalidConfig(t *testing.T) {
	m := NewEvidenceModule()
	err := m.Init(context.Background(), newTestDeps(), json.RawMessage(`{bad}`))
	if err == nil {
		t.Fatal("expected error for bad JSON")
	}
}

func TestEvidenceModule_HandleMessage_Discover(t *testing.T) {
	m := NewEvidenceModule()
	deps := newTestDeps()
	if err := m.Init(context.Background(), deps, evidenceCfg()); err != nil {
		t.Fatalf("Init: %v", err)
	}

	playerID := uuid.New()
	var discoveredEvt bool
	deps.EventBus.Subscribe("evidence.discovered", func(e engine.Event) { discoveredEvt = true })

	err := m.HandleMessage(context.Background(), playerID,
		"discover", json.RawMessage(`{"evidence_id":"knife","location_id":"hall"}`))
	if err != nil {
		t.Fatalf("discover: %v", err)
	}
	if !discoveredEvt {
		t.Fatal("expected evidence.discovered event")
	}

	m.mu.RLock()
	found := false
	for _, id := range m.discovered[playerID] {
		if id == "knife" {
			found = true
		}
	}
	m.mu.RUnlock()
	if !found {
		t.Fatal("knife not in discovered list")
	}
}

func TestEvidenceModule_HandleMessage_Discover_Idempotent(t *testing.T) {
	m := NewEvidenceModule()
	deps := newTestDeps()
	if err := m.Init(context.Background(), deps, evidenceCfg()); err != nil {
		t.Fatalf("Init: %v", err)
	}
	playerID := uuid.New()
	p := json.RawMessage(`{"evidence_id":"knife","location_id":"hall"}`)
	if err := m.HandleMessage(context.Background(), playerID, "discover", p); err != nil {
		t.Fatalf("first discover: %v", err)
	}
	if err := m.HandleMessage(context.Background(), playerID, "discover", p); err != nil {
		t.Fatalf("second discover (idempotent): %v", err)
	}
	m.mu.RLock()
	count := 0
	for _, id := range m.discovered[playerID] {
		if id == "knife" {
			count++
		}
	}
	m.mu.RUnlock()
	if count != 1 {
		t.Fatalf("expected exactly 1 knife in discovered, got %d", count)
	}
}

func TestEvidenceModule_HandleMessage_Discover_NotUnlocked(t *testing.T) {
	m := NewEvidenceModule()
	if err := m.Init(context.Background(), newTestDeps(), evidenceCfg()); err != nil {
		t.Fatalf("Init: %v", err)
	}
	err := m.HandleMessage(context.Background(), uuid.New(),
		"discover", json.RawMessage(`{"evidence_id":"note"}`))
	if err == nil {
		t.Fatal("expected error: note not unlocked yet")
	}
}

func TestEvidenceModule_HandleMessage_Collect(t *testing.T) {
	m := NewEvidenceModule()
	deps := newTestDeps()
	if err := m.Init(context.Background(), deps, evidenceCfg()); err != nil {
		t.Fatalf("Init: %v", err)
	}
	playerID := uuid.New()

	// Must discover first.
	if err := m.HandleMessage(context.Background(), playerID,
		"discover", json.RawMessage(`{"evidence_id":"knife","location_id":"hall"}`)); err != nil {
		t.Fatalf("discover: %v", err)
	}

	var collected bool
	deps.EventBus.Subscribe("evidence.collected", func(e engine.Event) { collected = true })

	if err := m.HandleMessage(context.Background(), playerID,
		"collect", json.RawMessage(`{"evidence_id":"knife"}`)); err != nil {
		t.Fatalf("collect: %v", err)
	}
	if !collected {
		t.Fatal("expected evidence.collected event")
	}
}

func TestEvidenceModule_HandleMessage_Collect_NotDiscovered(t *testing.T) {
	m := NewEvidenceModule()
	if err := m.Init(context.Background(), newTestDeps(), evidenceCfg()); err != nil {
		t.Fatalf("Init: %v", err)
	}
	err := m.HandleMessage(context.Background(), uuid.New(),
		"collect", json.RawMessage(`{"evidence_id":"knife"}`))
	if err == nil {
		t.Fatal("expected error: knife not yet discovered")
	}
}

func TestEvidenceModule_HandleMessage_UnknownType(t *testing.T) {
	m := NewEvidenceModule()
	if err := m.Init(context.Background(), newTestDeps(), evidenceCfg()); err != nil {
		t.Fatalf("Init: %v", err)
	}
	err := m.HandleMessage(context.Background(), uuid.New(), "unknown", nil)
	if err == nil {
		t.Fatal("expected error for unknown message type")
	}
}

func TestEvidenceModule_OnPhaseEnter_Unlocks(t *testing.T) {
	m := NewEvidenceModule()
	deps := newTestDeps()
	if err := m.Init(context.Background(), deps, evidenceCfg()); err != nil {
		t.Fatalf("Init: %v", err)
	}

	var unlocked bool
	deps.EventBus.Subscribe("evidence.unlocked", func(e engine.Event) { unlocked = true })

	if err := m.OnPhaseEnter(context.Background(), "investigation"); err != nil {
		t.Fatalf("OnPhaseEnter: %v", err)
	}
	if !unlocked {
		t.Fatal("expected evidence.unlocked event")
	}
	m.mu.RLock()
	if !m.unlockedByID["note"] {
		t.Fatal("note should be unlocked after investigation phase")
	}
	m.mu.RUnlock()
}

func TestEvidenceModule_OnPhaseEnter_NoDoubleUnlock(t *testing.T) {
	m := NewEvidenceModule()
	deps := newTestDeps()
	if err := m.Init(context.Background(), deps, evidenceCfg()); err != nil {
		t.Fatalf("Init: %v", err)
	}
	count := 0
	deps.EventBus.Subscribe("evidence.unlocked", func(e engine.Event) { count++ })
	_ = m.OnPhaseEnter(context.Background(), "investigation")
	_ = m.OnPhaseEnter(context.Background(), "investigation")
	if count != 1 {
		t.Fatalf("expected 1 unlock event, got %d", count)
	}
}

func TestEvidenceModule_OnPhaseExit(t *testing.T) {
	m := NewEvidenceModule()
	if err := m.Init(context.Background(), newTestDeps(), evidenceCfg()); err != nil {
		t.Fatalf("Init: %v", err)
	}
	if err := m.OnPhaseExit(context.Background(), "investigation"); err != nil {
		t.Fatalf("OnPhaseExit: %v", err)
	}
}

func TestEvidenceModule_SaveRestoreState(t *testing.T) {
	m := NewEvidenceModule()
	deps := newTestDeps()
	if err := m.Init(context.Background(), deps, evidenceCfg()); err != nil {
		t.Fatalf("Init: %v", err)
	}
	playerID := uuid.New()
	_ = m.HandleMessage(context.Background(), playerID,
		"discover", json.RawMessage(`{"evidence_id":"knife","location_id":"hall"}`))
	_ = m.HandleMessage(context.Background(), playerID,
		"collect", json.RawMessage(`{"evidence_id":"knife"}`))

	gs, err := m.SaveState(context.Background())
	if err != nil {
		t.Fatalf("SaveState: %v", err)
	}
	if _, ok := gs.Modules["evidence"]; !ok {
		t.Fatal("expected evidence key in saved state")
	}

	m2 := NewEvidenceModule()
	if err := m2.Init(context.Background(), newTestDeps(), evidenceCfg()); err != nil {
		t.Fatalf("Init m2: %v", err)
	}
	if err := m2.RestoreState(context.Background(), uuid.New(), gs); err != nil {
		t.Fatalf("RestoreState: %v", err)
	}

	m2.mu.RLock()
	discOK := false
	for _, id := range m2.discovered[playerID] {
		if id == "knife" {
			discOK = true
		}
	}
	collOK := false
	for _, id := range m2.collected[playerID] {
		if id == "knife" {
			collOK = true
		}
	}
	m2.mu.RUnlock()

	if !discOK {
		t.Fatal("knife not in discovered after restore")
	}
	if !collOK {
		t.Fatal("knife not in collected after restore")
	}
}

func TestEvidenceModule_BuildState(t *testing.T) {
	m := NewEvidenceModule()
	if err := m.Init(context.Background(), newTestDeps(), evidenceCfg()); err != nil {
		t.Fatalf("Init: %v", err)
	}
	data, err := m.BuildState()
	if err != nil {
		t.Fatalf("BuildState: %v", err)
	}
	var s evidenceState
	if err := json.Unmarshal(data, &s); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
}

func TestEvidenceModule_BuildStateFor_CallerOnly(t *testing.T) {
	m := NewEvidenceModule()
	if err := m.Init(context.Background(), newTestDeps(), evidenceCfg()); err != nil {
		t.Fatalf("Init: %v", err)
	}
	alice := uuid.New()
	bob := uuid.New()
	_ = m.HandleMessage(context.Background(), alice,
		"discover", json.RawMessage(`{"evidence_id":"knife","location_id":"hall"}`))
	_ = m.HandleMessage(context.Background(), alice,
		"collect", json.RawMessage(`{"evidence_id":"knife"}`))
	_ = m.HandleMessage(context.Background(), bob,
		"discover", json.RawMessage(`{"evidence_id":"knife","location_id":"hall"}`))

	data, err := m.BuildStateFor(alice)
	if err != nil {
		t.Fatalf("BuildStateFor(alice): %v", err)
	}
	var s evidenceState
	if err := json.Unmarshal(data, &s); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if len(s.Discovered) != 1 || len(s.Discovered[alice.String()]) != 1 {
		t.Fatalf("alice discovered should be only her own knife, got %v", s.Discovered)
	}
	if _, leaked := s.Discovered[bob.String()]; leaked {
		t.Fatalf("bob's discovered leaked into alice's view: %v", s.Discovered)
	}
	if len(s.Collected) != 1 || s.Collected[alice.String()][0] != "knife" {
		t.Fatalf("alice collected should be [knife], got %v", s.Collected)
	}
}

func TestEvidenceModule_BuildStateFor_NoEntry(t *testing.T) {
	m := NewEvidenceModule()
	if err := m.Init(context.Background(), newTestDeps(), evidenceCfg()); err != nil {
		t.Fatalf("Init: %v", err)
	}
	stranger := uuid.New()
	data, err := m.BuildStateFor(stranger)
	if err != nil {
		t.Fatalf("BuildStateFor: %v", err)
	}
	var s evidenceState
	if err := json.Unmarshal(data, &s); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if s.Discovered == nil || len(s.Discovered) != 0 {
		t.Fatalf("expected empty non-nil Discovered, got %v", s.Discovered)
	}
	if s.Collected == nil || len(s.Collected) != 0 {
		t.Fatalf("expected empty non-nil Collected, got %v", s.Collected)
	}
	// JSON shape must be {} not null.
	if bytes.Contains(data, []byte("null")) {
		t.Fatalf("expected {} JSON shape, got %s", data)
	}
}

func TestEvidenceModule_BuildStateFor_NoCrossLeak(t *testing.T) {
	m := NewEvidenceModule()
	if err := m.Init(context.Background(), newTestDeps(), evidenceCfg()); err != nil {
		t.Fatalf("Init: %v", err)
	}
	alice := uuid.New()
	bob := uuid.New()
	_ = m.HandleMessage(context.Background(), alice,
		"discover", json.RawMessage(`{"evidence_id":"knife","location_id":"hall"}`))
	_ = m.HandleMessage(context.Background(), bob,
		"discover", json.RawMessage(`{"evidence_id":"knife","location_id":"hall"}`))
	_ = m.HandleMessage(context.Background(), bob,
		"collect", json.RawMessage(`{"evidence_id":"knife"}`))

	aliceData, _ := m.BuildStateFor(alice)
	bobData, _ := m.BuildStateFor(bob)

	// Alice's serialised state must not reference Bob's uuid.
	if bytes.Contains(aliceData, []byte(bob.String())) {
		t.Fatalf("alice's view leaked bob's uuid: %s", aliceData)
	}
	// Bob's serialised state must not reference Alice's uuid.
	if bytes.Contains(bobData, []byte(alice.String())) {
		t.Fatalf("bob's view leaked alice's uuid: %s", bobData)
	}
}

func TestEvidenceModule_Cleanup(t *testing.T) {
	m := NewEvidenceModule()
	if err := m.Init(context.Background(), newTestDeps(), evidenceCfg()); err != nil {
		t.Fatalf("Init: %v", err)
	}
	if err := m.Cleanup(context.Background()); err != nil {
		t.Fatalf("Cleanup: %v", err)
	}
	m.mu.RLock()
	if m.evidenceSet != nil {
		t.Fatal("expected nil evidenceSet after cleanup")
	}
	m.mu.RUnlock()
}
