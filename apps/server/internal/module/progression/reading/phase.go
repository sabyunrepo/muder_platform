package reading

import (
	"context"

	"github.com/mmp-platform/server/internal/engine"
)

// --- PhaseHookModule ---

// OnPhaseEnter is a no-op: reading progression is driven by explicit
// HandleAdvance / HandleVoiceEnded calls, not phase transitions.
func (m *ReadingModule) OnPhaseEnter(_ context.Context, _ engine.Phase) error {
	return nil
}

// OnPhaseExit is a no-op for the same reason as OnPhaseEnter.
func (m *ReadingModule) OnPhaseExit(_ context.Context, _ engine.Phase) error {
	return nil
}
