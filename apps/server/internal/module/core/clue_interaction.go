package core

import (
	"context"
	"encoding/json"
	"fmt"
	"sync"

	"github.com/google/uuid"
	"github.com/mmp-platform/server/internal/engine"
)

func init() {
	engine.Register("clue_interaction", func() engine.Module { return NewClueInteractionModule() })
}

// ClueInteractionConfig defines the settings for the clue interaction module.
type ClueInteractionConfig struct {
	DrawLimit            int    `json:"drawLimit"`
	InitialClueLevel     int    `json:"initialClueLevel"`
	CumulativeLevel      bool   `json:"cumulativeLevel"`
	DuplicatePolicy      string `json:"duplicatePolicy"`
	CommonClueVisibility string `json:"commonClueVisibility"`
	AutoRevealClues      bool   `json:"autoRevealClues"`
}

// ClueInteractionModule handles clue drawing and transfer mechanics.
type ClueInteractionModule struct {
	mu               sync.RWMutex
	deps             engine.ModuleDeps
	config           ClueInteractionConfig
	playerDrawCounts map[uuid.UUID]int
	currentClueLevel int
	acquiredClues    map[uuid.UUID][]string
}

// NewClueInteractionModule creates a new ClueInteractionModule instance.
func NewClueInteractionModule() *ClueInteractionModule {
	return &ClueInteractionModule{}
}

func (m *ClueInteractionModule) Name() string { return "clue_interaction" }

func (m *ClueInteractionModule) Init(_ context.Context, deps engine.ModuleDeps, config json.RawMessage) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	m.deps = deps
	m.playerDrawCounts = make(map[uuid.UUID]int)
	m.acquiredClues = make(map[uuid.UUID][]string)

	// Apply defaults first.
	m.config = ClueInteractionConfig{
		DrawLimit:            5,
		InitialClueLevel:     1,
		CumulativeLevel:      true,
		DuplicatePolicy:      "exclusive",
		CommonClueVisibility: "all",
		AutoRevealClues:      false,
	}

	// Unmarshal directly into m.config — only provided JSON fields overwrite defaults.
	if config != nil && len(config) > 0 {
		if err := json.Unmarshal(config, &m.config); err != nil {
			return fmt.Errorf("clue_interaction: invalid config: %w", err)
		}
	}

	m.currentClueLevel = m.config.InitialClueLevel
	return nil
}

type drawCluePayload struct {
	LocationID string `json:"locationId"`
}

type transferCluePayload struct {
	TargetCode string `json:"targetCode"`
	ClueID     string `json:"clueId"`
}

func (m *ClueInteractionModule) HandleMessage(ctx context.Context, playerID uuid.UUID, msgType string, payload json.RawMessage) error {
	switch msgType {
	case "draw_clue":
		return m.handleDrawClue(ctx, playerID, payload)
	case "transfer_clue":
		return m.handleTransferClue(ctx, playerID, payload)
	default:
		return fmt.Errorf("clue_interaction: unknown message type %q", msgType)
	}
}

func (m *ClueInteractionModule) handleDrawClue(_ context.Context, playerID uuid.UUID, payload json.RawMessage) error {
	var p drawCluePayload
	if err := json.Unmarshal(payload, &p); err != nil {
		return fmt.Errorf("clue_interaction: invalid draw_clue payload: %w", err)
	}

	m.mu.Lock()
	// Check draw limit.
	if m.playerDrawCounts[playerID] >= m.config.DrawLimit {
		m.mu.Unlock()
		return fmt.Errorf("clue_interaction: draw limit (%d) reached", m.config.DrawLimit)
	}

	// Generate a clue ID based on location and clue level.
	clueID := fmt.Sprintf("clue_%s_L%d_%d", p.LocationID, m.currentClueLevel, m.playerDrawCounts[playerID]+1)

	// Apply duplicate policy (exclusive: check if clue already acquired by someone).
	if m.config.DuplicatePolicy == "exclusive" {
		for _, clues := range m.acquiredClues {
			for _, c := range clues {
				if c == clueID {
					m.mu.Unlock()
					return fmt.Errorf("clue_interaction: clue %q already acquired (exclusive policy)", clueID)
				}
			}
		}
	}

	m.playerDrawCounts[playerID]++
	m.acquiredClues[playerID] = append(m.acquiredClues[playerID], clueID)
	clueLevel := m.currentClueLevel
	m.mu.Unlock()

	m.deps.EventBus.Publish(engine.Event{
		Type: "clue.acquired",
		Payload: map[string]any{
			"playerId":   playerID.String(),
			"clueId":     clueID,
			"locationId": p.LocationID,
			"clueLevel":  clueLevel,
		},
	})
	return nil
}

func (m *ClueInteractionModule) handleTransferClue(_ context.Context, playerID uuid.UUID, payload json.RawMessage) error {
	var p transferCluePayload
	if err := json.Unmarshal(payload, &p); err != nil {
		return fmt.Errorf("clue_interaction: invalid transfer_clue payload: %w", err)
	}

	m.mu.Lock()
	// Find and remove clue from sender.
	clues := m.acquiredClues[playerID]
	found := false
	for i, c := range clues {
		if c == p.ClueID {
			m.acquiredClues[playerID] = append(clues[:i], clues[i+1:]...)
			found = true
			break
		}
	}
	m.mu.Unlock()

	if !found {
		return fmt.Errorf("clue_interaction: player does not own clue %q", p.ClueID)
	}

	// Note: The target is identified by character code, not player ID.
	// The actual resolution of characterCode → playerID would be done by an
	// upstream coordinator. Here we publish the event for the system to handle.
	m.deps.EventBus.Publish(engine.Event{
		Type: "clue.transferred",
		Payload: map[string]any{
			"fromPlayerId": playerID.String(),
			"targetCode":   p.TargetCode,
			"clueId":       p.ClueID,
		},
	})
	return nil
}

// --- PhaseReactor ---

func (m *ClueInteractionModule) ReactTo(_ context.Context, action engine.PhaseActionPayload) error {
	switch action.Action {
	case engine.ActionResetDrawCount:
		m.mu.Lock()
		for pid := range m.playerDrawCounts {
			m.playerDrawCounts[pid] = 0
		}
		m.mu.Unlock()
		return nil

	case engine.ActionSetClueLevel:
		var params struct {
			Level int `json:"level"`
		}
		if err := json.Unmarshal(action.Params, &params); err != nil {
			return fmt.Errorf("clue_interaction: invalid SET_CLUE_LEVEL params: %w", err)
		}
		if params.Level <= 0 {
			return fmt.Errorf("clue_interaction: clue level must be positive, got %d", params.Level)
		}
		m.mu.Lock()
		m.currentClueLevel = params.Level
		m.mu.Unlock()
		return nil

	default:
		return fmt.Errorf("clue_interaction: unsupported action %q", action.Action)
	}
}

func (m *ClueInteractionModule) SupportedActions() []engine.PhaseAction {
	return []engine.PhaseAction{
		engine.ActionResetDrawCount,
		engine.ActionSetClueLevel,
	}
}

// --- ConfigSchema ---

func (m *ClueInteractionModule) Schema() json.RawMessage {
	schema := map[string]any{
		"type": "object",
		"properties": map[string]any{
			"drawLimit":            map[string]any{"type": "integer", "default": 5, "minimum": 1, "description": "Maximum clue draws per player per phase"},
			"initialClueLevel":    map[string]any{"type": "integer", "default": 1, "minimum": 1, "description": "Starting clue level"},
			"cumulativeLevel":     map[string]any{"type": "boolean", "default": true, "description": "Whether higher levels include lower-level clues"},
			"duplicatePolicy":     map[string]any{"type": "string", "enum": []string{"exclusive", "shared", "copy"}, "default": "exclusive", "description": "How duplicate clue draws are handled"},
			"commonClueVisibility": map[string]any{"type": "string", "enum": []string{"all", "finder_only", "same_location"}, "default": "all", "description": "Who can see common clues"},
			"autoRevealClues":     map[string]any{"type": "boolean", "default": false, "description": "Automatically reveal clues when drawn"},
		},
		"additionalProperties": false,
	}
	data, _ := json.Marshal(schema)
	return data
}

type clueInteractionState struct {
	PlayerDrawCounts map[uuid.UUID]int      `json:"playerDrawCounts"`
	CurrentClueLevel int                    `json:"currentClueLevel"`
	AcquiredClues    map[uuid.UUID][]string `json:"acquiredClues"`
	Config           ClueInteractionConfig  `json:"config"`
}

func (m *ClueInteractionModule) BuildState() (json.RawMessage, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	return json.Marshal(clueInteractionState{
		PlayerDrawCounts: m.playerDrawCounts,
		CurrentClueLevel: m.currentClueLevel,
		AcquiredClues:    m.acquiredClues,
		Config:           m.config,
	})
}

func (m *ClueInteractionModule) Cleanup(_ context.Context) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	m.playerDrawCounts = nil
	m.acquiredClues = nil
	return nil
}
