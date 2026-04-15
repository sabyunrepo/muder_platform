package decision

import (
	"context"
	"encoding/json"
	"fmt"
	"sync"
	"time"

	"github.com/google/uuid"
	"github.com/mmp-platform/server/internal/engine"
)

func init() {
	engine.Register("accusation", func() engine.Module { return NewAccusationModule() })
}

// AccusationConfig defines the settings for the accusation module.
type AccusationConfig struct {
	MaxPerRound     int  `json:"maxPerRound"`     // default 1
	DefenseTime     int  `json:"defenseTime"`     // seconds, default 60
	VoteThreshold   int  `json:"voteThreshold"`   // %, default 50
	AllowSelfAccuse bool `json:"allowSelfAccuse"` // default false
	DeadCanAccuse   bool `json:"deadCanAccuse"`   // default false
}

// Accusation represents an active accusation.
type Accusation struct {
	AccuserID       uuid.UUID          `json:"accuserId"`
	AccusedID       uuid.UUID          `json:"accusedId"`
	AccusedCode     string             `json:"accusedCode"`
	DefenseDeadline time.Time          `json:"defenseDeadline"`
	Votes           map[uuid.UUID]bool `json:"votes"`          // true=guilty, false=innocent
	EligibleVoters  int                `json:"eligibleVoters"` // total players minus accuser and accused
}

// AccusationModule handles player accusation mechanics.
type AccusationModule struct {
	mu                sync.RWMutex
	deps              engine.ModuleDeps
	config            AccusationConfig
	activeAccusation  *Accusation
	accusationCount   int
	isActive          bool
	expelledCode      string // code of most recently expelled player
	expelledIsCulprit bool   // true when expelled player was the actual culprit

	// timeNow is injectable for testing.
	timeNow func() time.Time
}

// NewAccusationModule creates a new AccusationModule instance.
func NewAccusationModule() *AccusationModule {
	return &AccusationModule{
		timeNow: time.Now,
	}
}

func (m *AccusationModule) Name() string { return "accusation" }

func (m *AccusationModule) Init(_ context.Context, deps engine.ModuleDeps, config json.RawMessage) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	m.deps = deps

	// Apply defaults.
	m.config = AccusationConfig{
		MaxPerRound:     1,
		DefenseTime:     60,
		VoteThreshold:   50,
		AllowSelfAccuse: false,
		DeadCanAccuse:   false,
	}

	if config != nil && len(config) > 0 {
		var cfg AccusationConfig
		if err := json.Unmarshal(config, &cfg); err != nil {
			return fmt.Errorf("accusation: invalid config: %w", err)
		}
		if cfg.MaxPerRound > 0 {
			m.config.MaxPerRound = cfg.MaxPerRound
		}
		if cfg.DefenseTime > 0 {
			m.config.DefenseTime = cfg.DefenseTime
		}
		if cfg.VoteThreshold > 0 {
			m.config.VoteThreshold = cfg.VoteThreshold
		}
		m.config.AllowSelfAccuse = cfg.AllowSelfAccuse
		m.config.DeadCanAccuse = cfg.DeadCanAccuse
	}

	m.activeAccusation = nil
	m.accusationCount = 0
	m.isActive = false
	return nil
}

type accusePayload struct {
	TargetCode string    `json:"targetCode"`
	TargetID   uuid.UUID `json:"targetId"`
}

type accusationVotePayload struct {
	Guilty bool `json:"guilty"`
}

func (m *AccusationModule) HandleMessage(_ context.Context, playerID uuid.UUID, msgType string, payload json.RawMessage) error {
	switch msgType {
	case "accusation:accuse":
		return m.handleAccuse(playerID, payload)
	case "accusation:vote":
		return m.handleAccusationVote(playerID, payload)
	case "accusation:reset":
		return m.handleReset()
	default:
		return fmt.Errorf("accusation: unknown message type %q", msgType)
	}
}

func (m *AccusationModule) handleAccuse(playerID uuid.UUID, payload json.RawMessage) error {
	var p accusePayload
	if err := json.Unmarshal(payload, &p); err != nil {
		return fmt.Errorf("accusation: invalid accusation:accuse payload: %w", err)
	}
	if p.TargetCode == "" {
		return fmt.Errorf("accusation: targetCode is required")
	}

	m.mu.Lock()
	if m.activeAccusation != nil {
		m.mu.Unlock()
		return fmt.Errorf("accusation: an accusation is already active")
	}
	if m.accusationCount >= m.config.MaxPerRound {
		m.mu.Unlock()
		return fmt.Errorf("accusation: max accusations per round (%d) reached", m.config.MaxPerRound)
	}

	deadline := m.timeNow().Add(time.Duration(m.config.DefenseTime) * time.Second)
	m.activeAccusation = &Accusation{
		AccuserID:       playerID,
		AccusedID:       p.TargetID,
		AccusedCode:     p.TargetCode,
		DefenseDeadline: deadline,
		Votes:           make(map[uuid.UUID]bool),
	}
	m.accusationCount++
	m.isActive = true
	m.mu.Unlock()

	m.deps.EventBus.Publish(engine.Event{
		Type: "accusation.started",
		Payload: map[string]any{
			"accuserId":       playerID.String(),
			"accusedCode":     p.TargetCode,
			"defenseDeadline": deadline.Unix(),
		},
	})
	return nil
}

func (m *AccusationModule) handleAccusationVote(playerID uuid.UUID, payload json.RawMessage) error {
	var p accusationVotePayload
	if err := json.Unmarshal(payload, &p); err != nil {
		return fmt.Errorf("accusation: invalid accusation:vote payload: %w", err)
	}

	m.mu.Lock()
	if m.activeAccusation == nil {
		m.mu.Unlock()
		return fmt.Errorf("accusation: no active accusation")
	}

	// Cannot vote on your own accusation (as accuser).
	if playerID == m.activeAccusation.AccuserID {
		m.mu.Unlock()
		return fmt.Errorf("accusation: accuser cannot vote")
	}

	// Accused cannot vote on their own accusation.
	if playerID == m.activeAccusation.AccusedID {
		m.mu.Unlock()
		return fmt.Errorf("accusation: accused cannot vote on own accusation")
	}

	m.activeAccusation.Votes[playerID] = p.Guilty

	// Determine eligible voter count (all players minus accuser and accused).
	// EligibleVoters is set during accusation creation; if not available, we
	// cannot resolve on quorum — only resolve when mathematically determined.
	totalVotes := len(m.activeAccusation.Votes)
	guiltyCount := 0
	innocentCount := 0
	for _, guilty := range m.activeAccusation.Votes {
		if guilty {
			guiltyCount++
		} else {
			innocentCount++
		}
	}

	eligibleVoters := m.activeAccusation.EligibleVoters
	allVoted := eligibleVoters > 0 && totalVotes >= eligibleVoters

	// Check if the result is mathematically determined:
	// - Guilty wins if guiltyPct >= threshold even if remaining all vote innocent.
	// - Innocent wins if guilty can't reach threshold even if remaining all vote guilty.
	remaining := 0
	if eligibleVoters > totalVotes {
		remaining = eligibleVoters - totalVotes
	}
	mathGuilty := false
	mathInnocent := false
	if eligibleVoters > 0 {
		// If guilty already meets threshold with all voters accounted for.
		guiltyPctNow := (guiltyCount * 100) / eligibleVoters
		maxGuiltyPct := ((guiltyCount + remaining) * 100) / eligibleVoters
		mathGuilty = guiltyPctNow >= m.config.VoteThreshold
		mathInnocent = maxGuiltyPct < m.config.VoteThreshold
	}

	shouldResolve := allVoted || mathGuilty || mathInnocent
	if !shouldResolve {
		// Not enough votes yet to determine outcome.
		m.mu.Unlock()
		return nil
	}

	// Calculate final guilty percentage among all eligible voters.
	guiltyPct := 0
	if eligibleVoters > 0 {
		guiltyPct = (guiltyCount * 100) / eligibleVoters
	} else if totalVotes > 0 {
		// Fallback if eligibleVoters not set: use totalVotes (legacy behavior).
		guiltyPct = (guiltyCount * 100) / totalVotes
	}
	expelled := guiltyPct >= m.config.VoteThreshold

	accusedCode := m.activeAccusation.AccusedCode
	m.activeAccusation = nil
	m.isActive = false
	if expelled {
		m.expelledCode = accusedCode
		// expelledIsCulprit is determined externally (e.g. via engine cross-check).
		// For now, flag it false; CheckWin reads it from state when set externally.
		m.expelledIsCulprit = false
	}
	m.mu.Unlock()

	m.deps.EventBus.Publish(engine.Event{
		Type: "accusation.resolved",
		Payload: map[string]any{
			"accusedCode": accusedCode,
			"expelled":    expelled,
			"guiltyVotes": guiltyCount,
			"totalVotes":  totalVotes,
		},
	})
	return nil
}

// handleReset resets the accusation count for a new round.
func (m *AccusationModule) handleReset() error {
	m.mu.Lock()
	defer m.mu.Unlock()

	m.accusationCount = 0
	m.activeAccusation = nil
	m.isActive = false
	m.expelledCode = ""
	m.expelledIsCulprit = false
	return nil
}

// --- ConfigSchema ---

func (m *AccusationModule) Schema() json.RawMessage {
	schema := map[string]any{
		"type": "object",
		"properties": map[string]any{
			"maxPerRound":     map[string]any{"type": "integer", "default": 1, "minimum": 1},
			"defenseTime":     map[string]any{"type": "integer", "default": 60, "minimum": 10, "description": "Defense time in seconds"},
			"voteThreshold":   map[string]any{"type": "integer", "default": 50, "minimum": 1, "maximum": 100, "description": "Guilty vote % to expel"},
			"allowSelfAccuse": map[string]any{"type": "boolean", "default": false},
			"deadCanAccuse":   map[string]any{"type": "boolean", "default": false},
		},
		"additionalProperties": false,
	}
	data, _ := json.Marshal(schema)
	return data
}

type accusationState struct {
	ActiveAccusation  *Accusation      `json:"activeAccusation"`
	AccusationCount   int              `json:"accusationCount"`
	IsActive          bool             `json:"isActive"`
	Config            AccusationConfig `json:"config"`
	ExpelledCode      string           `json:"expelledCode,omitempty"`
	ExpelledIsCulprit bool             `json:"expelledIsCulprit,omitempty"`
}

func (m *AccusationModule) BuildState() (json.RawMessage, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	return json.Marshal(accusationState{
		ActiveAccusation:  m.activeAccusation,
		AccusationCount:   m.accusationCount,
		IsActive:          m.isActive,
		Config:            m.config,
		ExpelledCode:      m.expelledCode,
		ExpelledIsCulprit: m.expelledIsCulprit,
	})
}

func (m *AccusationModule) Cleanup(_ context.Context) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	m.activeAccusation = nil
	m.isActive = false
	m.expelledCode = ""
	m.expelledIsCulprit = false
	return nil
}

// --- GameEventHandler ---

type accuseEventPayload struct {
	PlayerID   string `json:"playerId"`
	TargetCode string `json:"targetCode"`
	TargetID   string `json:"targetId,omitempty"`
	Guilty     *bool  `json:"guilty,omitempty"` // for accusation:vote events
}

func (m *AccusationModule) Validate(_ context.Context, event engine.GameEvent, _ engine.GameState) error {
	switch event.Type {
	case "accusation:accuse":
		var p accuseEventPayload
		if err := json.Unmarshal(event.Payload, &p); err != nil {
			return fmt.Errorf("accusation: invalid event payload: %w", err)
		}
		if p.PlayerID == "" {
			return fmt.Errorf("accusation: playerId is required")
		}
		if p.TargetCode == "" {
			return fmt.Errorf("accusation: targetCode is required")
		}
		m.mu.RLock()
		hasActive := m.activeAccusation != nil
		countReached := m.accusationCount >= m.config.MaxPerRound
		m.mu.RUnlock()
		if hasActive {
			return fmt.Errorf("accusation: an accusation is already active")
		}
		if countReached {
			return fmt.Errorf("accusation: max accusations per round (%d) reached", m.config.MaxPerRound)
		}
		return nil

	case "accusation:vote":
		var p accuseEventPayload
		if err := json.Unmarshal(event.Payload, &p); err != nil {
			return fmt.Errorf("accusation: invalid event payload: %w", err)
		}
		if p.PlayerID == "" {
			return fmt.Errorf("accusation: playerId is required")
		}
		m.mu.RLock()
		acc := m.activeAccusation
		m.mu.RUnlock()
		if acc == nil {
			return fmt.Errorf("accusation: no active accusation")
		}
		playerID, err := uuid.Parse(p.PlayerID)
		if err != nil {
			return fmt.Errorf("accusation: invalid playerId: %w", err)
		}
		if playerID == acc.AccuserID {
			return fmt.Errorf("accusation: accuser cannot vote")
		}
		if playerID == acc.AccusedID {
			return fmt.Errorf("accusation: accused cannot vote on own accusation")
		}
		return nil

	default:
		return fmt.Errorf("accusation: unsupported event type %q", event.Type)
	}
}

func (m *AccusationModule) Apply(_ context.Context, event engine.GameEvent, state *engine.GameState) error {
	switch event.Type {
	case "accusation:accuse":
		var p accuseEventPayload
		if err := json.Unmarshal(event.Payload, &p); err != nil {
			return fmt.Errorf("accusation: apply: invalid payload: %w", err)
		}
		playerID, err := uuid.Parse(p.PlayerID)
		if err != nil {
			return fmt.Errorf("accusation: apply: invalid playerId: %w", err)
		}
		var targetID uuid.UUID
		if p.TargetID != "" {
			targetID, err = uuid.Parse(p.TargetID)
			if err != nil {
				return fmt.Errorf("accusation: apply: invalid targetId: %w", err)
			}
		}
		deadline := m.timeNow().Add(time.Duration(m.config.DefenseTime) * time.Second)
		m.mu.Lock()
		m.activeAccusation = &Accusation{
			AccuserID:       playerID,
			AccusedID:       targetID,
			AccusedCode:     p.TargetCode,
			DefenseDeadline: deadline,
			Votes:           make(map[uuid.UUID]bool),
		}
		m.accusationCount++
		m.isActive = true
		m.mu.Unlock()

	case "accusation:vote":
		var p accuseEventPayload
		if err := json.Unmarshal(event.Payload, &p); err != nil {
			return fmt.Errorf("accusation: apply: invalid payload: %w", err)
		}
		playerID, err := uuid.Parse(p.PlayerID)
		if err != nil {
			return fmt.Errorf("accusation: apply: invalid playerId: %w", err)
		}
		guilty := p.Guilty != nil && *p.Guilty
		m.mu.Lock()
		if m.activeAccusation != nil {
			m.activeAccusation.Votes[playerID] = guilty
		}
		m.mu.Unlock()
	}

	data, err := m.BuildState()
	if err != nil {
		return fmt.Errorf("accusation: apply: build state: %w", err)
	}
	if state.Modules == nil {
		state.Modules = make(map[string]json.RawMessage)
	}
	state.Modules[m.Name()] = data
	return nil
}

// --- WinChecker ---

func (m *AccusationModule) CheckWin(_ context.Context, state engine.GameState) (engine.WinResult, error) {
	raw, ok := state.Modules[m.Name()]
	if !ok {
		return engine.WinResult{Won: false}, nil
	}

	var s accusationState
	if err := json.Unmarshal(raw, &s); err != nil {
		return engine.WinResult{}, fmt.Errorf("accusation: check win: %w", err)
	}

	// Win condition: an accusation was resolved and expelled player matches culprit.
	// The culprit code is stored in the state when expulsion occurs.
	if s.ExpelledCode == "" || !s.ExpelledIsCulprit {
		return engine.WinResult{Won: false}, nil
	}

	return engine.WinResult{
		Won:    true,
		Reason: fmt.Sprintf("accusation: player %q correctly identified as culprit", s.ExpelledCode),
	}, nil
}

// --- PhaseHookModule ---

func (m *AccusationModule) OnPhaseEnter(_ context.Context, _ engine.Phase) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	// Reset accusation count when entering a new phase (new round of accusations).
	m.accusationCount = 0
	m.activeAccusation = nil
	m.isActive = false
	return nil
}

func (m *AccusationModule) OnPhaseExit(_ context.Context, _ engine.Phase) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	// Lock down any in-progress accusation when leaving a phase.
	m.activeAccusation = nil
	m.isActive = false
	return nil
}

// Compile-time interface checks.
var (
	_ engine.Module           = (*AccusationModule)(nil)
	_ engine.ConfigSchema     = (*AccusationModule)(nil)
	_ engine.GameEventHandler = (*AccusationModule)(nil)
	_ engine.WinChecker       = (*AccusationModule)(nil)
	_ engine.PhaseHookModule  = (*AccusationModule)(nil)
)
