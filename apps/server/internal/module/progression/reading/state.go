package reading

import (
	"encoding/json"

	"github.com/google/uuid"
)

// ReadingState is an immutable snapshot of the reading module state suitable
// for sending to a reconnecting client via the reading.state event.
type ReadingState struct {
	SectionID    string              `json:"sectionId"`
	CurrentIndex int                 `json:"currentIndex"`
	Lines        []readingLineConfig `json:"lines"`
	BgmMediaID   string              `json:"bgmMediaId,omitempty"`
	Status       string              `json:"status"`
}

// ReadingStateWire is a JSON-encoding-friendly snapshot of the reading state
// suitable for sending across the WebSocket without leaking unexported types.
// Lines is pre-marshalled to json.RawMessage so that ws.ReadingStateSnapshot
// (which uses RawMessage) can ferry it through unchanged.
type ReadingStateWire struct {
	SectionID    string          `json:"sectionId"`
	CurrentIndex int             `json:"currentIndex"`
	Lines        json.RawMessage `json:"lines"`
	BgmMediaID   string          `json:"bgmMediaId,omitempty"`
	Status       string          `json:"status"`
}

// GetState returns an immutable snapshot of the current reading state for
// reconnecting clients. The Lines slice is copied so that callers cannot
// mutate internal module state.
func (m *ReadingModule) GetState() ReadingState {
	m.mu.RLock()
	defer m.mu.RUnlock()

	linesCopy := make([]readingLineConfig, len(m.lines))
	copy(linesCopy, m.lines)

	status := string(m.status)
	if status == "" {
		if m.isActive {
			status = string(readingStatusPlaying)
		} else {
			status = string(readingStatusIdle)
		}
	}

	return ReadingState{
		// SectionID is reserved for future use; the reading module currently
		// does not track its owning section identifier — the WS handler can
		// inject it when broadcasting if needed.
		SectionID:    "",
		CurrentIndex: m.currentLineIndex,
		Lines:        linesCopy,
		BgmMediaID:   m.bgmId,
		Status:       status,
	}
}

// GetReadingStateWire returns a wire-friendly snapshot of the current
// reading state. Lines are pre-marshalled so callers don't need to know
// about the unexported readingLineConfig type. The SectionID field is left
// empty here; the WS bridge injects it from the per-session registry.
func (m *ReadingModule) GetReadingStateWire() ReadingStateWire {
	state := m.GetState()
	linesJSON, err := json.Marshal(state.Lines)
	if err != nil {
		// json.Marshal of a known struct slice should never fail; fall back
		// to an empty array so the wire envelope stays valid JSON.
		linesJSON = json.RawMessage(`[]`)
	}
	return ReadingStateWire{
		SectionID:    state.SectionID,
		CurrentIndex: state.CurrentIndex,
		Lines:        linesJSON,
		BgmMediaID:   state.BgmMediaID,
		Status:       state.Status,
	}
}

// BuildState returns the module's current state for client sync.
func (m *ReadingModule) BuildState() (json.RawMessage, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	state := map[string]any{
		"currentLine": m.currentLineIndex,
		"totalLines":  m.totalLines,
		"isActive":    m.isActive,
		"advanceMode": m.advanceMode,
	}
	return json.Marshal(state)
}

// BuildStateFor returns reading-module state for the given player.
//
// The reading module has no per-player progress — currentLineIndex and
// totalLines are session-wide (the narrator/host advances and all players
// observe the same line). BuildStateFor therefore produces a snapshot
// shape-identical to BuildState but via an independent path so a future
// role-gated reveal (e.g. "only the narrator sees the next line's
// character prompt") can be layered here without touching BuildState.
func (m *ReadingModule) BuildStateFor(_ uuid.UUID) (json.RawMessage, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	return json.Marshal(map[string]any{
		"currentLine": m.currentLineIndex,
		"totalLines":  m.totalLines,
		"isActive":    m.isActive,
		"advanceMode": m.advanceMode,
	})
}
