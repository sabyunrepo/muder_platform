// Package ending_branch implements the ending_branch module — a configurable
// question-driven branching system that routes sessions to distinct endings
// based on player responses and a priority-ordered condition matrix (D-23).
// Runtime evaluation is connected to phase actions in Phase 24 PR-9.
package ending_branch

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"sync"

	"github.com/google/uuid"

	"github.com/mmp-platform/server/internal/engine"
)

// Module implements the ending_branch session module.
//
// It stores player answers, evaluates the priority-ordered ending matrix, and
// exposes player-aware state so one player's answer choices are not leaked to
// others during reconnect or live sync.
type Module struct {
	mu      sync.RWMutex
	cfg     Config
	deps    engine.ModuleDeps
	answers map[string]map[uuid.UUID][]string
	result  *evaluationResult
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
func (m *Module) Init(_ context.Context, deps engine.ModuleDeps, config json.RawMessage) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.deps = deps
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

// applyConfigLocked decodes raw into m.cfg using a strict decoder that rejects
// unknown fields and trailing data. Caller must hold m.mu.Lock.
// An empty or nil payload explicitly resets the config to the zero value so
// that deletion/clear requests do not leave stale configuration in m.cfg.
// D-26: if MultiVoteThreshold is absent (nil), defaults to 0.5. If present,
// must be in [0, 1] or an error is returned.
func (m *Module) applyConfigLocked(raw json.RawMessage) error {
	if len(raw) == 0 {
		m.cfg = Config{}
		m.answers = nil
		m.result = nil
		return nil
	}
	dec := json.NewDecoder(bytes.NewReader(raw))
	dec.DisallowUnknownFields()
	var cfg Config
	if err := dec.Decode(&cfg); err != nil {
		return fmt.Errorf("ending_branch: invalid config: %w", err)
	}
	var trailing any
	if err := dec.Decode(&trailing); err != io.EOF {
		if err == nil {
			return fmt.Errorf("ending_branch: invalid config: unexpected trailing data")
		}
		return fmt.Errorf("ending_branch: invalid config: %w", err)
	}
	// D-26: apply default 0.5 when threshold is absent; validate range.
	if cfg.MultiVoteThreshold == nil {
		t := 0.5
		cfg.MultiVoteThreshold = &t
	} else if *cfg.MultiVoteThreshold < 0 || *cfg.MultiVoteThreshold > 1 {
		return fmt.Errorf("ending_branch: invalid config: multiVoteThreshold must be in [0, 1], got %v", *cfg.MultiVoteThreshold)
	}
	if err := validateConfig(cfg); err != nil {
		return fmt.Errorf("ending_branch: invalid config: %w", err)
	}
	m.cfg = cfg
	m.answers = nil
	m.result = nil
	return nil
}

// BuildState returns the all-player persistence/admin state. Runtime client sync
// must use BuildStateFor via engine.BuildModuleStateFor.
func (m *Module) BuildState() (json.RawMessage, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	return m.stateLocked(nil)
}

// BuildStateFor returns the ending state visible to one player.
func (m *Module) BuildStateFor(playerID uuid.UUID) (json.RawMessage, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	return m.stateLocked(&playerID)
}

// HandleMessage processes player answer submissions.
func (m *Module) HandleMessage(ctx context.Context, playerID uuid.UUID, msgType string, payload json.RawMessage) error {
	switch msgType {
	case "submit_answer", "ending_branch:submit_answer":
		return m.submitAnswer(ctx, playerID, payload)
	default:
		return fmt.Errorf("ending_branch: unsupported message type %q", msgType)
	}
}

// ReactTo handles phase actions that trigger ending evaluation.
func (m *Module) ReactTo(_ context.Context, action engine.PhaseActionPayload) error {
	if action.Action != engine.ActionEvaluateEnding {
		return nil
	}
	m.mu.Lock()
	result, err := m.evaluateLocked()
	if err != nil {
		m.mu.Unlock()
		return err
	}
	if evaluationResultsEqual(m.result, result) {
		m.mu.Unlock()
		return nil
	}
	m.result = result
	m.mu.Unlock()

	if m.deps.EventBus != nil {
		m.deps.EventBus.Publish(engine.Event{
			Type: "ending.evaluated",
			Payload: map[string]any{
				"selectedEnding":  result.SelectedEnding,
				"matchedPriority": result.MatchedPriority,
			},
		})
	}
	return nil
}

func evaluationResultsEqual(a, b *evaluationResult) bool {
	if a == nil || b == nil {
		return a == b
	}
	if a.SelectedEnding != b.SelectedEnding || !matchedPriorityEqual(a.MatchedPriority, b.MatchedPriority) {
		return false
	}
	if len(a.Scores) != len(b.Scores) {
		return false
	}
	for key, aScore := range a.Scores {
		if b.Scores[key] != aScore {
			return false
		}
	}
	return true
}

func matchedPriorityEqual(a, b *int) bool {
	if a == nil || b == nil {
		return a == b
	}
	return *a == *b
}

// SupportedActions lists the phase actions this module handles.
func (m *Module) SupportedActions() []engine.PhaseAction {
	return []engine.PhaseAction{engine.ActionEvaluateEnding}
}

// Cleanup releases resources when the session ends.
func (m *Module) Cleanup(_ context.Context) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.cfg = Config{}
	m.answers = nil
	m.result = nil
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
						"respondents": map[string]any{
							"description": "all or array of player IDs / character target codes",
						},
						"impact": map[string]any{"type": "string", "enum": []string{"branch", "score"}},
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
	return mustMarshal(schema)
}

func init() {
	engine.Register("ending_branch", func() engine.Module { return NewModule() })
}

// mustMarshal marshals v to JSON and panics on error.
// Schema() uses a literal map[string]any which cannot actually fail to marshal;
// this ensures a future contributor adding an unmarshalable value gets an
// immediate panic (caught by tests) rather than a silent empty schema.
func mustMarshal(v any) json.RawMessage {
	data, err := json.Marshal(v)
	if err != nil {
		panic("ending_branch: Schema() marshal failed: " + err.Error())
	}
	return data
}

// Compile-time interface assertions.
var (
	_ engine.Module            = (*Module)(nil)
	_ engine.ConfigSchema      = (*Module)(nil)
	_ engine.PlayerAwareModule = (*Module)(nil)
	_ engine.PhaseReactor      = (*Module)(nil)
)
