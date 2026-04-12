// Package media provides audio/media playback modules.
//
// AudioModule is a PhaseReactor that translates audio-related PhaseActions
// (PLAY_SOUND, PLAY_MEDIA, SET_BGM, STOP_AUDIO) into EventBus events that
// the WebSocket layer can broadcast to clients.
//
// It also subscribes to ReadingModule events:
//   - reading.line_changed → audio.play_voice (auto voice playback per line)
//   - reading.completed    → audio.set_bgm   (restore phase BGM after reading)
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
	engine.Register("audio", func() engine.Module { return NewAudioModule() })
}

// AudioModule reacts to audio PhaseActions and bridges reading events to audio events.
type AudioModule struct {
	mu           sync.RWMutex
	deps         engine.ModuleDeps
	currentBGMId string
	phaseBGMId   string // base BGM for the current phase (used to restore after reading override)
	subIDs       []int
}

// NewAudioModule creates a new AudioModule instance (per session).
func NewAudioModule() *AudioModule {
	return &AudioModule{}
}

func (m *AudioModule) Name() string { return "audio" }

func (m *AudioModule) Init(_ context.Context, deps engine.ModuleDeps, _ json.RawMessage) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	m.deps = deps

	// reading.line_changed → emit audio.play_voice if a voiceId is present.
	lineSub := deps.EventBus.Subscribe("reading.line_changed", func(e engine.Event) {
		payload, ok := e.Payload.(map[string]any)
		if !ok {
			return
		}
		voiceID, _ := payload["voiceId"].(string)
		if voiceID == "" {
			return
		}
		deps.EventBus.Publish(engine.Event{
			Type:    "audio.play_voice",
			Payload: map[string]any{"voiceId": voiceID},
		})
	})

	// reading.completed → restore the phase BGM (best-effort; no-op if unset).
	completedSub := deps.EventBus.Subscribe("reading.completed", func(_ engine.Event) {
		m.mu.RLock()
		restoreBGM := m.phaseBGMId
		m.mu.RUnlock()
		if restoreBGM == "" {
			return
		}
		deps.EventBus.Publish(engine.Event{
			Type:    "audio.set_bgm",
			Payload: map[string]any{"mediaId": restoreBGM, "fadeMs": 1500},
		})
	})

	m.subIDs = append(m.subIDs, lineSub, completedSub)
	return nil
}

func (m *AudioModule) BuildState() (json.RawMessage, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	state := map[string]any{
		"currentBGMId": m.currentBGMId,
		"phaseBGMId":   m.phaseBGMId,
	}
	return json.Marshal(state)
}

// HandleMessage is unused: AudioModule is driven entirely by PhaseActions and EventBus.
func (m *AudioModule) HandleMessage(_ context.Context, _ uuid.UUID, _ string, _ json.RawMessage) error {
	return fmt.Errorf("audio: no direct messages supported")
}

func (m *AudioModule) Cleanup(_ context.Context) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	if m.deps.EventBus != nil {
		for _, id := range m.subIDs {
			m.deps.EventBus.Unsubscribe(id)
		}
	}
	m.subIDs = nil
	return nil
}

// SupportedActions declares the PhaseActions this module reacts to.
func (m *AudioModule) SupportedActions() []engine.PhaseAction {
	return []engine.PhaseAction{
		engine.ActionPlaySound,
		engine.ActionPlayMedia,
		engine.ActionSetBGM,
		engine.ActionStopAudio,
	}
}

// ReactTo translates an audio PhaseAction into an EventBus event.
//
// SET_BGM updates both currentBGMId and phaseBGMId. ReadingModule overrides
// during a reading section should publish audio.set_bgm on the EventBus
// directly (not via PhaseAction) so phaseBGMId stays pinned to the phase BGM
// and can be restored on reading.completed.
func (m *AudioModule) ReactTo(_ context.Context, action engine.PhaseActionPayload) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	var eventType string
	switch action.Action {
	case engine.ActionPlaySound:
		eventType = "audio.play_sound"
	case engine.ActionPlayMedia:
		eventType = "audio.play_media"
	case engine.ActionSetBGM:
		eventType = "audio.set_bgm"
		var p struct {
			MediaID string `json:"mediaId"`
		}
		if len(action.Params) > 0 {
			_ = json.Unmarshal(action.Params, &p)
		}
		m.currentBGMId = p.MediaID
		m.phaseBGMId = p.MediaID
	case engine.ActionStopAudio:
		eventType = "audio.stop"
	default:
		return fmt.Errorf("audio: unsupported action %q", action.Action)
	}

	m.deps.EventBus.Publish(engine.Event{
		Type:    eventType,
		Payload: json.RawMessage(action.Params),
	})
	return nil
}

// --- PhaseHookModule ---

func (m *AudioModule) OnPhaseEnter(_ context.Context, _ engine.Phase) error {
	return nil
}

func (m *AudioModule) OnPhaseExit(_ context.Context, _ engine.Phase) error {
	return nil
}

// --- GameEventHandler ---

func (m *AudioModule) Validate(_ context.Context, event engine.GameEvent, _ engine.GameState) error {
	switch event.Type {
	case "audio:play", "audio:stop", "audio:pause", "audio:resume":
		return nil
	default:
		return fmt.Errorf("audio: unsupported event type %q", event.Type)
	}
}

func (m *AudioModule) Apply(_ context.Context, _ engine.GameEvent, state *engine.GameState) error {
	data, err := m.BuildState()
	if err != nil {
		return fmt.Errorf("audio: apply: %w", err)
	}
	if state.Modules == nil {
		state.Modules = make(map[string]json.RawMessage)
	}
	state.Modules[m.Name()] = data
	return nil
}

// Compile-time interface checks.
var (
	_ engine.Module           = (*AudioModule)(nil)
	_ engine.PhaseReactor     = (*AudioModule)(nil)
	_ engine.PhaseHookModule  = (*AudioModule)(nil)
	_ engine.GameEventHandler = (*AudioModule)(nil)
)
