package combination

import "github.com/google/uuid"

// SeedCollectedForTest seeds the internal `collected` map for a player with
// the given evidence IDs. This mirrors the effect of receiving a sequence of
// "evidence.collected" events without having to stand up the evidence module.
// Exported so that cross-package integration tests (e.g. crime_scene
// integration_test.go) can drive the combination module without reaching
// into its unexported state. MUST NOT be used outside tests — production
// code MUST go through the event bus subscription installed by Init.
func (m *CombinationModule) SeedCollectedForTest(playerID uuid.UUID, evidenceIDs ...string) {
	m.mu.Lock()
	defer m.mu.Unlock()

	if m.collected == nil {
		m.collected = make(map[uuid.UUID]map[string]bool)
	}
	if m.collected[playerID] == nil {
		m.collected[playerID] = make(map[string]bool, len(evidenceIDs))
	}
	for _, id := range evidenceIDs {
		m.collected[playerID][id] = true
	}
}
