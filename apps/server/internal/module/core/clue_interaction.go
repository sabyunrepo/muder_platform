package core

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

// ItemUseState tracks an in-progress item use action.
type ItemUseState struct {
	UserID    uuid.UUID `json:"userId"`
	ClueID    uuid.UUID `json:"clueId"`
	Effect    string    `json:"effect"`
	Target    string    `json:"target"`
	StartedAt time.Time `json:"startedAt"`
}

// ClueInteractionModule handles clue drawing and transfer mechanics.
type ClueInteractionModule struct {
	mu               sync.RWMutex
	deps             engine.ModuleDeps
	config           ClueInteractionConfig
	playerDrawCounts map[uuid.UUID]int
	currentClueLevel int
	acquiredClues    map[uuid.UUID][]string
	activeItemUse    *ItemUseState
	usedItems        map[uuid.UUID][]uuid.UUID // playerID -> used clue IDs
	itemTimeout      *time.Timer
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
	m.usedItems = make(map[uuid.UUID][]uuid.UUID)

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
	case "clue:use":
		return m.handleItemUse(ctx, playerID, payload)
	case "clue:use_target":
		return m.handleItemUseTarget(ctx, playerID, payload)
	case "clue:use_cancel":
		return m.handleItemUseCancel(ctx, playerID)
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

type itemUsePayload struct {
	ClueID string `json:"clueId"`
	Effect string `json:"effect"`
	Target string `json:"target"`
}

type itemUseTargetPayload struct {
	TargetPlayerID string `json:"targetPlayerId"`
}

func (m *ClueInteractionModule) handleItemUse(_ context.Context, playerID uuid.UUID, payload json.RawMessage) error {
	var p itemUsePayload
	if err := json.Unmarshal(payload, &p); err != nil {
		return fmt.Errorf("clue_interaction: invalid clue:use payload: %w", err)
	}
	clueID, err := uuid.Parse(p.ClueID)
	if err != nil {
		return fmt.Errorf("clue_interaction: invalid clueId: %w", err)
	}

	m.mu.Lock()
	if m.activeItemUse != nil {
		m.mu.Unlock()
		return fmt.Errorf("clue_interaction: item use already in progress")
	}

	m.activeItemUse = &ItemUseState{
		UserID:    playerID,
		ClueID:    clueID,
		Effect:    p.Effect,
		Target:    p.Target,
		StartedAt: time.Now(),
	}

	timer := time.AfterFunc(30*time.Second, func() {
		m.mu.Lock()
		if m.activeItemUse != nil && m.activeItemUse.ClueID == clueID {
			m.activeItemUse = nil
		}
		m.mu.Unlock()
		m.deps.EventBus.Publish(engine.Event{
			Type: "clue.item_timeout",
			Payload: map[string]any{
				"playerId": playerID.String(),
				"clueId":   clueID.String(),
			},
		})
	})
	m.itemTimeout = timer
	m.mu.Unlock()

	m.deps.EventBus.Publish(engine.Event{
		Type: "clue.item_declared",
		Payload: map[string]any{
			"playerId": playerID.String(),
			"clueId":   clueID.String(),
		},
	})
	return nil
}

func (m *ClueInteractionModule) handleItemUseTarget(ctx context.Context, playerID uuid.UUID, payload json.RawMessage) error {
	var p itemUseTargetPayload
	if err := json.Unmarshal(payload, &p); err != nil {
		return fmt.Errorf("clue_interaction: invalid clue:use_target payload: %w", err)
	}

	m.mu.Lock()
	if m.activeItemUse == nil {
		m.mu.Unlock()
		return fmt.Errorf("clue_interaction: no active item use")
	}
	if m.activeItemUse.UserID != playerID {
		m.mu.Unlock()
		return fmt.Errorf("clue_interaction: not the active item user")
	}
	state := *m.activeItemUse
	m.mu.Unlock()

	var resolveErr error
	switch state.Effect {
	case "peek":
		resolveErr = m.handlePeekEffect(ctx, playerID, state.ClueID, p.TargetPlayerID)
	case "":
		// Effect not set in declaration — treat as unimplemented.
		resolveErr = fmt.Errorf("clue_interaction: effect not specified")
	default:
		resolveErr = fmt.Errorf("clue_interaction: effect %q not implemented", state.Effect)
	}

	if resolveErr != nil {
		return resolveErr
	}

	m.mu.Lock()
	if m.itemTimeout != nil {
		m.itemTimeout.Stop()
		m.itemTimeout = nil
	}
	if m.activeItemUse != nil && m.activeItemUse.ClueID == state.ClueID {
		m.usedItems[playerID] = append(m.usedItems[playerID], state.ClueID)
		m.activeItemUse = nil
	}
	m.mu.Unlock()

	m.deps.EventBus.Publish(engine.Event{
		Type: "clue.item_resolved",
		Payload: map[string]any{
			"playerId": playerID.String(),
			"clueId":   state.ClueID.String(),
			"effect":   state.Effect,
		},
	})
	return nil
}

func (m *ClueInteractionModule) handlePeekEffect(_ context.Context, _ uuid.UUID, _ uuid.UUID, targetPlayerIDStr string) error {
	targetPlayerID, err := uuid.Parse(targetPlayerIDStr)
	if err != nil {
		return fmt.Errorf("clue_interaction: invalid targetPlayerId: %w", err)
	}

	m.mu.RLock()
	clues := make([]string, len(m.acquiredClues[targetPlayerID]))
	copy(clues, m.acquiredClues[targetPlayerID])
	m.mu.RUnlock()

	m.deps.EventBus.Publish(engine.Event{
		Type: "clue.peek_result",
		Payload: map[string]any{
			"targetPlayerId": targetPlayerID.String(),
			"clues":          clues,
		},
	})
	return nil
}

func (m *ClueInteractionModule) handleItemUseCancel(_ context.Context, playerID uuid.UUID) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	if m.activeItemUse == nil {
		return fmt.Errorf("clue_interaction: no active item use")
	}
	if m.activeItemUse.UserID != playerID {
		return fmt.Errorf("clue_interaction: not the active item user")
	}
	if m.itemTimeout != nil {
		m.itemTimeout.Stop()
		m.itemTimeout = nil
	}
	m.activeItemUse = nil
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
			"initialClueLevel":     map[string]any{"type": "integer", "default": 1, "minimum": 1, "description": "Starting clue level"},
			"cumulativeLevel":      map[string]any{"type": "boolean", "default": true, "description": "Whether higher levels include lower-level clues"},
			"duplicatePolicy":      map[string]any{"type": "string", "enum": []string{"exclusive", "shared", "copy"}, "default": "exclusive", "description": "How duplicate clue draws are handled"},
			"commonClueVisibility": map[string]any{"type": "string", "enum": []string{"all", "finder_only", "same_location"}, "default": "all", "description": "Who can see common clues"},
			"autoRevealClues":      map[string]any{"type": "boolean", "default": false, "description": "Automatically reveal clues when drawn"},
		},
		"additionalProperties": false,
	}
	data, _ := json.Marshal(schema)
	return data
}

type clueInteractionState struct {
	PlayerDrawCounts map[uuid.UUID]int         `json:"playerDrawCounts"`
	CurrentClueLevel int                       `json:"currentClueLevel"`
	AcquiredClues    map[uuid.UUID][]string    `json:"acquiredClues"`
	Config           ClueInteractionConfig     `json:"config"`
	UsedItems        map[uuid.UUID][]uuid.UUID `json:"usedItems"`
	ActiveItemUse    *ItemUseState             `json:"activeItemUse,omitempty"`
}

func (m *ClueInteractionModule) BuildState() (json.RawMessage, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	return json.Marshal(clueInteractionState{
		PlayerDrawCounts: m.playerDrawCounts,
		CurrentClueLevel: m.currentClueLevel,
		AcquiredClues:    m.acquiredClues,
		Config:           m.config,
		UsedItems:        m.usedItems,
		ActiveItemUse:    m.activeItemUse,
	})
}

func (m *ClueInteractionModule) Cleanup(_ context.Context) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	m.playerDrawCounts = nil
	m.acquiredClues = nil
	m.usedItems = nil
	m.activeItemUse = nil
	if m.itemTimeout != nil {
		m.itemTimeout.Stop()
		m.itemTimeout = nil
	}
	return nil
}

// --- GameEventHandler ---

func (m *ClueInteractionModule) Validate(_ context.Context, event engine.GameEvent, _ engine.GameState) error {
	switch event.Type {
	case "draw_clue", "transfer_clue", "clue:use", "clue:use_target", "clue:use_cancel":
		return nil
	default:
		return fmt.Errorf("clue_interaction: unsupported event type %q", event.Type)
	}
}

func (m *ClueInteractionModule) Apply(_ context.Context, event engine.GameEvent, state *engine.GameState) error {
	data, err := m.BuildState()
	if err != nil {
		return fmt.Errorf("clue_interaction: apply: build state: %w", err)
	}
	if state.Modules == nil {
		state.Modules = make(map[string]json.RawMessage)
	}
	state.Modules[m.Name()] = data
	return nil
}

// BuildStateFor returns clue-interaction state redacted to the caller.
//
// Per-player maps (PlayerDrawCounts / AcquiredClues / UsedItems) are filtered
// to the caller's own entry. ActiveItemUse is revealed only when the caller
// is the item user — watching another player's in-flight item use leaks
// strategy. CurrentClueLevel and Config are session-wide and remain public.
func (m *ClueInteractionModule) BuildStateFor(playerID uuid.UUID) (json.RawMessage, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	var activeItemUse *ItemUseState
	if m.activeItemUse != nil && m.activeItemUse.UserID == playerID {
		cp := *m.activeItemUse
		activeItemUse = &cp
	}
	return json.Marshal(clueInteractionState{
		PlayerDrawCounts: engine.FilterByPlayer(m.playerDrawCounts, playerID),
		CurrentClueLevel: m.currentClueLevel,
		AcquiredClues:    engine.FilterByPlayer(m.acquiredClues, playerID),
		Config:           m.config,
		UsedItems:        engine.FilterByPlayer(m.usedItems, playerID),
		ActiveItemUse:    activeItemUse,
	})
}

// Compile-time interface checks.
var (
	_ engine.Module            = (*ClueInteractionModule)(nil)
	_ engine.PhaseReactor      = (*ClueInteractionModule)(nil)
	_ engine.ConfigSchema      = (*ClueInteractionModule)(nil)
	_ engine.GameEventHandler  = (*ClueInteractionModule)(nil)
	_ engine.PlayerAwareModule = (*ClueInteractionModule)(nil)
)
