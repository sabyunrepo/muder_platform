package progression

import (
	"context"
	"encoding/json"
	"fmt"
	"sync"

	"github.com/google/uuid"
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
}

type readingConfig struct {
	AdvanceMode    string              `json:"AdvanceMode"`
	DefaultVoiceID string              `json:"DefaultVoiceID"`
	TotalLines     int                 `json:"TotalLines"`
	Lines          []readingLineConfig `json:"Lines,omitempty"`
	BGMId          string              `json:"BGMId,omitempty"`
}

type readingLineConfig struct {
	VoiceID string `json:"VoiceID,omitempty"`
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
