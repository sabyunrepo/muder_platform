// Package hidden_mission implements per-player hidden missions with scoring
// and auto-verification against downstream engine events (clue acquisition,
// vote cast, clue transfer).
package hidden_mission

import (
	"context"
	"encoding/json"
	"fmt"
	"sync"

	"github.com/google/uuid"
	"github.com/mmp-platform/server/internal/engine"
)

// HiddenMissionModule manages per-player hidden missions and scoring.
type HiddenMissionModule struct {
	mu                sync.RWMutex
	deps              engine.ModuleDeps
	config            HiddenMissionConfig
	playerMissions    map[uuid.UUID][]Mission
	completedMissions map[uuid.UUID][]string // playerID → completed mission IDs
	scores            map[uuid.UUID]int
	subscriptionIDs   []int
}

// NewHiddenMissionModule creates a new HiddenMissionModule instance.
func NewHiddenMissionModule() *HiddenMissionModule {
	return &HiddenMissionModule{}
}

// Name returns the module identifier.
func (m *HiddenMissionModule) Name() string { return "hidden_mission" }

// Init initialises the module with session context and configuration.
func (m *HiddenMissionModule) Init(_ context.Context, deps engine.ModuleDeps, config json.RawMessage) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	m.deps = deps
	m.playerMissions = make(map[uuid.UUID][]Mission)
	m.completedMissions = make(map[uuid.UUID][]string)
	m.scores = make(map[uuid.UUID]int)

	// Apply defaults.
	m.config = HiddenMissionConfig{
		VerificationMode: "auto",
		ShowResultAt:     "ending",
		ScoreWinnerTitle: "MVP",
		AffectsScore:     true,
	}

	if config != nil && len(config) > 0 {
		var cfg HiddenMissionConfig
		if err := json.Unmarshal(config, &cfg); err != nil {
			return fmt.Errorf("hidden_mission: invalid config: %w", err)
		}
		if cfg.VerificationMode != "" {
			m.config.VerificationMode = cfg.VerificationMode
		}
		if cfg.ShowResultAt != "" {
			m.config.ShowResultAt = cfg.ShowResultAt
		}
		if cfg.ScoreWinnerTitle != "" {
			m.config.ScoreWinnerTitle = cfg.ScoreWinnerTitle
		}
		// AffectsScore: only override if explicitly present in JSON.
		// We detect presence by re-checking the raw JSON for the key.
		var rawMap map[string]json.RawMessage
		if err := json.Unmarshal(config, &rawMap); err == nil {
			if _, exists := rawMap["affectsScore"]; exists {
				m.config.AffectsScore = cfg.AffectsScore
			}
		}

		// Parse player missions from config if provided.
		var missionCfg struct {
			PlayerMissions map[string][]Mission `json:"playerMissions"`
		}
		if err := json.Unmarshal(config, &missionCfg); err == nil && missionCfg.PlayerMissions != nil {
			for pidStr, missions := range missionCfg.PlayerMissions {
				pid, err := uuid.Parse(pidStr)
				if err != nil {
					continue
				}
				m.playerMissions[pid] = missions
			}
		}
	}

	// Subscribe to events for auto-verification.
	m.subscriptionIDs = nil
	m.subscriptionIDs = append(m.subscriptionIDs,
		deps.EventBus.Subscribe("clue.acquired", m.onClueAcquired))
	m.subscriptionIDs = append(m.subscriptionIDs,
		deps.EventBus.Subscribe("vote.cast", m.onVoteCast))
	m.subscriptionIDs = append(m.subscriptionIDs,
		deps.EventBus.Subscribe("clue.transferred", m.onClueTransferred))

	return nil
}

// Cleanup releases resources when the session ends.
func (m *HiddenMissionModule) Cleanup(_ context.Context) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	// Unsubscribe from event bus.
	for _, subID := range m.subscriptionIDs {
		m.deps.EventBus.Unsubscribe(subID)
	}
	m.subscriptionIDs = nil
	m.playerMissions = nil
	m.completedMissions = nil
	m.scores = nil
	return nil
}

// Compile-time interface checks.
var (
	_ engine.Module             = (*HiddenMissionModule)(nil)
	_ engine.ConfigSchema       = (*HiddenMissionModule)(nil)
	_ engine.SerializableModule = (*HiddenMissionModule)(nil)
	_ engine.WinChecker         = (*HiddenMissionModule)(nil)
	_ engine.RuleProvider       = (*HiddenMissionModule)(nil)
	_ engine.PlayerAwareModule  = (*HiddenMissionModule)(nil)
)

func init() {
	engine.Register("hidden_mission", func() engine.Module { return NewHiddenMissionModule() })
}
