// Package ending_branch implements the ending_branch module — a configurable
// question-driven branching system that routes sessions to distinct endings
// based on player responses and a priority-ordered condition matrix (D-23).
// The JSONLogic matrix evaluator is deferred to PR-5.
package ending_branch

import (
	"context"
	"encoding/json"
	"fmt"
	"sync"

	"github.com/google/uuid"

	"github.com/mmp-platform/server/internal/engine"
)

// Module implements the ending_branch session module.
// It is a skeleton for Phase 24 PR-1: Name + Schema + Init + ApplyConfig are
// fully implemented; HandleMessage and matrix evaluation are deferred to PR-5.
type Module struct {
	mu  sync.RWMutex
	cfg Config
}

// NewModule creates a new Module instance.
func NewModule() *Module {
	return &Module{}
}

// Name returns the module identifier.
func (m *Module) Name() string { return "ending_branch" }

// Init initialises the module. The config JSON passed via Init is applied
// immediately; callers may also call ApplyConfig separately before the first
// player message.
func (m *Module) Init(_ context.Context, _ engine.ModuleDeps, config json.RawMessage) error {
	if len(config) > 0 {
		return m.applyConfigLocked(config)
	}
	return nil
}

// ApplyConfig parses and stores the typed config. It is not part of
// engine.Module; the session manager calls it explicitly for ending_branch
// when the editor persists updated settings.
func (m *Module) ApplyConfig(_ context.Context, raw json.RawMessage) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	return m.applyConfigLocked(raw)
}

// applyConfigLocked unmarshals raw into m.cfg. Caller must hold m.mu.Lock.
func (m *Module) applyConfigLocked(raw json.RawMessage) error {
	if len(raw) == 0 {
		return nil
	}
	var cfg Config
	if err := json.Unmarshal(raw, &cfg); err != nil {
		return fmt.Errorf("ending_branch: invalid config: %w", err)
	}
	m.cfg = cfg
	return nil
}

// BuildState returns the public module state for client sync.
// For this skeleton, only config metadata is exposed (no runtime answers yet).
func (m *Module) BuildState() (json.RawMessage, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	return json.Marshal(map[string]any{
		"questionCount": len(m.cfg.Questions),
		"defaultEnding": m.cfg.DefaultEnding,
	})
}

// BuildStateFor returns the per-player module state. Question definitions are
// public; respondent-specific answer data (added in PR-5) will be redacted
// here per player role.
func (m *Module) BuildStateFor(_ uuid.UUID) (json.RawMessage, error) {
	return m.BuildState()
}

// HandleMessage processes a player action routed to this module.
// Full answer-submission logic is deferred to PR-5.
func (m *Module) HandleMessage(_ context.Context, _ uuid.UUID, _ string, _ json.RawMessage) error {
	return fmt.Errorf("ending_branch: message handling not yet implemented (PR-5)")
}

// Cleanup releases resources when the session ends.
func (m *Module) Cleanup(_ context.Context) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.cfg = Config{}
	return nil
}

// Schema implements engine.ConfigSchema — D-23 + D-24 + D-26 합본.
//
// `questions[]` 배열은 분기(impact: "branch")와 점수(impact: "score") 두 종류 통합.
// `scoreMap`은 impact:"score" 케이스에 보기→점수 매핑 (D-24 embed).
// `multiVoteThreshold`는 D-26 per-choice threshold (default 0.5).
func (m *Module) Schema() json.RawMessage {
	schema := map[string]any{
		"type": "object",
		"properties": map[string]any{
			"questions": map[string]any{
				"type": "array",
				"items": map[string]any{
					"type": "object",
					"properties": map[string]any{
						"id":      map[string]any{"type": "string"},
						"text":    map[string]any{"type": "string"},
						"type":    map[string]any{"type": "string", "enum": []string{"single", "multi"}},
						"choices": map[string]any{"type": "array", "items": map[string]any{"type": "string"}},
						"respondents": map[string]any{}, // []string | "all" | "some" — runtime validate
						"impact":  map[string]any{"type": "string", "enum": []string{"branch", "score"}},
						"scoreMap": map[string]any{
							"type":                 "object",
							"additionalProperties": map[string]any{"type": "integer"},
						},
					},
					"required":             []string{"id", "text", "type", "choices", "impact"},
					"additionalProperties": false,
				},
			},
			"matrix": map[string]any{
				"type": "array",
				"items": map[string]any{
					"type": "object",
					"properties": map[string]any{
						"priority":   map[string]any{"type": "integer", "minimum": 1},
						"conditions": map[string]any{"type": "object"},
						"ending":     map[string]any{"type": "string"},
					},
					"required":             []string{"priority", "conditions", "ending"},
					"additionalProperties": false,
				},
			},
			"defaultEnding": map[string]any{"type": "string"},
			"multiVoteThreshold": map[string]any{
				"type":    "number",
				"minimum": 0,
				"maximum": 1,
				"default": 0.5,
			},
		},
		"additionalProperties": false,
	}
	data, _ := json.Marshal(schema)
	return data
}

func init() {
	engine.Register("ending_branch", func() engine.Module { return NewModule() })
}

// Compile-time interface assertions.
var (
	_ engine.Module            = (*Module)(nil)
	_ engine.ConfigSchema      = (*Module)(nil)
	_ engine.PlayerAwareModule = (*Module)(nil)
)
