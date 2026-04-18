package accusation

import (
	"encoding/json"

	"github.com/google/uuid"
)

type accusationState struct {
	ActiveAccusation  *Accusation      `json:"activeAccusation"`
	AccusationCount   int              `json:"accusationCount"`
	IsActive          bool             `json:"isActive"`
	Config            AccusationConfig `json:"config"`
	ExpelledCode      string           `json:"expelledCode,omitempty"`
	ExpelledIsCulprit bool             `json:"expelledIsCulprit,omitempty"`
}

// BuildState returns the public module state for client sync.
func (m *AccusationModule) BuildState() (json.RawMessage, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	return json.Marshal(accusationState{
		ActiveAccusation:  m.activeAccusation,
		AccusationCount:   m.accusationCount,
		IsActive:          m.isActive,
		Config:            m.config,
		ExpelledCode:      m.expelledCode,
		ExpelledIsCulprit: m.expelledIsCulprit,
	})
}

// BuildStateFor returns accusation state with the live vote tally redacted.
//
// Phase 19 PR-2b policy: while an accusation is in progress (activeAccusation
// != nil), the `Votes` map is withheld from every player's snapshot to
// prevent mid-defense coercion. When the accusation resolves, the module
// nils out activeAccusation (see handlers.go), so no votes are published
// post-hoc via this path — the outcome is delivered through the public
// expelledCode / expelledIsCulprit fields and the accusation.resolved event.
//
// The playerID argument is accepted for interface conformance; the redaction
// is uniform across players by design (uniform hiding prevents inference
// from "I can see my own vote but not others" revealing relative timing).
func (m *AccusationModule) BuildStateFor(_ uuid.UUID) (json.RawMessage, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	s := accusationState{
		AccusationCount:   m.accusationCount,
		IsActive:          m.isActive,
		Config:            m.config,
		ExpelledCode:      m.expelledCode,
		ExpelledIsCulprit: m.expelledIsCulprit,
	}
	if m.activeAccusation != nil {
		redacted := *m.activeAccusation
		redacted.Votes = map[uuid.UUID]bool{}
		s.ActiveAccusation = &redacted
	}
	return json.Marshal(s)
}
