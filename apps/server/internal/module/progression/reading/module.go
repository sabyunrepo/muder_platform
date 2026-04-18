// Package reading implements the script reading progression module.
//
// A ReadingModule walks clients through a sequence of script lines with
// per-line voice media, advance-by rules (gm / voice / role:<id>) and
// host/role-gated progression. The module is session-scoped; each
// factory invocation returns a fresh instance.
package reading

import (
	"context"
	"encoding/json"
	"fmt"
	"sync"

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

// NewReadingModule creates a new ReadingModule instance.
func NewReadingModule() *ReadingModule {
	return &ReadingModule{}
}

// Name returns the module identifier.
func (m *ReadingModule) Name() string { return "reading" }

// Init initialises the module with session context and configuration.
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

	// Emit reading.started so the WS bridge can push a reading:started
	// envelope to all connected session clients. Lines are emitted in the
	// raw storage (PascalCase) shape; the bridge converts to camelCase wire
	// format before broadcast. A defensive copy is taken so downstream
	// subscribers cannot mutate module-owned state.
	linesCopy := make([]readingLineConfig, len(m.lines))
	copy(linesCopy, m.lines)
	deps.EventBus.Publish(engine.Event{
		Type: "reading.started",
		Payload: map[string]any{
			"lines":      linesCopy,
			"bgmMediaId": m.bgmId,
			"totalLines": m.totalLines,
		},
	})

	return nil
}

// Cleanup releases resources when the session ends.
func (m *ReadingModule) Cleanup(ctx context.Context) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	m.isActive = false
	return nil
}

// Compile-time interface checks.
var (
	_ engine.Module            = (*ReadingModule)(nil)
	_ engine.ConfigSchema      = (*ReadingModule)(nil)
	_ engine.PhaseHookModule   = (*ReadingModule)(nil)
	_ engine.PlayerAwareModule = (*ReadingModule)(nil)
)

func init() {
	engine.Register("reading", func() engine.Module { return NewReadingModule() })
}
