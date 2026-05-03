package core

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/mmp-platform/server/internal/engine"
)

const (
	clueEffectPeek      = "peek"
	clueEffectReveal    = "reveal"
	clueEffectGrantClue = "grant_clue"
)

// ClueItemEffectConfig is the runtime-owned contract for configured clue use.
// Editor labels are mapped to this contract by adapters; the engine executes
// only this typed shape and never trusts client-side labels as runtime truth.
type ClueItemEffectConfig struct {
	Effect       string   `json:"effect"`
	Target       string   `json:"target,omitempty"`
	Consume      bool     `json:"consume"`
	RevealText   string   `json:"revealText,omitempty"`
	GrantClueIDs []string `json:"grantClueIds,omitempty"`
}

type itemUsePayload struct {
	ClueID string `json:"clueId"`
	Effect string `json:"effect"`
	Target string `json:"target"`
}

type itemUseTargetPayload struct {
	TargetPlayerID string `json:"targetPlayerId"`
}

func (m *ClueInteractionModule) handleItemUse(ctx context.Context, playerID uuid.UUID, payload json.RawMessage) error {
	var p itemUsePayload
	if err := json.Unmarshal(payload, &p); err != nil {
		return fmt.Errorf("clue_interaction: invalid clue:use payload: %w", err)
	}
	clueID, err := uuid.Parse(p.ClueID)
	if err != nil {
		return fmt.Errorf("clue_interaction: invalid clueId: %w", err)
	}

	effectCfg, configured := m.config.ItemEffects[p.ClueID]
	state := ItemUseState{
		UserID:     playerID,
		ClueID:     clueID,
		Effect:     p.Effect,
		Target:     p.Target,
		Consume:    false,
		Configured: configured,
		StartedAt:  time.Now(),
	}
	if configured {
		if m.playerUsedItem(playerID, clueID) {
			return nil
		}
		if err := m.validateConfiguredItemUse(playerID, p.ClueID, effectCfg); err != nil {
			return err
		}
		state.Effect = effectCfg.Effect
		state.Target = effectCfg.Target
		state.Consume = effectCfg.Consume
	}

	if state.Configured && (state.Target == "self" || state.Effect == clueEffectReveal || state.Effect == clueEffectGrantClue) {
		m.publishItemDeclared(playerID, clueID)
		return m.resolveItemUse(ctx, state, "")
	}

	m.mu.Lock()
	if m.activeItemUse != nil {
		m.mu.Unlock()
		return fmt.Errorf("clue_interaction: item use already in progress")
	}
	m.activeItemUse = &state
	m.startItemUseTimer(playerID, clueID)
	m.mu.Unlock()

	m.publishItemDeclared(playerID, clueID)
	return nil
}

func (m *ClueInteractionModule) handleItemUseTarget(ctx context.Context, playerID uuid.UUID, payload json.RawMessage) error {
	var p itemUseTargetPayload
	if err := json.Unmarshal(payload, &p); err != nil {
		return fmt.Errorf("clue_interaction: invalid clue:use_target payload: %w", err)
	}

	m.mu.RLock()
	if m.activeItemUse == nil {
		m.mu.RUnlock()
		return fmt.Errorf("clue_interaction: no active item use")
	}
	if m.activeItemUse.UserID != playerID {
		m.mu.RUnlock()
		return fmt.Errorf("clue_interaction: not the active item user")
	}
	state := *m.activeItemUse
	m.mu.RUnlock()

	return m.resolveItemUse(ctx, state, p.TargetPlayerID)
}

func (m *ClueInteractionModule) resolveItemUse(ctx context.Context, state ItemUseState, targetPlayerID string) error {
	var resolveErr error
	switch state.Effect {
	case clueEffectPeek:
		resolveErr = m.handlePeekEffect(ctx, state.UserID, state.ClueID, targetPlayerID)
	case clueEffectReveal:
		if state.Configured {
			resolveErr = m.handleRevealEffect(state.UserID, state.ClueID)
		} else {
			resolveErr = fmt.Errorf("clue_interaction: effect %q not implemented", state.Effect)
		}
	case clueEffectGrantClue:
		if state.Configured {
			resolveErr = m.handleGrantClueEffect(state.UserID, state.ClueID)
		} else {
			resolveErr = fmt.Errorf("clue_interaction: effect %q not implemented", state.Effect)
		}
	case "":
		resolveErr = fmt.Errorf("clue_interaction: effect not specified")
	default:
		resolveErr = fmt.Errorf("clue_interaction: effect %q not implemented", state.Effect)
	}
	if resolveErr != nil {
		return resolveErr
	}

	m.finishItemUse(state)
	m.deps.EventBus.Publish(engine.Event{
		Type: "clue.item_resolved",
		Payload: map[string]any{
			"playerId": state.UserID.String(),
			"clueId":   state.ClueID.String(),
			"effect":   state.Effect,
			"consumed": state.Consume,
		},
	})
	return nil
}

func (m *ClueInteractionModule) validateConfiguredItemUse(playerID uuid.UUID, clueID string, cfg ClueItemEffectConfig) error {
	if err := validateSingleClueItemEffectConfig(clueID, cfg); err != nil {
		return err
	}
	if !m.playerHasClue(playerID, clueID) {
		return fmt.Errorf("clue_interaction: player does not own clue %q", clueID)
	}
	return nil
}

func validateClueItemEffectConfig(effects map[string]ClueItemEffectConfig) error {
	for clueID, cfg := range effects {
		if _, err := uuid.Parse(clueID); err != nil {
			return fmt.Errorf("clue_interaction: invalid itemEffects clue id %q: %w", clueID, err)
		}
		if err := validateSingleClueItemEffectConfig(clueID, cfg); err != nil {
			return err
		}
	}
	return nil
}

func validateSingleClueItemEffectConfig(clueID string, cfg ClueItemEffectConfig) error {
	if cfg.Effect == "" {
		return fmt.Errorf("clue_interaction: item effect missing for clue %q", clueID)
	}
	if cfg.Effect != clueEffectReveal && cfg.Effect != clueEffectGrantClue && cfg.Effect != clueEffectPeek {
		return fmt.Errorf("clue_interaction: effect %q not implemented", cfg.Effect)
	}
	if cfg.Effect == clueEffectGrantClue && len(cfg.GrantClueIDs) == 0 {
		return fmt.Errorf("clue_interaction: grant_clue requires grantClueIds")
	}
	if cfg.Effect == clueEffectReveal && cfg.RevealText == "" {
		return fmt.Errorf("clue_interaction: reveal requires revealText")
	}
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

func (m *ClueInteractionModule) handleRevealEffect(playerID uuid.UUID, clueID uuid.UUID) error {
	cfg := m.config.ItemEffects[clueID.String()]
	m.mu.Lock()
	if m.revealedInfo[playerID] == nil {
		m.revealedInfo[playerID] = make(map[string]string)
	}
	m.revealedInfo[playerID][clueID.String()] = cfg.RevealText
	m.mu.Unlock()

	m.deps.EventBus.Publish(engine.Event{
		Type: "clue.reveal_result",
		Payload: map[string]any{
			"playerId":   playerID.String(),
			"clueId":     clueID.String(),
			"revealText": cfg.RevealText,
		},
	})
	return nil
}

func (m *ClueInteractionModule) handleGrantClueEffect(playerID uuid.UUID, clueID uuid.UUID) error {
	cfg := m.config.ItemEffects[clueID.String()]
	m.mu.Lock()
	granted := make([]string, 0, len(cfg.GrantClueIDs))
	for _, grantID := range cfg.GrantClueIDs {
		if grantID == "" || m.playerHasClueLocked(playerID, grantID) {
			continue
		}
		m.acquiredClues[playerID] = append(m.acquiredClues[playerID], grantID)
		granted = append(granted, grantID)
	}
	m.mu.Unlock()

	for _, grantID := range granted {
		m.deps.EventBus.Publish(engine.Event{
			Type: "clue.acquired",
			Payload: map[string]any{
				"playerId": playerID.String(),
				"clueId":   grantID,
				"source":   "clue_effect",
				"usedClue": clueID.String(),
			},
		})
	}
	m.deps.EventBus.Publish(engine.Event{
		Type: "clue.grant_result",
		Payload: map[string]any{
			"playerId":     playerID.String(),
			"clueId":       clueID.String(),
			"grantClueIds": granted,
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

func (m *ClueInteractionModule) startItemUseTimer(playerID uuid.UUID, clueID uuid.UUID) {
	m.itemTimeout = time.AfterFunc(30*time.Second, func() {
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
}

func (m *ClueInteractionModule) publishItemDeclared(playerID uuid.UUID, clueID uuid.UUID) {
	m.deps.EventBus.Publish(engine.Event{
		Type: "clue.item_declared",
		Payload: map[string]any{
			"playerId": playerID.String(),
			"clueId":   clueID.String(),
		},
	})
}

func (m *ClueInteractionModule) finishItemUse(state ItemUseState) {
	m.mu.Lock()
	defer m.mu.Unlock()
	if m.activeItemUse != nil && m.activeItemUse.ClueID == state.ClueID {
		if m.itemTimeout != nil {
			m.itemTimeout.Stop()
			m.itemTimeout = nil
		}
		m.activeItemUse = nil
	}
	m.usedItems[state.UserID] = append(m.usedItems[state.UserID], state.ClueID)
	if state.Consume {
		m.removePlayerClueLocked(state.UserID, state.ClueID.String())
	}
}

func (m *ClueInteractionModule) playerHasClue(playerID uuid.UUID, clueID string) bool {
	m.mu.RLock()
	defer m.mu.RUnlock()
	return m.playerHasClueLocked(playerID, clueID)
}

func (m *ClueInteractionModule) playerUsedItem(playerID uuid.UUID, clueID uuid.UUID) bool {
	m.mu.RLock()
	defer m.mu.RUnlock()
	for _, usedID := range m.usedItems[playerID] {
		if usedID == clueID {
			return true
		}
	}
	return false
}

func (m *ClueInteractionModule) playerHasClueLocked(playerID uuid.UUID, clueID string) bool {
	for _, ownedID := range m.acquiredClues[playerID] {
		if ownedID == clueID {
			return true
		}
	}
	return false
}

func (m *ClueInteractionModule) removePlayerClueLocked(playerID uuid.UUID, clueID string) {
	clues := m.acquiredClues[playerID]
	for i, ownedID := range clues {
		if ownedID == clueID {
			m.acquiredClues[playerID] = append(clues[:i], clues[i+1:]...)
			return
		}
	}
}
