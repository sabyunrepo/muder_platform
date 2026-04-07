package progression

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"sync"

	"github.com/google/uuid"
	"github.com/mmp-platform/server/internal/apperror"
	"github.com/mmp-platform/server/internal/engine"
)

// ReadingModule manages script reading progression with line-by-line advancement.
type ReadingModule struct {
	mu   sync.RWMutex
	deps engine.ModuleDeps

	// config
	advanceMode    string // "gm", "auto", "player"
	defaultVoiceID string
	bgmId          string
	lines          []readingLineConfig

	// state
	currentLineIndex int
	totalLines       int
	isActive         bool
	status           readingStatus
	pausedReason     string
}

// readingStatus describes whether the reading flow is currently advancing,
// halted (waiting on a missing player), or not yet/no longer active.
type readingStatus string

const (
	readingStatusIdle    readingStatus = "idle"
	readingStatusPlaying readingStatus = "playing"
	readingStatusPaused  readingStatus = "paused"
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

type readingConfig struct {
	AdvanceMode    string              `json:"AdvanceMode"`
	DefaultVoiceID string              `json:"DefaultVoiceID"`
	TotalLines     int                 `json:"TotalLines"`
	Lines          []readingLineConfig `json:"Lines,omitempty"`
	BGMId          string              `json:"BGMId,omitempty"`
}

type readingLineConfig struct {
	VoiceID      string `json:"VoiceID,omitempty"`
	AdvanceBy    string `json:"AdvanceBy,omitempty"`
	Speaker      string `json:"Speaker,omitempty"`
	VoiceMediaID string `json:"VoiceMediaID,omitempty"`
}

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

// HandleVoiceEnded is the server-trusted advance entry point for lines whose
// effective advanceBy is "voice". It bypasses the player/host permission
// check because the server itself is the source of truth for media end.
// On non-voice lines this is a no-op (the timing race between client-reported
// voice end and a player advance is resolved in the player's favor).
func (m *ReadingModule) HandleVoiceEnded(ctx context.Context, voiceID string) error {
	m.mu.Lock()
	if !m.isActive {
		m.mu.Unlock()
		return nil
	}
	if m.totalLines <= 0 || m.currentLineIndex < 0 || m.currentLineIndex >= m.totalLines {
		m.mu.Unlock()
		return nil
	}
	advanceBy := m.resolveAdvanceBy(m.currentLineIndex)
	if advanceBy != "voice" {
		// Non-voice line: ignore stale voice_ended events. This handles the
		// case where a player manually advanced past a voice line just as
		// the media completed on the client.
		m.mu.Unlock()
		return nil
	}

	// Perform the advance under the held lock (mirrors HandleAdvance).
	if m.currentLineIndex >= m.totalLines-1 {
		m.isActive = false
		totalLines := m.totalLines
		m.mu.Unlock()
		m.deps.EventBus.Publish(engine.Event{
			Type:    "reading.completed",
			Payload: map[string]any{"totalLines": totalLines},
		})
		return nil
	}
	m.currentLineIndex++
	lineIndex := m.currentLineIndex
	totalLines := m.totalLines
	nextVoiceID := m.resolveVoiceID(lineIndex)
	completed := m.currentLineIndex >= m.totalLines-1
	if completed {
		m.isActive = false
	}
	m.mu.Unlock()

	m.deps.EventBus.Publish(engine.Event{
		Type: "reading.line_changed",
		Payload: map[string]any{
			"lineIndex":  lineIndex,
			"totalLines": totalLines,
			"voiceId":    nextVoiceID,
		},
	})
	if completed {
		m.deps.EventBus.Publish(engine.Event{
			Type:    "reading.completed",
			Payload: map[string]any{"totalLines": totalLines},
		})
	}
	return nil
}

// HandleAdvance validates that the caller is allowed to advance the current
// reading line, and on success advances to the next line (publishing
// reading.line_changed / reading.completed events). The caller must resolve
// host status and the player's role id from the session before calling.
//
// Returns *apperror.AppError on permission/state errors.
func (m *ReadingModule) HandleAdvance(ctx context.Context, playerID uuid.UUID, isHost bool, roleID string) error {
	m.mu.Lock()
	if !m.isActive {
		m.mu.Unlock()
		return apperror.New(apperror.ErrReadingLineOutOfRange, http.StatusNotFound, "reading: module not active")
	}
	if m.totalLines <= 0 || m.currentLineIndex < 0 || m.currentLineIndex >= m.totalLines {
		m.mu.Unlock()
		return apperror.New(apperror.ErrReadingLineOutOfRange, http.StatusNotFound, "reading: no current line")
	}

	advanceBy := m.resolveAdvanceBy(m.currentLineIndex)
	if !validAdvanceBy(advanceBy) {
		m.mu.Unlock()
		return apperror.New(apperror.ErrReadingInvalidAdvanceBy, http.StatusUnprocessableEntity,
			fmt.Sprintf("reading: invalid advanceBy %q on line %d", advanceBy, m.currentLineIndex))
	}

	switch {
	case advanceBy == "voice":
		m.mu.Unlock()
		return apperror.New(apperror.ErrReadingAdvanceForbidden, http.StatusForbidden,
			"reading: line advances on voice end; manual advance forbidden")
	case advanceBy == "gm":
		if !isHost {
			m.mu.Unlock()
			return apperror.New(apperror.ErrReadingAdvanceForbidden, http.StatusForbidden,
				"reading: only the host can advance this line")
		}
	case strings.HasPrefix(advanceBy, "role:"):
		need := strings.TrimPrefix(advanceBy, "role:")
		if roleID != need {
			m.mu.Unlock()
			return apperror.New(apperror.ErrReadingAdvanceForbidden, http.StatusForbidden,
				fmt.Sprintf("reading: only role %q can advance this line", need))
		}
	}

	// Permission OK — perform the advance under the held lock.
	if m.currentLineIndex >= m.totalLines-1 {
		m.isActive = false
		totalLines := m.totalLines
		m.mu.Unlock()
		m.deps.EventBus.Publish(engine.Event{
			Type:    "reading.completed",
			Payload: map[string]any{"totalLines": totalLines},
		})
		return nil
	}

	m.currentLineIndex++
	lineIndex := m.currentLineIndex
	totalLines := m.totalLines
	voiceID := m.resolveVoiceID(lineIndex)
	completed := m.currentLineIndex >= m.totalLines-1
	if completed {
		m.isActive = false
	}
	m.mu.Unlock()

	m.deps.EventBus.Publish(engine.Event{
		Type: "reading.line_changed",
		Payload: map[string]any{
			"lineIndex":  lineIndex,
			"totalLines": totalLines,
			"voiceId":    voiceID,
		},
	})
	if completed {
		m.deps.EventBus.Publish(engine.Event{
			Type:    "reading.completed",
			Payload: map[string]any{"totalLines": totalLines},
		})
	}
	return nil
}

// NewReadingModule creates a new ReadingModule instance.
func NewReadingModule() *ReadingModule {
	return &ReadingModule{}
}

func (m *ReadingModule) Name() string { return "reading" }

func (m *ReadingModule) Init(ctx context.Context, deps engine.ModuleDeps, config json.RawMessage) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	m.deps = deps

	var cfg readingConfig
	if config != nil && len(config) > 0 {
		if err := json.Unmarshal(config, &cfg); err != nil {
			return fmt.Errorf("reading: invalid config: %w", err)
		}
	}

	// Apply defaults
	if cfg.AdvanceMode == "" {
		cfg.AdvanceMode = "gm"
	}

	m.advanceMode = cfg.AdvanceMode
	m.defaultVoiceID = cfg.DefaultVoiceID
	m.bgmId = cfg.BGMId
	m.lines = cfg.Lines
	m.totalLines = cfg.TotalLines
	if m.totalLines == 0 && len(m.lines) > 0 {
		m.totalLines = len(m.lines)
	}
	m.currentLineIndex = 0
	m.isActive = true
	m.status = readingStatusPlaying
	m.pausedReason = ""

	// If section BGM configured, emit override on activation
	if m.bgmId != "" {
		deps.EventBus.Publish(engine.Event{
			Type:    "audio.set_bgm",
			Payload: map[string]any{"mediaId": m.bgmId, "fadeMs": 1000},
		})
	}

	return nil
}

// resolveVoiceID returns the voiceID for a given line index, falling back to default.
func (m *ReadingModule) resolveVoiceID(idx int) string {
	if idx >= 0 && idx < len(m.lines) && m.lines[idx].VoiceID != "" {
		return m.lines[idx].VoiceID
	}
	return m.defaultVoiceID
}

// HandleMessage is the legacy engine.Module entry point for reading messages.
//
// Deprecated: Use HandleAdvance / HandleVoiceEnded directly from the WS
// handler so that role/host permission checks (HandleAdvance) and the
// advanceBy="voice" gate (HandleVoiceEnded) are enforced. The
// "reading:advance" branch here intentionally bypasses permission checks and
// is retained only to satisfy the engine.Module interface for non-WS
// callers (e.g. legacy tests). New code MUST NOT route player input through
// this path.
func (m *ReadingModule) HandleMessage(ctx context.Context, playerID uuid.UUID, msgType string, payload json.RawMessage) error {
	m.mu.Lock()

	switch msgType {
	case "reading:advance":
		if !m.isActive {
			m.mu.Unlock()
			return fmt.Errorf("reading: module not active")
		}
		if m.totalLines <= 0 {
			m.mu.Unlock()
			return fmt.Errorf("reading: no lines configured")
		}
		if m.currentLineIndex >= m.totalLines-1 {
			// Already at last line, mark completed
			m.isActive = false
			totalLines := m.totalLines
			m.mu.Unlock()

			m.deps.EventBus.Publish(engine.Event{
				Type:    "reading.completed",
				Payload: map[string]any{"totalLines": totalLines},
			})
			return nil
		}

		m.currentLineIndex++
		lineIndex := m.currentLineIndex
		totalLines := m.totalLines
		voiceID := m.resolveVoiceID(lineIndex)
		completed := m.currentLineIndex >= m.totalLines-1
		if completed {
			m.isActive = false
		}
		m.mu.Unlock()

		m.deps.EventBus.Publish(engine.Event{
			Type: "reading.line_changed",
			Payload: map[string]any{
				"lineIndex":  lineIndex,
				"totalLines": totalLines,
				"voiceId":    voiceID,
			},
		})

		// Check if this was the last line
		if completed {
			m.deps.EventBus.Publish(engine.Event{
				Type:    "reading.completed",
				Payload: map[string]any{"totalLines": totalLines},
			})
		}
		return nil

	case "reading:voice_ended":
		if !m.isActive {
			m.mu.Unlock()
			return nil
		}
		if m.advanceMode != "auto" {
			m.mu.Unlock()
			return nil // non-auto modes ignore voice_ended
		}
		m.mu.Unlock()
		// Trigger advance by recursing (self message)
		return m.HandleMessage(ctx, playerID, "reading:advance", nil)

	case "reading:jump":
		if !m.isActive {
			m.mu.Unlock()
			return fmt.Errorf("reading: module not active")
		}
		var p struct {
			LineIndex int `json:"LineIndex"`
		}
		if err := json.Unmarshal(payload, &p); err != nil {
			m.mu.Unlock()
			return fmt.Errorf("reading: invalid payload: %w", err)
		}
		if p.LineIndex < 0 || p.LineIndex >= m.totalLines {
			m.mu.Unlock()
			return fmt.Errorf("reading: line index %d out of range [0, %d)", p.LineIndex, m.totalLines)
		}

		m.currentLineIndex = p.LineIndex
		lineIndex := m.currentLineIndex
		totalLines := m.totalLines
		voiceID := m.resolveVoiceID(lineIndex)
		completed := m.currentLineIndex >= m.totalLines-1
		if completed {
			m.isActive = false
		}
		m.mu.Unlock()

		m.deps.EventBus.Publish(engine.Event{
			Type: "reading.line_changed",
			Payload: map[string]any{
				"lineIndex":  lineIndex,
				"totalLines": totalLines,
				"voiceId":    voiceID,
			},
		})

		// Check if jumped to last line
		if completed {
			m.deps.EventBus.Publish(engine.Event{
				Type:    "reading.completed",
				Payload: map[string]any{"totalLines": totalLines},
			})
		}
		return nil

	default:
		m.mu.Unlock()
		return fmt.Errorf("reading: unknown message type %q", msgType)
	}
}

// HandlePlayerLeft is invoked by the WS handler when a player disconnects.
// The handler resolves whether the leaving player is the host and which
// role IDs they owned, then calls this method. If the current line's
// effective advanceBy depends on the leaving party, the module enters the
// paused state and emits reading.paused. Voice-driven lines are unaffected
// since they advance on media end, not on a player action.
func (m *ReadingModule) HandlePlayerLeft(ctx context.Context, hostLeaving bool, leftRoleIDs []string) {
	m.mu.Lock()
	if !m.isActive || m.status != readingStatusPlaying {
		m.mu.Unlock()
		return
	}
	if m.totalLines <= 0 || m.currentLineIndex < 0 || m.currentLineIndex >= m.totalLines {
		m.mu.Unlock()
		return
	}
	advanceBy := m.resolveAdvanceBy(m.currentLineIndex)
	needsPause := false
	switch {
	case advanceBy == "gm" && hostLeaving:
		needsPause = true
	case strings.HasPrefix(advanceBy, "role:"):
		need := strings.TrimPrefix(advanceBy, "role:")
		for _, r := range leftRoleIDs {
			if r == need {
				needsPause = true
				break
			}
		}
	}
	if !needsPause {
		m.mu.Unlock()
		return
	}
	m.status = readingStatusPaused
	m.pausedReason = "player_left"
	lineIndex := m.currentLineIndex
	m.mu.Unlock()

	m.deps.EventBus.Publish(engine.Event{
		Type: "reading.paused",
		Payload: map[string]any{
			"lineIndex": lineIndex,
			"advanceBy": advanceBy,
			"reason":    "player_left",
		},
	})
}

// HandlePlayerRejoined is invoked by the WS handler when the previously
// missing party returns. If the rejoining party satisfies the current line's
// advanceBy requirement, the module returns to the playing state and emits
// reading.resumed.
func (m *ReadingModule) HandlePlayerRejoined(ctx context.Context, hostRejoining bool, rejoinedRoleIDs []string) {
	m.mu.Lock()
	if m.status != readingStatusPaused {
		m.mu.Unlock()
		return
	}
	if m.totalLines <= 0 || m.currentLineIndex < 0 || m.currentLineIndex >= m.totalLines {
		m.mu.Unlock()
		return
	}
	advanceBy := m.resolveAdvanceBy(m.currentLineIndex)
	canResume := false
	switch {
	case advanceBy == "gm" && hostRejoining:
		canResume = true
	case strings.HasPrefix(advanceBy, "role:"):
		need := strings.TrimPrefix(advanceBy, "role:")
		for _, r := range rejoinedRoleIDs {
			if r == need {
				canResume = true
				break
			}
		}
	}
	if !canResume {
		m.mu.Unlock()
		return
	}
	m.status = readingStatusPlaying
	m.pausedReason = ""
	lineIndex := m.currentLineIndex
	m.mu.Unlock()

	m.deps.EventBus.Publish(engine.Event{
		Type: "reading.resumed",
		Payload: map[string]any{
			"lineIndex": lineIndex,
			"advanceBy": advanceBy,
		},
	})
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

func (m *ReadingModule) Cleanup(ctx context.Context) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	m.isActive = false
	return nil
}

// Schema returns the JSON Schema for ReadingModule settings.
func (m *ReadingModule) Schema() json.RawMessage {
	return json.RawMessage(`{
		"type": "object",
		"properties": {
			"AdvanceMode": {"type": "string", "enum": ["gm", "auto", "player"], "default": "gm"},
			"DefaultVoiceID": {"type": "string"},
			"TotalLines": {"type": "integer", "minimum": 0},
			"BGMId": {"type": "string"},
			"Lines": {
				"type": "array",
				"items": {
					"type": "object",
					"properties": {
						"VoiceID": {"type": "string"}
					}
				}
			}
		}
	}`)
}

func init() {
	engine.Register("reading", func() engine.Module { return NewReadingModule() })
}
