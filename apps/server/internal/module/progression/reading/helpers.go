package reading

import "strings"

// readingStatus describes whether the reading flow is currently advancing,
// halted (waiting on a missing player), or not yet/no longer active.
type readingStatus string

const (
	readingStatusIdle    readingStatus = "idle"
	readingStatusPlaying readingStatus = "playing"
	readingStatusPaused  readingStatus = "paused"
)

// validAdvanceBy reports whether s is a recognized advanceBy value:
//   - "" (empty falls back to module-level advanceMode default; treated as "gm")
//   - "gm"
//   - "voice"
//   - "role:<roleId>" with non-empty roleId
func validAdvanceBy(s string) bool {
	if s == "" || s == "gm" || s == "voice" {
		return true
	}
	if strings.HasPrefix(s, "role:") && len(strings.TrimPrefix(s, "role:")) > 0 {
		return true
	}
	return false
}

// resolveAdvanceBy returns the effective advanceBy for a given line index.
// When the per-line value is empty it falls back to the module's advanceMode
// (mapped to the per-line vocabulary).
func (m *ReadingModule) resolveAdvanceBy(idx int) string {
	if idx >= 0 && idx < len(m.lines) && m.lines[idx].AdvanceBy != "" {
		return m.lines[idx].AdvanceBy
	}
	switch m.advanceMode {
	case "auto":
		return "voice"
	case "player", "gm":
		return "gm"
	default:
		return "gm"
	}
}

// resolveVoiceID returns the voiceID for a given line index, falling back to default.
func (m *ReadingModule) resolveVoiceID(idx int) string {
	if idx >= 0 && idx < len(m.lines) && m.lines[idx].VoiceID != "" {
		return m.lines[idx].VoiceID
	}
	return m.defaultVoiceID
}
