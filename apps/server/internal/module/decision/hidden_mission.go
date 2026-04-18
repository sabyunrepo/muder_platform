package decision

import (
	"context"
	"encoding/json"
	"fmt"
	"sync"

	"github.com/google/uuid"
	"github.com/mmp-platform/server/internal/engine"
)

func init() {
	engine.Register("hidden_mission", func() engine.Module { return NewHiddenMissionModule() })
}

// HiddenMissionConfig defines the settings for the hidden mission module.
type HiddenMissionConfig struct {
	VerificationMode string `json:"verificationMode"` // "auto"|"self_report"|"gm_verify", default "auto"
	ShowResultAt     string `json:"showResultAt"`     // default "ending"
	ScoreWinnerTitle string `json:"scoreWinnerTitle"` // default "MVP"
	AffectsScore     bool   `json:"affectsScore"`     // default true
}

// Mission represents a single hidden mission assigned to a player.
type Mission struct {
	ID           string `json:"id"`
	Type         string `json:"type"` // "hold_clue"|"vote_target"|"transfer_clue"|"survive"|"custom"
	Description  string `json:"description"`
	Points       int    `json:"points"`
	Verification string `json:"verification"` // "auto"|"self_report"|"gm_verify"
	TargetClueID string `json:"targetClueId,omitempty"`
	Completed    bool   `json:"completed"`
}

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

func (m *HiddenMissionModule) Name() string { return "hidden_mission" }

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

type missionReportPayload struct {
	MissionID string `json:"missionId"`
}

type missionVerifyPayload struct {
	PlayerID  uuid.UUID `json:"playerId"`
	MissionID string    `json:"missionId"`
	Completed bool      `json:"completed"`
}

func (m *HiddenMissionModule) HandleMessage(_ context.Context, playerID uuid.UUID, msgType string, payload json.RawMessage) error {
	switch msgType {
	case "mission:report":
		return m.handleReport(playerID, payload)
	case "mission:verify":
		return m.handleVerify(payload)
	case "mission:check":
		return m.handleCheck(playerID)
	default:
		return fmt.Errorf("hidden_mission: unknown message type %q", msgType)
	}
}

func (m *HiddenMissionModule) handleReport(playerID uuid.UUID, payload json.RawMessage) error {
	var p missionReportPayload
	if err := json.Unmarshal(payload, &p); err != nil {
		return fmt.Errorf("hidden_mission: invalid mission:report payload: %w", err)
	}

	m.mu.RLock()
	missions, ok := m.playerMissions[playerID]
	if !ok {
		m.mu.RUnlock()
		return fmt.Errorf("hidden_mission: player has no missions")
	}
	// Deep copy to avoid shared slice iteration outside lock.
	missionsCopy := make([]Mission, len(missions))
	copy(missionsCopy, missions)
	m.mu.RUnlock()

	found := false
	for _, mission := range missionsCopy {
		if mission.ID == p.MissionID {
			found = true
			if mission.Verification != "self_report" && mission.Verification != "gm_verify" {
				return fmt.Errorf("hidden_mission: mission %q does not support manual reporting", p.MissionID)
			}
			break
		}
	}
	if !found {
		return fmt.Errorf("hidden_mission: mission %q not found", p.MissionID)
	}

	m.deps.EventBus.Publish(engine.Event{
		Type: "mission.reported",
		Payload: map[string]any{
			"playerId":  playerID.String(),
			"missionId": p.MissionID,
		},
	})
	return nil
}

func (m *HiddenMissionModule) handleVerify(payload json.RawMessage) error {
	var p missionVerifyPayload
	if err := json.Unmarshal(payload, &p); err != nil {
		return fmt.Errorf("hidden_mission: invalid mission:verify payload: %w", err)
	}

	if p.Completed {
		m.completeMission(p.PlayerID, p.MissionID)
	}

	m.deps.EventBus.Publish(engine.Event{
		Type: "mission.verified",
		Payload: map[string]any{
			"playerId":  p.PlayerID.String(),
			"missionId": p.MissionID,
			"completed": p.Completed,
		},
	})
	return nil
}

func (m *HiddenMissionModule) handleCheck(playerID uuid.UUID) error {
	m.mu.RLock()
	orig := m.playerMissions[playerID]
	missionsCopy := make([]Mission, len(orig))
	copy(missionsCopy, orig)
	m.mu.RUnlock()

	// Publish player's own mission status (response sent via event).
	m.deps.EventBus.Publish(engine.Event{
		Type: "mission.status",
		Payload: map[string]any{
			"playerId": playerID.String(),
			"missions": missionsCopy,
		},
	})
	return nil
}

// completeMission marks a mission complete and updates the score.
func (m *HiddenMissionModule) completeMission(playerID uuid.UUID, missionID string) {
	m.mu.Lock()
	defer m.mu.Unlock()

	// Check if already completed.
	for _, mid := range m.completedMissions[playerID] {
		if mid == missionID {
			return
		}
	}

	missions := m.playerMissions[playerID]
	for i, mission := range missions {
		if mission.ID == missionID && !mission.Completed {
			m.playerMissions[playerID][i].Completed = true
			m.completedMissions[playerID] = append(m.completedMissions[playerID], missionID)
			if m.config.AffectsScore {
				m.scores[playerID] += mission.Points
			}
			return
		}
	}
}

// --- EventBus handlers for auto-verification ---

func (m *HiddenMissionModule) onClueAcquired(event engine.Event) {
	payload, ok := event.Payload.(map[string]any)
	if !ok {
		return
	}
	pidStr, _ := payload["playerId"].(string)
	clueID, _ := payload["clueId"].(string)
	pid, err := uuid.Parse(pidStr)
	if err != nil {
		return
	}

	m.mu.RLock()
	orig := m.playerMissions[pid]
	missionsCopy := make([]Mission, len(orig))
	copy(missionsCopy, orig)
	m.mu.RUnlock()

	for _, mission := range missionsCopy {
		if mission.Type == "hold_clue" && mission.TargetClueID == clueID && !mission.Completed {
			m.completeMission(pid, mission.ID)
		}
	}
}

func (m *HiddenMissionModule) onVoteCast(event engine.Event) {
	payload, ok := event.Payload.(map[string]any)
	if !ok {
		return
	}
	pidStr, _ := payload["playerId"].(string)
	targetCode, _ := payload["targetCode"].(string)
	pid, err := uuid.Parse(pidStr)
	if err != nil {
		return
	}

	m.mu.RLock()
	orig := m.playerMissions[pid]
	missionsCopy := make([]Mission, len(orig))
	copy(missionsCopy, orig)
	m.mu.RUnlock()

	for _, mission := range missionsCopy {
		if mission.Type == "vote_target" && mission.TargetClueID == targetCode && !mission.Completed {
			m.completeMission(pid, mission.ID)
		}
	}
}

func (m *HiddenMissionModule) onClueTransferred(event engine.Event) {
	payload, ok := event.Payload.(map[string]any)
	if !ok {
		return
	}
	pidStr, _ := payload["fromPlayerId"].(string)
	pid, err := uuid.Parse(pidStr)
	if err != nil {
		return
	}

	m.mu.RLock()
	orig := m.playerMissions[pid]
	missionsCopy := make([]Mission, len(orig))
	copy(missionsCopy, orig)
	m.mu.RUnlock()

	for _, mission := range missionsCopy {
		if mission.Type == "transfer_clue" && !mission.Completed {
			m.completeMission(pid, mission.ID)
		}
	}
}

// --- ConfigSchema ---

func (m *HiddenMissionModule) Schema() json.RawMessage {
	schema := map[string]any{
		"type": "object",
		"properties": map[string]any{
			"verificationMode": map[string]any{"type": "string", "enum": []string{"auto", "self_report", "gm_verify"}, "default": "auto"},
			"showResultAt":     map[string]any{"type": "string", "default": "ending"},
			"scoreWinnerTitle": map[string]any{"type": "string", "default": "MVP"},
			"affectsScore":     map[string]any{"type": "boolean", "default": true},
			"playerMissions":   map[string]any{"type": "object", "description": "Map of playerID to mission arrays"},
		},
		"additionalProperties": false,
	}
	data, _ := json.Marshal(schema)
	return data
}

type hiddenMissionState struct {
	Scores         map[uuid.UUID]int       `json:"scores,omitempty"`
	PlayerMissions map[uuid.UUID][]Mission `json:"playerMissions,omitempty"`
	Config         HiddenMissionConfig     `json:"config"`
}

func (m *HiddenMissionModule) BuildState() (json.RawMessage, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	state := hiddenMissionState{
		Config: m.config,
	}

	// Scores are only visible at ending.
	if m.config.ShowResultAt == "ending" {
		state.Scores = m.scores
	}

	// Player missions are always included (filtered per-player by upstream).
	state.PlayerMissions = m.playerMissions

	return json.Marshal(state)
}

// BuildStateFor implements engine.PlayerAwareModule — redacts other players'
// missions (only the caller's own missions are ever disclosed). Scores remain
// hidden until ShowResultAt == "ending", mirroring BuildState().
func (m *HiddenMissionModule) BuildStateFor(playerID uuid.UUID) (json.RawMessage, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	state := hiddenMissionState{
		Config: m.config,
	}

	if m.config.ShowResultAt == "ending" {
		state.Scores = m.scores
	}

	if own, ok := m.playerMissions[playerID]; ok && len(own) > 0 {
		state.PlayerMissions = map[uuid.UUID][]Mission{playerID: own}
	}

	return json.Marshal(state)
}

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

// --- SerializableModule ---

type hiddenMissionSavedState struct {
	Config            HiddenMissionConfig  `json:"config"`
	PlayerMissions    map[string][]Mission `json:"playerMissions"`
	CompletedMissions map[string][]string  `json:"completedMissions"`
	Scores            map[string]int       `json:"scores"`
}

func (m *HiddenMissionModule) SaveState(_ context.Context) (engine.GameState, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	pm := make(map[string][]Mission, len(m.playerMissions))
	for pid, missions := range m.playerMissions {
		pm[pid.String()] = missions
	}
	cm := make(map[string][]string, len(m.completedMissions))
	for pid, ids := range m.completedMissions {
		cm[pid.String()] = ids
	}
	sc := make(map[string]int, len(m.scores))
	for pid, score := range m.scores {
		sc[pid.String()] = score
	}

	data, err := json.Marshal(hiddenMissionSavedState{
		Config:            m.config,
		PlayerMissions:    pm,
		CompletedMissions: cm,
		Scores:            sc,
	})
	if err != nil {
		return engine.GameState{}, fmt.Errorf("hidden_mission: save state: %w", err)
	}
	return engine.GameState{Modules: map[string]json.RawMessage{m.Name(): data}}, nil
}

func (m *HiddenMissionModule) RestoreState(_ context.Context, _ uuid.UUID, state engine.GameState) error {
	raw, ok := state.Modules[m.Name()]
	if !ok {
		return nil
	}
	var s hiddenMissionSavedState
	if err := json.Unmarshal(raw, &s); err != nil {
		return fmt.Errorf("hidden_mission: restore state: %w", err)
	}

	pm := make(map[uuid.UUID][]Mission, len(s.PlayerMissions))
	for pidStr, missions := range s.PlayerMissions {
		pid, err := uuid.Parse(pidStr)
		if err != nil {
			continue
		}
		pm[pid] = missions
	}
	cm := make(map[uuid.UUID][]string, len(s.CompletedMissions))
	for pidStr, ids := range s.CompletedMissions {
		pid, err := uuid.Parse(pidStr)
		if err != nil {
			continue
		}
		cm[pid] = ids
	}
	sc := make(map[uuid.UUID]int, len(s.Scores))
	for pidStr, score := range s.Scores {
		pid, err := uuid.Parse(pidStr)
		if err != nil {
			continue
		}
		sc[pid] = score
	}

	m.mu.Lock()
	defer m.mu.Unlock()
	m.config = s.Config
	m.playerMissions = pm
	m.completedMissions = cm
	m.scores = sc
	return nil
}

// --- WinChecker ---

func (m *HiddenMissionModule) CheckWin(_ context.Context, state engine.GameState) (engine.WinResult, error) {
	raw, ok := state.Modules[m.Name()]
	if !ok {
		return engine.WinResult{Won: false}, nil
	}

	var s hiddenMissionState
	if err := json.Unmarshal(raw, &s); err != nil {
		return engine.WinResult{}, fmt.Errorf("hidden_mission: check win: %w", err)
	}

	// Find the player with the highest score (MVP).
	if len(s.Scores) == 0 {
		return engine.WinResult{Won: false}, nil
	}

	var mvpID uuid.UUID
	maxScore := 0
	for pid, score := range s.Scores {
		if score > maxScore {
			maxScore = score
			mvpID = pid
		}
	}

	if maxScore == 0 {
		return engine.WinResult{Won: false}, nil
	}

	m.mu.RLock()
	title := m.config.ScoreWinnerTitle
	m.mu.RUnlock()

	return engine.WinResult{
		Won:       true,
		WinnerIDs: []uuid.UUID{mvpID},
		Reason:    fmt.Sprintf("hidden_mission: %s awarded with %d points", title, maxScore),
	}, nil
}

// --- RuleProvider ---

func (m *HiddenMissionModule) GetRules() []engine.Rule {
	return []engine.Rule{
		{
			ID:          "mission.hold_clue",
			Description: "Player holds a specific clue to complete mission",
			Logic:       json.RawMessage(`{"in":[{"var":"targetClueId"},{"var":"player.clueIds"}]}`),
		},
		{
			ID:          "mission.vote_target",
			Description: "Player votes for a specific target to complete mission",
			Logic:       json.RawMessage(`{"==":[{"var":"player.lastVote"},{"var":"targetCode"}]}`),
		},
		{
			ID:          "mission.transfer_clue",
			Description: "Player transfers any clue to complete mission",
			Logic:       json.RawMessage(`{">":[{"var":"player.transferCount"},0]}`),
		},
	}
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
