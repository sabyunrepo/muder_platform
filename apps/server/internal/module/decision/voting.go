package decision

import (
	"context"
	"encoding/json"
	"fmt"
	"math/rand/v2"
	"sync"

	"github.com/google/uuid"
	"github.com/mmp-platform/server/internal/engine"
)

func init() {
	engine.Register("voting", func() engine.Module { return NewVotingModule() })
}

// VotingConfig defines the settings for the voting module.
type VotingConfig struct {
	Mode             string `json:"mode"`             // "open"|"secret", default "open"
	MinParticipation int    `json:"minParticipation"` // %, default 75
	TieBreaker       string `json:"tieBreaker"`       // "revote"|"random"|"no_result", default "revote"
	ShowRealtime     bool   `json:"showRealtime"`     // default true (only when mode=open)
	RevealVoters     bool   `json:"revealVoters"`     // default false (only when mode=secret)
	AllowAbstain     bool   `json:"allowAbstain"`     // default false
	MaxRounds        int    `json:"maxRounds"`        // default 3
	DeadCanVote      bool   `json:"deadCanVote"`      // default false
}

// VoteResult holds the outcome of a voting round.
type VoteResult struct {
	Results map[string]int `json:"results"`
	Winner  string         `json:"winner"`
	IsTie   bool           `json:"isTie"`
	Round   int            `json:"round"`
}

// VotingModule handles voting mechanics during game phases.
type VotingModule struct {
	mu           sync.RWMutex
	deps         engine.ModuleDeps
	config       VotingConfig
	votes        map[uuid.UUID]string // playerID → targetCode
	isOpen       bool
	currentRound int
	totalPlayers int
	alivePlayers int
}

// NewVotingModule creates a new VotingModule instance.
func NewVotingModule() *VotingModule {
	return &VotingModule{}
}

func (m *VotingModule) Name() string { return "voting" }

func (m *VotingModule) Init(_ context.Context, deps engine.ModuleDeps, config json.RawMessage) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	m.deps = deps
	m.votes = make(map[uuid.UUID]string)

	// Apply defaults.
	m.config = VotingConfig{
		Mode:             "open",
		MinParticipation: 75,
		TieBreaker:       "revote",
		ShowRealtime:     true,
		RevealVoters:     false,
		AllowAbstain:     false,
		MaxRounds:        3,
		DeadCanVote:      false,
	}

	if config != nil && len(config) > 0 {
		var cfg VotingConfig
		if err := json.Unmarshal(config, &cfg); err != nil {
			return fmt.Errorf("voting: invalid config: %w", err)
		}
		if cfg.Mode != "" {
			m.config.Mode = cfg.Mode
		}
		if cfg.MinParticipation > 0 {
			m.config.MinParticipation = cfg.MinParticipation
		}
		if cfg.TieBreaker != "" {
			m.config.TieBreaker = cfg.TieBreaker
		}
		m.config.ShowRealtime = cfg.ShowRealtime
		m.config.RevealVoters = cfg.RevealVoters
		m.config.AllowAbstain = cfg.AllowAbstain
		m.config.DeadCanVote = cfg.DeadCanVote
		if cfg.MaxRounds > 0 {
			m.config.MaxRounds = cfg.MaxRounds
		}
	}

	m.currentRound = 0
	return nil
}

type voteCastPayload struct {
	TargetCode string `json:"targetCode"`
}

func (m *VotingModule) HandleMessage(_ context.Context, playerID uuid.UUID, msgType string, payload json.RawMessage) error {
	switch msgType {
	case "vote:cast":
		return m.handleVoteCast(playerID, payload)
	case "vote:change":
		return m.handleVoteChange(playerID, payload)
	default:
		return fmt.Errorf("voting: unknown message type %q", msgType)
	}
}

func (m *VotingModule) handleVoteCast(playerID uuid.UUID, payload json.RawMessage) error {
	var p voteCastPayload
	if err := json.Unmarshal(payload, &p); err != nil {
		return fmt.Errorf("voting: invalid vote:cast payload: %w", err)
	}

	m.mu.Lock()
	if p.TargetCode == "" && !m.config.AllowAbstain {
		m.mu.Unlock()
		return fmt.Errorf("voting: abstain not allowed")
	}
	if !m.isOpen {
		m.mu.Unlock()
		return fmt.Errorf("voting: voting is not open")
	}
	if _, already := m.votes[playerID]; already {
		m.mu.Unlock()
		return fmt.Errorf("voting: player already voted, use vote:change")
	}
	m.votes[playerID] = p.TargetCode
	votedCount := len(m.votes)
	mode := m.config.Mode
	showRealtime := m.config.ShowRealtime
	m.mu.Unlock()

	eventPayload := map[string]any{
		"playerId":   playerID.String(),
		"votedCount": votedCount,
	}
	if mode == "open" && showRealtime {
		eventPayload["targetCode"] = p.TargetCode
	}
	m.deps.EventBus.Publish(engine.Event{
		Type:    "vote.cast",
		Payload: eventPayload,
	})
	return nil
}

func (m *VotingModule) handleVoteChange(playerID uuid.UUID, payload json.RawMessage) error {
	var p voteCastPayload
	if err := json.Unmarshal(payload, &p); err != nil {
		return fmt.Errorf("voting: invalid vote:change payload: %w", err)
	}

	m.mu.Lock()
	if p.TargetCode == "" && !m.config.AllowAbstain {
		m.mu.Unlock()
		return fmt.Errorf("voting: abstain not allowed")
	}
	if !m.isOpen {
		m.mu.Unlock()
		return fmt.Errorf("voting: voting is not open")
	}
	if _, exists := m.votes[playerID]; !exists {
		m.mu.Unlock()
		return fmt.Errorf("voting: no existing vote to change")
	}
	m.votes[playerID] = p.TargetCode
	votedCount := len(m.votes)
	mode := m.config.Mode
	showRealtime := m.config.ShowRealtime
	m.mu.Unlock()

	eventPayload := map[string]any{
		"playerId":   playerID.String(),
		"votedCount": votedCount,
	}
	if mode == "open" && showRealtime {
		eventPayload["targetCode"] = p.TargetCode
	}
	m.deps.EventBus.Publish(engine.Event{
		Type:    "vote.changed",
		Payload: eventPayload,
	})
	return nil
}

// --- PhaseReactor ---

func (m *VotingModule) ReactTo(_ context.Context, action engine.PhaseActionPayload) error {
	switch action.Action {
	case engine.ActionOpenVoting:
		return m.openVoting(action.Params)
	case engine.ActionCloseVoting:
		return m.closeVoting()
	default:
		return fmt.Errorf("voting: unsupported action %q", action.Action)
	}
}

func (m *VotingModule) SupportedActions() []engine.PhaseAction {
	return []engine.PhaseAction{
		engine.ActionOpenVoting,
		engine.ActionCloseVoting,
	}
}

type openVotingParams struct {
	TotalPlayers int `json:"totalPlayers"`
	AlivePlayers int `json:"alivePlayers"`
}

func (m *VotingModule) openVoting(params json.RawMessage) error {
	m.mu.Lock()

	if params != nil && len(params) > 0 {
		var p openVotingParams
		if err := json.Unmarshal(params, &p); err != nil {
			m.mu.Unlock()
			return fmt.Errorf("voting: invalid OPEN_VOTING params: %w", err)
		}
		m.totalPlayers = p.TotalPlayers
		m.alivePlayers = p.AlivePlayers
	}

	m.isOpen = true
	m.votes = make(map[uuid.UUID]string)
	m.currentRound++

	round := m.currentRound
	maxRounds := m.config.MaxRounds
	m.mu.Unlock()

	m.deps.EventBus.Publish(engine.Event{
		Type: "vote.opened",
		Payload: map[string]any{
			"round":    round,
			"maxRound": maxRounds,
		},
	})
	return nil
}

func (m *VotingModule) closeVoting() error {
	m.mu.Lock()

	if !m.isOpen {
		m.mu.Unlock()
		return fmt.Errorf("voting: voting is not open")
	}
	m.isOpen = false

	result := m.tallyResults()
	m.mu.Unlock()

	m.deps.EventBus.Publish(engine.Event{
		Type:    "vote.result",
		Payload: result,
	})
	return nil
}

// tallyResults counts votes, checks participation, and handles ties.
// Must be called under write lock.
func (m *VotingModule) tallyResults() VoteResult {
	counts := make(map[string]int)
	for _, target := range m.votes {
		if target != "" { // skip abstentions in count
			counts[target]++
		}
	}

	result := VoteResult{
		Results: counts,
		Round:   m.currentRound,
	}

	// Check minimum participation.
	eligible := m.alivePlayers
	if m.config.DeadCanVote {
		eligible = m.totalPlayers
	}
	if eligible > 0 {
		participation := (len(m.votes) * 100) / eligible
		if participation < m.config.MinParticipation {
			result.IsTie = true
			result.Winner = ""
			return result
		}
	}

	// Find the winner(s).
	maxVotes := 0
	var winners []string
	for target, count := range counts {
		if count > maxVotes {
			maxVotes = count
			winners = []string{target}
		} else if count == maxVotes {
			winners = append(winners, target)
		}
	}

	if len(winners) == 0 {
		result.IsTie = true
		result.Winner = ""
		return result
	}

	if len(winners) == 1 {
		result.Winner = winners[0]
		result.IsTie = false
		return result
	}

	// Tie handling.
	result.IsTie = true
	switch m.config.TieBreaker {
	case "random":
		result.Winner = winners[rand.IntN(len(winners))]
		result.IsTie = false
	case "no_result":
		result.Winner = ""
	case "revote":
		// Remains a tie; the engine should call OPEN_VOTING again if under maxRounds.
		result.Winner = ""
	}
	return result
}

// --- ConfigSchema ---

func (m *VotingModule) Schema() json.RawMessage {
	schema := map[string]any{
		"type": "object",
		"properties": map[string]any{
			"mode":             map[string]any{"type": "string", "enum": []string{"open", "secret"}, "default": "open"},
			"minParticipation": map[string]any{"type": "integer", "default": 75, "minimum": 0, "maximum": 100},
			"tieBreaker":       map[string]any{"type": "string", "enum": []string{"revote", "random", "no_result"}, "default": "revote"},
			"showRealtime":     map[string]any{"type": "boolean", "default": true, "description": "Show votes in real-time (open mode only)"},
			"revealVoters":     map[string]any{"type": "boolean", "default": false, "description": "Reveal who voted for whom (secret mode only)"},
			"allowAbstain":     map[string]any{"type": "boolean", "default": false},
			"maxRounds":        map[string]any{"type": "integer", "default": 3, "minimum": 1},
			"deadCanVote":      map[string]any{"type": "boolean", "default": false},
		},
		"additionalProperties": false,
	}
	data, _ := json.Marshal(schema)
	return data
}

type votingState struct {
	IsOpen       bool           `json:"isOpen"`
	CurrentRound int            `json:"currentRound"`
	Config       VotingConfig   `json:"config"`
	Votes        map[string]string `json:"votes,omitempty"` // only in open mode
	VotedCount   int            `json:"votedCount,omitempty"` // only in secret mode
}

func (m *VotingModule) BuildState() (json.RawMessage, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	state := votingState{
		IsOpen:       m.isOpen,
		CurrentRound: m.currentRound,
		Config:       m.config,
	}

	if m.config.Mode == "open" {
		votes := make(map[string]string, len(m.votes))
		for pid, target := range m.votes {
			votes[pid.String()] = target
		}
		state.Votes = votes
	} else {
		state.VotedCount = len(m.votes)
	}

	return json.Marshal(state)
}

func (m *VotingModule) Cleanup(_ context.Context) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	m.votes = nil
	m.isOpen = false
	return nil
}

// Compile-time interface checks.
var (
	_ engine.Module       = (*VotingModule)(nil)
	_ engine.PhaseReactor = (*VotingModule)(nil)
	_ engine.ConfigSchema = (*VotingModule)(nil)
)
