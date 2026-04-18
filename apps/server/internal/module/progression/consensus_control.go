package progression

import (
	"context"
	"encoding/json"
	"fmt"
	"sync"
	"time"

	"github.com/google/uuid"
	"github.com/mmp-platform/server/internal/engine"
)

// ConsensusProposal represents an active consensus proposal.
type ConsensusProposal struct {
	ActionType string             `json:"actionType"`
	Votes      map[uuid.UUID]bool `json:"votes"`
	CreatedAt  time.Time          `json:"createdAt"`
}

// ConsensusControlModule manages player-driven consensus for game actions.
// Auto-enabled when gmMode is NONE or OPTIONAL.
//
// PR-2a: declares public state — active proposals and per-player vote tallies
// are broadcast to everyone (designed transparency for player-driven consensus).
type ConsensusControlModule struct {
	engine.PublicStateMarker

	mu   sync.RWMutex
	deps engine.ModuleDeps

	// state
	proposals    map[string]*ConsensusProposal
	totalPlayers int
}

// Valid consensus action types.
var validConsensusActions = map[string]bool{
	"START_GAME":       true,
	"NEXT_PHASE":       true,
	"NEXT_ROUND":       true,
	"START_VOTING":     true,
	"SHOW_ENDING":      true,
	"READING_COMPLETE": true,
	"REVEAL_ALL_CLUES": true,
}

type consensusControlConfig struct {
	TotalPlayers int `json:"TotalPlayers"`
}

// NewConsensusControlModule creates a new ConsensusControlModule instance.
func NewConsensusControlModule() *ConsensusControlModule {
	return &ConsensusControlModule{}
}

func (m *ConsensusControlModule) Name() string { return "consensus_control" }

func (m *ConsensusControlModule) Init(ctx context.Context, deps engine.ModuleDeps, config json.RawMessage) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	m.deps = deps

	var cfg consensusControlConfig
	if config != nil && len(config) > 0 {
		if err := json.Unmarshal(config, &cfg); err != nil {
			return fmt.Errorf("consensus_control: invalid config: %w", err)
		}
	}

	m.totalPlayers = cfg.TotalPlayers
	m.proposals = make(map[string]*ConsensusProposal)

	return nil
}

func (m *ConsensusControlModule) HandleMessage(ctx context.Context, playerID uuid.UUID, msgType string, payload json.RawMessage) error {
	m.mu.Lock()

	switch msgType {
	case "consensus:propose":
		var p struct {
			ActionType string `json:"ActionType"`
		}
		if err := json.Unmarshal(payload, &p); err != nil {
			m.mu.Unlock()
			return fmt.Errorf("consensus_control: invalid payload: %w", err)
		}
		if !validConsensusActions[p.ActionType] {
			m.mu.Unlock()
			return fmt.Errorf("consensus_control: invalid action type %q", p.ActionType)
		}
		if _, exists := m.proposals[p.ActionType]; exists {
			m.mu.Unlock()
			return fmt.Errorf("consensus_control: proposal for %q already active", p.ActionType)
		}

		m.proposals[p.ActionType] = &ConsensusProposal{
			ActionType: p.ActionType,
			Votes:      map[uuid.UUID]bool{playerID: true}, // proposer auto-approves
			CreatedAt:  time.Now(),
		}

		// Check if single vote is majority
		majorityReached := m.checkMajority(m.proposals[p.ActionType])
		m.mu.Unlock()

		m.deps.EventBus.Publish(engine.Event{
			Type:    "consensus.proposed",
			Payload: map[string]any{"actionType": p.ActionType, "proposedBy": playerID.String()},
		})

		if majorityReached {
			m.resolveProposal(p.ActionType, true)
		}
		return nil

	case "consensus:vote":
		var p struct {
			ActionType string `json:"ActionType"`
			Approve    bool   `json:"Approve"`
		}
		if err := json.Unmarshal(payload, &p); err != nil {
			m.mu.Unlock()
			return fmt.Errorf("consensus_control: invalid payload: %w", err)
		}

		proposal, exists := m.proposals[p.ActionType]
		if !exists {
			m.mu.Unlock()
			return fmt.Errorf("consensus_control: no active proposal for %q", p.ActionType)
		}

		proposal.Votes[playerID] = p.Approve

		majorityReached := m.checkMajority(proposal)
		rejected := m.checkRejected(proposal)
		m.mu.Unlock()

		if majorityReached {
			m.resolveProposal(p.ActionType, true)
		} else if rejected {
			m.resolveProposal(p.ActionType, false)
		}
		return nil

	default:
		m.mu.Unlock()
		return fmt.Errorf("consensus_control: unknown message type %q", msgType)
	}
}

// checkMajority returns true if more than half of totalPlayers approved.
// Must be called with m.mu held.
func (m *ConsensusControlModule) checkMajority(proposal *ConsensusProposal) bool {
	if m.totalPlayers <= 0 {
		return false
	}
	approvals := 0
	for _, v := range proposal.Votes {
		if v {
			approvals++
		}
	}
	return approvals > m.totalPlayers/2
}

// checkRejected returns true if majority approval is no longer possible.
// Must be called with m.mu held.
func (m *ConsensusControlModule) checkRejected(proposal *ConsensusProposal) bool {
	if m.totalPlayers <= 0 {
		return false
	}
	rejections := 0
	for _, v := range proposal.Votes {
		if !v {
			rejections++
		}
	}
	// If rejections make majority impossible
	return rejections > m.totalPlayers/2
}

// resolveProposal publishes the resolution and removes the proposal.
func (m *ConsensusControlModule) resolveProposal(actionType string, approved bool) {
	m.deps.EventBus.Publish(engine.Event{
		Type: "consensus.resolved",
		Payload: map[string]any{
			"ActionType": actionType,
			"Approved":   approved,
		},
	})

	m.mu.Lock()
	delete(m.proposals, actionType)
	m.mu.Unlock()
}

func (m *ConsensusControlModule) BuildState() (json.RawMessage, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	activeProposals := make(map[string]any, len(m.proposals))
	for k, p := range m.proposals {
		votes := make(map[string]bool, len(p.Votes))
		for id, v := range p.Votes {
			votes[id.String()] = v
		}
		activeProposals[k] = map[string]any{
			"actionType": p.ActionType,
			"votes":      votes,
			"createdAt":  p.CreatedAt,
		}
	}

	state := map[string]any{
		"activeProposals": activeProposals,
		"totalPlayers":    m.totalPlayers,
	}
	return json.Marshal(state)
}

func (m *ConsensusControlModule) Cleanup(ctx context.Context) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	m.proposals = nil
	return nil
}

// --- PhaseHookModule ---

func (m *ConsensusControlModule) OnPhaseEnter(_ context.Context, _ engine.Phase) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.proposals = make(map[string]*ConsensusProposal)
	return nil
}

func (m *ConsensusControlModule) OnPhaseExit(_ context.Context, _ engine.Phase) error {
	return nil
}

// Compile-time interface checks.
var (
	_ engine.Module            = (*ConsensusControlModule)(nil)
	_ engine.PhaseHookModule   = (*ConsensusControlModule)(nil)
	_ engine.PublicStateModule = (*ConsensusControlModule)(nil)
)

func init() {
	engine.Register("consensus_control", func() engine.Module { return NewConsensusControlModule() })
}
