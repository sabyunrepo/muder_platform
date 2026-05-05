package media

import (
	"context"
	"encoding/json"
	"fmt"
	"sync"

	"github.com/google/uuid"

	"github.com/mmp-platform/server/internal/engine"
)

func init() {
	engine.Register("presentation", func() engine.Module { return NewPresentationModule() })
}

// PresentationModule reacts to visual presentation PhaseActions.
//
// The state is public: background and color-theme cues are intentionally shared
// by every player in a session.
type PresentationModule struct {
	engine.PublicStateMarker

	mu                sync.RWMutex
	deps              engine.ModuleDeps
	backgroundMediaID string
	themeToken        string
}

func NewPresentationModule() *PresentationModule {
	return &PresentationModule{}
}

func (m *PresentationModule) Name() string { return "presentation" }

func (m *PresentationModule) Init(_ context.Context, deps engine.ModuleDeps, _ json.RawMessage) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.deps = deps
	return nil
}

func (m *PresentationModule) BuildState() (json.RawMessage, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	return json.Marshal(map[string]any{
		"backgroundMediaId": m.backgroundMediaID,
		"themeToken":        m.themeToken,
	})
}

func (m *PresentationModule) HandleMessage(_ context.Context, _ uuid.UUID, _ string, _ json.RawMessage) error {
	return fmt.Errorf("presentation: no direct messages supported")
}

func (m *PresentationModule) Cleanup(_ context.Context) error {
	return nil
}

func (m *PresentationModule) SupportedActions() []engine.PhaseAction {
	return []engine.PhaseAction{
		engine.ActionSetBackground,
		engine.ActionSetThemeColor,
	}
}

func (m *PresentationModule) ReactTo(ctx context.Context, action engine.PhaseActionPayload) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	eventType := ""
	switch action.Action {
	case engine.ActionSetBackground:
		eventType = "presentation.set_background"
		var p struct {
			MediaID string `json:"mediaId"`
		}
		if len(action.Params) > 0 {
			if err := json.Unmarshal(action.Params, &p); err != nil {
				return fmt.Errorf("presentation: invalid SET_BACKGROUND params: %w", err)
			}
		}
		mediaID, err := uuid.Parse(p.MediaID)
		if err != nil {
			return fmt.Errorf("presentation: SET_BACKGROUND requires mediaId")
		}
		if m.deps.MediaResolver == nil {
			return fmt.Errorf("presentation: media resolver is not configured")
		}
		m.backgroundMediaID = p.MediaID
		url, sourceType, err := m.deps.MediaResolver.ResolveMediaURL(ctx, m.deps.SessionID, mediaID, "IMAGE")
		if err != nil {
			return fmt.Errorf("presentation: resolve background media: %w", err)
		}
		params, _ := json.Marshal(map[string]any{
			"mediaId":    p.MediaID,
			"sourceType": sourceType,
			"url":        url,
		})
		action.Params = params
	case engine.ActionSetThemeColor:
		eventType = "presentation.set_theme_color"
		var p struct {
			ThemeToken string `json:"themeToken"`
		}
		if len(action.Params) > 0 {
			if err := json.Unmarshal(action.Params, &p); err != nil {
				return fmt.Errorf("presentation: invalid SET_THEME_COLOR params: %w", err)
			}
		}
		if p.ThemeToken == "" {
			return fmt.Errorf("presentation: SET_THEME_COLOR requires themeToken")
		}
		m.themeToken = p.ThemeToken
	default:
		return fmt.Errorf("presentation: unsupported action %q", action.Action)
	}

	m.deps.EventBus.Publish(engine.Event{
		Type:    eventType,
		Payload: json.RawMessage(action.Params),
	})
	return nil
}

var (
	_ engine.Module            = (*PresentationModule)(nil)
	_ engine.PublicStateModule = (*PresentationModule)(nil)
	_ engine.PhaseReactor      = (*PresentationModule)(nil)
)
