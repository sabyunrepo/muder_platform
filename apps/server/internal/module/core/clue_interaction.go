package core

import (
	"context"
	"encoding/json"
	"fmt"
	"sort"
	"strings"
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
	DrawLimit            int                             `json:"drawLimit"`
	InitialClueLevel     int                             `json:"initialClueLevel"`
	CumulativeLevel      bool                            `json:"cumulativeLevel"`
	DuplicatePolicy      string                          `json:"duplicatePolicy"`
	CommonClueVisibility string                          `json:"commonClueVisibility"`
	AutoRevealClues      bool                            `json:"autoRevealClues"`
	ItemEffects          map[string]ClueItemEffectConfig `json:"itemEffects,omitempty"`
	CluePolicies         map[string]CluePolicyConfig     `json:"cluePolicies,omitempty"`
}

type CluePolicyConfig struct {
	Revealable bool `json:"revealable"`
	Protected  bool `json:"protected"`
}

// ItemUseState tracks an in-progress item use action.
type ItemUseState struct {
	UserID     uuid.UUID `json:"userId"`
	ClueID     uuid.UUID `json:"clueId"`
	Effect     string    `json:"effect"`
	Target     string    `json:"target"`
	Consume    bool      `json:"consume"`
	Configured bool      `json:"configured"`
	StartedAt  time.Time `json:"startedAt"`
}

// ClueInteractionModule handles clue drawing and transfer mechanics.
type ClueInteractionModule struct {
	mu                  sync.RWMutex
	deps                engine.ModuleDeps
	config              ClueInteractionConfig
	playerDrawCounts    map[uuid.UUID]int
	currentClueLevel    int
	acquiredClues       map[uuid.UUID][]string
	targetCodeClues     map[string][]string
	allPlayerClues      []string
	activeItemUse       *ItemUseState
	usedItems           map[uuid.UUID][]uuid.UUID // playerID -> used clue IDs
	revealedInfo        map[uuid.UUID]map[string]string
	changedDescriptions map[uuid.UUID]map[string]string
	itemTimeout         *time.Timer
	appliedGrantIDs     map[string]struct{}
	playerKillConfig    PlayerKillConfig
	playerKillEnabled   bool
	currentPhaseID      string
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
	m.targetCodeClues = make(map[string][]string)
	m.allPlayerClues = nil
	m.usedItems = make(map[uuid.UUID][]uuid.UUID)
	m.revealedInfo = make(map[uuid.UUID]map[string]string)
	m.changedDescriptions = make(map[uuid.UUID]map[string]string)
	m.appliedGrantIDs = make(map[string]struct{})

	// Apply defaults first.
	m.config = ClueInteractionConfig{
		DrawLimit:            5,
		InitialClueLevel:     1,
		CumulativeLevel:      true,
		DuplicatePolicy:      "exclusive",
		CommonClueVisibility: "all",
		AutoRevealClues:      false,
		ItemEffects:          map[string]ClueItemEffectConfig{},
		CluePolicies:         map[string]CluePolicyConfig{},
	}

	// Unmarshal directly into m.config — only provided JSON fields overwrite defaults.
	if config != nil && len(config) > 0 {
		if err := json.Unmarshal(config, &m.config); err != nil {
			return fmt.Errorf("clue_interaction: invalid config: %w", err)
		}
	}
	if m.config.ItemEffects == nil {
		m.config.ItemEffects = map[string]ClueItemEffectConfig{}
	}
	if m.config.CluePolicies == nil {
		m.config.CluePolicies = map[string]CluePolicyConfig{}
	}
	if err := validateClueItemEffectConfig(m.config.ItemEffects); err != nil {
		return err
	}
	m.playerKillConfig = PlayerKillConfig{}
	m.playerKillEnabled = false
	if rawConfig, ok := deps.ModuleConfigs[playerKillModuleName]; ok && len(rawConfig) > 0 {
		m.playerKillEnabled = true
		if err := json.Unmarshal(rawConfig, &m.playerKillConfig); err != nil {
			return fmt.Errorf("clue_interaction: invalid player_kill config: %w", err)
		}
	}

	m.currentClueLevel = m.config.InitialClueLevel
	return nil
}

func (m *ClueInteractionModule) OnPhaseEnter(_ context.Context, phase engine.Phase) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.currentPhaseID = string(phase)
	return nil
}

func (m *ClueInteractionModule) OnPhaseExit(_ context.Context, _ engine.Phase) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.currentPhaseID = ""
	return nil
}

type drawCluePayload struct {
	LocationID string `json:"locationId"`
}

type transferCluePayload struct {
	TargetCode string `json:"targetCode"`
	ClueID     string `json:"clueId"`
}

type clueGrantTarget struct {
	Type        string `json:"type"`
	CharacterID string `json:"character_id,omitempty"`
}

type clueGrantDelivery struct {
	ID      string          `json:"id"`
	Target  clueGrantTarget `json:"target"`
	ClueIDs []string        `json:"clue_ids"`
}

type grantClueParams struct {
	Deliveries []clueGrantDelivery `json:"deliveries"`
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

// --- PhaseReactor ---

func (m *ClueInteractionModule) ReactTo(ctx context.Context, action engine.PhaseActionPayload) error {
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

	case engine.ActionGrantClue:
		var params grantClueParams
		if err := json.Unmarshal(action.Params, &params); err != nil {
			return fmt.Errorf("clue_interaction: invalid GRANT_CLUE params: %w", err)
		}
		return m.applyClueGrants(ctx, params.Deliveries)

	default:
		return fmt.Errorf("clue_interaction: unsupported action %q", action.Action)
	}
}

func (m *ClueInteractionModule) SupportedActions() []engine.PhaseAction {
	return []engine.PhaseAction{
		engine.ActionResetDrawCount,
		engine.ActionSetClueLevel,
		engine.ActionGrantClue,
	}
}

func (m *ClueInteractionModule) applyClueGrants(ctx context.Context, deliveries []clueGrantDelivery) error {
	type preparedGrant struct {
		delivery  clueGrantDelivery
		clueIDs   []string
		playerIDs []uuid.UUID
	}
	events := make([]engine.Event, 0, len(deliveries))
	prepared := make([]preparedGrant, 0, len(deliveries))
	for _, delivery := range deliveries {
		delivery.ID = normalizeClueGrantID(delivery)
		clueIDs := uniqueClueIDs(delivery.ClueIDs)
		if len(clueIDs) == 0 {
			return fmt.Errorf("clue_interaction: grant %q has empty clue_ids", delivery.ID)
		}
		next := preparedGrant{delivery: delivery, clueIDs: clueIDs}
		switch delivery.Target.Type {
		case "all_players":
			if rosterProvider, ok := m.deps.PlayerInfoProvider.(engine.PlayerRuntimeRosterProvider); ok {
				for _, player := range rosterProvider.PlayerRuntimeRoster(ctx) {
					next.playerIDs = append(next.playerIDs, player.PlayerID)
				}
			}
		case "character":
			if delivery.Target.CharacterID == "" {
				return fmt.Errorf("clue_interaction: grant %q missing character_id", delivery.ID)
			}
			if m.deps.PlayerInfoProvider != nil {
				if playerID, ok := m.deps.PlayerInfoProvider.ResolvePlayerID(ctx, delivery.Target.CharacterID); ok {
					next.playerIDs = append(next.playerIDs, playerID)
				}
			}
		default:
			return fmt.Errorf("clue_interaction: grant %q has unsupported target type %q", delivery.ID, delivery.Target.Type)
		}
		prepared = append(prepared, next)
	}

	m.mu.Lock()
	for _, grant := range prepared {
		if _, applied := m.appliedGrantIDs[grant.delivery.ID]; applied {
			continue
		}
		switch grant.delivery.Target.Type {
		case "all_players":
			m.allPlayerClues = mergeClueList(m.allPlayerClues, grant.clueIDs)
			for _, playerID := range grant.playerIDs {
				m.acquiredClues[playerID] = mergeClueList(m.acquiredClues[playerID], grant.clueIDs)
			}
		case "character":
			if len(grant.playerIDs) > 0 {
				for _, playerID := range grant.playerIDs {
					m.acquiredClues[playerID] = mergeClueList(m.acquiredClues[playerID], grant.clueIDs)
				}
			} else {
				m.targetCodeClues[grant.delivery.Target.CharacterID] = mergeClueList(
					m.targetCodeClues[grant.delivery.Target.CharacterID],
					grant.clueIDs,
				)
			}
		}
		events = append(events, engine.Event{
			Type: "clue.granted",
			Payload: map[string]any{
				"deliveryId": grant.delivery.ID,
				"target":     grant.delivery.Target,
				"clueIds":    grant.clueIDs,
			},
		})
		m.appliedGrantIDs[grant.delivery.ID] = struct{}{}
	}
	m.mu.Unlock()
	for _, event := range events {
		m.deps.EventBus.Publish(event)
	}
	return nil
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
			"itemEffects": map[string]any{
				"type": "object",
				"additionalProperties": map[string]any{
					"type": "object",
					"properties": map[string]any{
						"effect":          map[string]any{"type": "string", "enum": []string{"description_change", "peek", "steal", "reveal", "grant_clue", "kill"}},
						"target":          map[string]any{"type": "string", "enum": []string{"player", "self"}},
						"consume":         map[string]any{"type": "boolean", "default": false},
						"descriptionText": map[string]any{"type": "string"},
						"revealText":      map[string]any{"type": "string"},
						"grantClueIds":    map[string]any{"type": "array", "items": map[string]any{"type": "string"}},
						"attackPower":     map[string]any{"type": "integer", "minimum": 0},
						"defensePower":    map[string]any{"type": "integer", "minimum": 0},
					},
					"required":             []string{"effect"},
					"additionalProperties": false,
				},
				"description": "Runtime clue use effects keyed by clue ID",
			},
			"cluePolicies": map[string]any{
				"type": "object",
				"additionalProperties": map[string]any{
					"type": "object",
					"properties": map[string]any{
						"revealable": map[string]any{"type": "boolean", "default": true},
						"protected":  map[string]any{"type": "boolean", "default": false},
					},
					"additionalProperties": false,
				},
				"description": "Editor-owned clue visibility and protection policies keyed by clue ID",
			},
		},
		"additionalProperties": false,
	}
	data, _ := json.Marshal(schema)
	return data
}

type clueInteractionState struct {
	PlayerDrawCounts    map[uuid.UUID]int               `json:"playerDrawCounts"`
	CurrentClueLevel    int                             `json:"currentClueLevel"`
	AcquiredClues       map[uuid.UUID][]string          `json:"acquiredClues"`
	AllPlayerClues      []string                        `json:"allPlayerClues,omitempty"`
	Config              ClueInteractionConfig           `json:"config"`
	UsedItems           map[uuid.UUID][]uuid.UUID       `json:"usedItems"`
	RevealedInfo        map[uuid.UUID]map[string]string `json:"revealedInfo"`
	ChangedDescriptions map[uuid.UUID]map[string]string `json:"changedDescriptions"`
	ActiveItemUse       *ItemUseState                   `json:"activeItemUse,omitempty"`
}

func (m *ClueInteractionModule) BuildState() (json.RawMessage, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	return json.Marshal(clueInteractionState{
		PlayerDrawCounts:    m.playerDrawCounts,
		CurrentClueLevel:    m.currentClueLevel,
		AcquiredClues:       m.acquiredClues,
		AllPlayerClues:      m.allPlayerClues,
		Config:              m.config,
		UsedItems:           m.usedItems,
		RevealedInfo:        m.revealedInfo,
		ChangedDescriptions: m.changedDescriptions,
		ActiveItemUse:       m.activeItemUse,
	})
}

func (m *ClueInteractionModule) Cleanup(_ context.Context) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	m.playerDrawCounts = nil
	m.acquiredClues = nil
	m.targetCodeClues = nil
	m.allPlayerClues = nil
	m.usedItems = nil
	m.revealedInfo = nil
	m.changedDescriptions = nil
	m.activeItemUse = nil
	m.appliedGrantIDs = nil
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
// strategy. CurrentClueLevel and non-secret Config are session-wide and remain
// public; configured clue effects are removed because they may contain hidden
// reveal text and future rewards.
func (m *ClueInteractionModule) BuildStateFor(playerID uuid.UUID) (json.RawMessage, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	var activeItemUse *ItemUseState
	if m.activeItemUse != nil && m.activeItemUse.UserID == playerID {
		cp := *m.activeItemUse
		activeItemUse = &cp
	}
	acquiredClues := engine.FilterByPlayer(m.acquiredClues, playerID)
	acquiredClues[playerID] = mergeClueList(acquiredClues[playerID], m.allPlayerClues)
	if m.deps.PlayerInfoProvider != nil {
		if info, ok := m.deps.PlayerInfoProvider.PlayerRuntimeInfo(context.Background(), playerID); ok {
			acquiredClues[playerID] = mergeClueList(acquiredClues[playerID], m.targetCodeClues[info.TargetCode])
		}
	}
	acquiredClues[playerID] = mergeClueList(acquiredClues[playerID], m.targetCodeClues[playerID.String()])
	return json.Marshal(clueInteractionState{
		PlayerDrawCounts:    engine.FilterByPlayer(m.playerDrawCounts, playerID),
		CurrentClueLevel:    m.currentClueLevel,
		AcquiredClues:       acquiredClues,
		AllPlayerClues:      m.allPlayerClues,
		Config:              m.configForPlayerState(),
		UsedItems:           engine.FilterByPlayer(m.usedItems, playerID),
		RevealedInfo:        engine.FilterByPlayer(m.revealedInfo, playerID),
		ChangedDescriptions: engine.FilterByPlayer(m.changedDescriptions, playerID),
		ActiveItemUse:       activeItemUse,
	})
}

func normalizeClueGrantID(delivery clueGrantDelivery) string {
	if delivery.ID != "" {
		return delivery.ID
	}
	return delivery.Target.Type + ":" + delivery.Target.CharacterID + ":clues:" + strings.Join(uniqueClueIDs(delivery.ClueIDs), ",")
}

func uniqueClueIDs(ids []string) []string {
	seen := map[string]struct{}{}
	out := make([]string, 0, len(ids))
	for _, id := range ids {
		if id == "" {
			continue
		}
		if _, ok := seen[id]; ok {
			continue
		}
		seen[id] = struct{}{}
		out = append(out, id)
	}
	sort.Strings(out)
	return out
}

func mergeClueList(current []string, next []string) []string {
	return uniqueClueIDs(append(append([]string{}, current...), next...))
}

func (m *ClueInteractionModule) configForPlayerState() ClueInteractionConfig {
	config := m.config
	config.ItemEffects = nil
	config.CluePolicies = nil
	return config
}

// Compile-time interface checks.
var (
	_ engine.Module            = (*ClueInteractionModule)(nil)
	_ engine.PhaseReactor      = (*ClueInteractionModule)(nil)
	_ engine.PhaseHookModule   = (*ClueInteractionModule)(nil)
	_ engine.ConfigSchema      = (*ClueInteractionModule)(nil)
	_ engine.GameEventHandler  = (*ClueInteractionModule)(nil)
	_ engine.PlayerAwareModule = (*ClueInteractionModule)(nil)
)
