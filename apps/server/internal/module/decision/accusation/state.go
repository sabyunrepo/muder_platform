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

// BuildStateFor returns the same state as BuildState for now.
// PR-2a (F-sec-2 gate): satisfies engine.PlayerAwareModule interface.
// PR-2b will redact the live vote tally per viewer — votes should only be
// visible post-resolution to avoid strategic coercion during the vote.
func (m *AccusationModule) BuildStateFor(_ uuid.UUID) (json.RawMessage, error) {
	return m.BuildState()
}
