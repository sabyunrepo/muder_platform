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
	clueEffectDescriptionChange = "description_change"
	clueEffectPeek              = "peek"
	clueEffectSteal             = "steal"
	clueEffectReveal            = "reveal"
	clueEffectGrantClue         = "grant_clue"
	clueEffectKill              = "kill"
)

// ClueItemEffectConfig is the runtime-owned contract for configured clue use.
// Editor labels are mapped to this contract by adapters; the engine executes
// only this typed shape and never trusts client-side labels as runtime truth.
type ClueItemEffectConfig struct {
	Effect          string   `json:"effect"`
	Target          string   `json:"target,omitempty"`
	Consume         bool     `json:"consume"`
	DescriptionText string   `json:"descriptionText,omitempty"`
	RevealText      string   `json:"revealText,omitempty"`
	GrantClueIDs    []string `json:"grantClueIds,omitempty"`
	AttackPower     int      `json:"attackPower,omitempty"`
	DefensePower    int      `json:"defensePower,omitempty"`
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

	if state.Configured && (state.Target == "self" || state.Effect == clueEffectReveal || state.Effect == clueEffectGrantClue || state.Effect == clueEffectDescriptionChange) {
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
	case clueEffectSteal:
		resolveErr = m.handleStealEffect(state.UserID, state.ClueID, targetPlayerID)
	case clueEffectDescriptionChange:
		if state.Configured {
			resolveErr = m.handleDescriptionChangeEffect(state.UserID, state.ClueID)
		} else {
			resolveErr = fmt.Errorf("clue_interaction: effect %q not implemented", state.Effect)
		}
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
	case clueEffectKill:
		if state.Configured {
			resolveErr = m.handleKillEffect(ctx, state.UserID, state.ClueID, targetPlayerID)
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

	m.finishItemUse(ctx, state)
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
	if cfg.Effect != clueEffectDescriptionChange && cfg.Effect != clueEffectReveal && cfg.Effect != clueEffectGrantClue && cfg.Effect != clueEffectPeek && cfg.Effect != clueEffectSteal && cfg.Effect != clueEffectKill {
		return fmt.Errorf("clue_interaction: effect %q not implemented", cfg.Effect)
	}
	if cfg.Effect == clueEffectDescriptionChange && cfg.DescriptionText == "" {
		return fmt.Errorf("clue_interaction: description_change requires descriptionText")
	}
	if cfg.Effect == clueEffectGrantClue && len(cfg.GrantClueIDs) == 0 {
		return fmt.Errorf("clue_interaction: grant_clue requires grantClueIds")
	}
	if cfg.Effect == clueEffectReveal && cfg.RevealText == "" {
		return fmt.Errorf("clue_interaction: reveal requires revealText")
	}
	if cfg.Effect == clueEffectKill && cfg.Target != "player" {
		return fmt.Errorf("clue_interaction: kill requires player target")
	}
	if cfg.AttackPower < 0 {
		return fmt.Errorf("clue_interaction: attackPower must be non-negative")
	}
	if cfg.DefensePower < 0 {
		return fmt.Errorf("clue_interaction: defensePower must be non-negative")
	}
	return nil
}

func (m *ClueInteractionModule) handlePeekEffect(_ context.Context, _ uuid.UUID, _ uuid.UUID, targetPlayerIDStr string) error {
	targetPlayerID, err := uuid.Parse(targetPlayerIDStr)
	if err != nil {
		return fmt.Errorf("clue_interaction: invalid targetPlayerId: %w", err)
	}

	m.mu.RLock()
	clues := m.visibleTargetCluesLocked(targetPlayerID)
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

func (m *ClueInteractionModule) handleStealEffect(playerID uuid.UUID, usedClueID uuid.UUID, targetPlayerIDStr string) error {
	targetPlayerID, err := uuid.Parse(targetPlayerIDStr)
	if err != nil {
		return fmt.Errorf("clue_interaction: invalid targetPlayerId: %w", err)
	}

	m.mu.Lock()
	targetClues := m.visibleTargetCluesLocked(targetPlayerID)
	if len(targetClues) == 0 {
		m.mu.Unlock()
		return fmt.Errorf("clue_interaction: target has no stealable clues")
	}
	stolenClueID := targetClues[0]
	m.removePlayerClueLocked(targetPlayerID, stolenClueID)
	if !m.playerHasClueLocked(playerID, stolenClueID) {
		m.acquiredClues[playerID] = append(m.acquiredClues[playerID], stolenClueID)
	}
	m.mu.Unlock()

	m.deps.EventBus.Publish(engine.Event{
		Type: "clue.steal_result",
		Payload: map[string]any{
			"playerId":       playerID.String(),
			"targetPlayerId": targetPlayerID.String(),
			"clueId":         stolenClueID,
			"usedClue":       usedClueID.String(),
		},
	})
	m.deps.EventBus.Publish(engine.Event{
		Type: "clue.acquired",
		Payload: map[string]any{
			"playerId": playerID.String(),
			"clueId":   stolenClueID,
			"source":   "clue_steal",
			"usedClue": usedClueID.String(),
		},
	})
	return nil
}

func (m *ClueInteractionModule) handleDescriptionChangeEffect(playerID uuid.UUID, clueID uuid.UUID) error {
	cfg := m.config.ItemEffects[clueID.String()]
	m.mu.Lock()
	if m.changedDescriptions[playerID] == nil {
		m.changedDescriptions[playerID] = make(map[string]string)
	}
	m.changedDescriptions[playerID][clueID.String()] = cfg.DescriptionText
	m.mu.Unlock()

	m.deps.EventBus.Publish(engine.Event{
		Type: "clue.description_changed",
		Payload: map[string]any{
			"playerId":        playerID.String(),
			"clueId":          clueID.String(),
			"descriptionText": cfg.DescriptionText,
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

func (m *ClueInteractionModule) handleKillEffect(ctx context.Context, playerID uuid.UUID, clueID uuid.UUID, targetPlayerIDStr string) error {
	if m.deps.PlayerStatusController == nil {
		return fmt.Errorf("clue_interaction: player status controller is not configured")
	}

	targetPlayerID, err := uuid.Parse(targetPlayerIDStr)
	if err != nil {
		return fmt.Errorf("clue_interaction: invalid targetPlayerId: %w", err)
	}
	if err := m.validateKillableTarget(ctx, targetPlayerID); err != nil {
		return err
	}
	result, err := m.resolveKillPower(ctx, playerID, targetPlayerID)
	if err != nil {
		return err
	}
	if !result.Allowed {
		m.deps.EventBus.Publish(engine.Event{
			Type: "clue.kill_failed",
			Payload: map[string]any{
				"playerId":             playerID.String(),
				"targetPlayerId":       targetPlayerID.String(),
				"clueId":               clueID.String(),
				"reason":               result.Reason,
				"killResolutionMode":   result.Mode,
				"resolvedAttackPower":  result.AttackPower,
				"resolvedDefensePower": result.DefensePower,
			},
		})
		return nil
	}

	_, err = m.deps.PlayerStatusController.ApplyPlayerStatus(ctx, engine.PlayerStatusAction{
		ActorID:  playerID,
		TargetID: targetPlayerID,
		IsAlive:  false,
		Reason:   "clue_kill_effect",
		Source:   "clue_interaction",
		ClueID:   clueID,
	})
	if err != nil {
		return fmt.Errorf("clue_interaction: kill effect failed: %w", err)
	}
	m.deps.EventBus.Publish(engine.Event{
		Type: "clue.kill_requested",
		Payload: map[string]any{
			"playerId":             playerID.String(),
			"targetPlayerId":       targetPlayerID.String(),
			"clueId":               clueID.String(),
			"killResolutionMode":   result.Mode,
			"resolvedAttackPower":  result.AttackPower,
			"resolvedDefensePower": result.DefensePower,
		},
	})
	return nil
}

type killPowerResult struct {
	Allowed      bool
	Reason       string
	Mode         string
	AttackPower  int
	DefensePower int
}

func (m *ClueInteractionModule) resolveKillPower(ctx context.Context, attackerID uuid.UUID, targetID uuid.UUID) (killPowerResult, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	mode := m.playerKillConfig.KillResolutionMode
	if mode == "" {
		mode = KillResolutionAllWeaponsVsAllArmor
	}
	result := killPowerResult{Mode: mode}
	if !m.playerKillEnabled || !m.currentSceneAllowsKillLocked() {
		result.Reason = "scene_not_allowed"
		return result, nil
	}

	weapons := m.playerPowerValuesLocked(ctx, attackerID, true)
	armor := m.playerPowerValuesLocked(ctx, targetID, false)
	result.AttackPower = resolveAttackPower(mode, weapons)
	result.DefensePower = resolveDefensePower(mode, armor)
	result.Allowed = result.AttackPower > result.DefensePower
	if !result.Allowed {
		result.Reason = "attack_not_greater_than_defense"
	}
	return result, nil
}

func (m *ClueInteractionModule) currentSceneAllowsKillLocked() bool {
	if len(m.playerKillConfig.AllowedSceneIDs) == 0 {
		return false
	}
	for _, sceneID := range m.playerKillConfig.AllowedSceneIDs {
		if sceneID == m.currentPhaseID {
			return true
		}
	}
	return false
}

func resolveAttackPower(mode string, values []int) int {
	switch mode {
	case KillResolutionBestWeaponVsAllArmor, KillResolutionBestWeaponVsBestArmor:
		return maxPower(values)
	default:
		return sumPower(values)
	}
}

func resolveDefensePower(mode string, values []int) int {
	switch mode {
	case KillResolutionBestWeaponVsBestArmor:
		return maxPower(values)
	default:
		return sumPower(values)
	}
}

func sumPower(values []int) int {
	total := 0
	for _, value := range values {
		total += value
	}
	return total
}

func maxPower(values []int) int {
	max := 0
	for _, value := range values {
		if value > max {
			max = value
		}
	}
	return max
}

func (m *ClueInteractionModule) playerPowerValuesLocked(ctx context.Context, playerID uuid.UUID, attack bool) []int {
	clueIDs := m.playerInventoryCluesLocked(ctx, playerID)
	values := make([]int, 0, len(clueIDs))
	for _, clueID := range clueIDs {
		cfg, ok := m.config.ItemEffects[clueID]
		if !ok {
			continue
		}
		value := cfg.DefensePower
		if attack {
			value = cfg.AttackPower
		}
		if value > 0 {
			values = append(values, value)
		}
	}
	return values
}

func (m *ClueInteractionModule) playerInventoryCluesLocked(ctx context.Context, playerID uuid.UUID) []string {
	clues := mergeClueList(m.acquiredClues[playerID], m.allPlayerClues)
	if m.deps.PlayerInfoProvider != nil {
		if info, ok := m.deps.PlayerInfoProvider.PlayerRuntimeInfo(ctx, playerID); ok {
			clues = mergeClueList(clues, m.targetCodeClues[info.TargetCode])
		}
	}
	return mergeClueList(clues, m.targetCodeClues[playerID.String()])
}

func (m *ClueInteractionModule) validateKillableTarget(ctx context.Context, targetPlayerID uuid.UUID) error {
	if len(m.playerKillConfig.KillableCharacterIDs) == 0 {
		return nil
	}
	if m.deps.PlayerInfoProvider == nil {
		return fmt.Errorf("clue_interaction: player info provider is required for player_kill targets")
	}
	targetInfo, ok := m.deps.PlayerInfoProvider.PlayerRuntimeInfo(ctx, targetPlayerID)
	if !ok {
		return fmt.Errorf("clue_interaction: target player not found")
	}
	for _, characterID := range m.playerKillConfig.KillableCharacterIDs {
		if characterID == targetInfo.TargetCode || characterID == targetPlayerID.String() {
			return nil
		}
	}
	return fmt.Errorf("clue_interaction: target is not killable")
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

func (m *ClueInteractionModule) finishItemUse(ctx context.Context, state ItemUseState) {
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
		m.removeConsumedClueLocked(ctx, state.UserID, state.ClueID.String())
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

func (m *ClueInteractionModule) visibleTargetCluesLocked(playerID uuid.UUID) []string {
	clues := m.acquiredClues[playerID]
	out := make([]string, 0, len(clues))
	for _, clueID := range clues {
		if !m.isProtectedClue(clueID) {
			out = append(out, clueID)
		}
	}
	return out
}

func (m *ClueInteractionModule) isProtectedClue(clueID string) bool {
	return m.config.CluePolicies[clueID].Protected
}

func (m *ClueInteractionModule) removePlayerClueLocked(playerID uuid.UUID, clueID string) {
	m.acquiredClues[playerID] = removeClueID(m.acquiredClues[playerID], clueID)
}

func (m *ClueInteractionModule) removeConsumedClueLocked(ctx context.Context, playerID uuid.UUID, clueID string) {
	m.removePlayerClueLocked(playerID, clueID)
	m.allPlayerClues = removeClueID(m.allPlayerClues, clueID)

	playerKey := playerID.String()
	m.targetCodeClues[playerKey] = removeClueID(m.targetCodeClues[playerKey], clueID)
	if len(m.targetCodeClues[playerKey]) == 0 {
		delete(m.targetCodeClues, playerKey)
	}

	if m.deps.PlayerInfoProvider == nil {
		return
	}
	if info, ok := m.deps.PlayerInfoProvider.PlayerRuntimeInfo(ctx, playerID); ok {
		m.targetCodeClues[info.TargetCode] = removeClueID(m.targetCodeClues[info.TargetCode], clueID)
		if len(m.targetCodeClues[info.TargetCode]) == 0 {
			delete(m.targetCodeClues, info.TargetCode)
		}
	}
}

func removeClueID(clues []string, clueID string) []string {
	out := clues[:0]
	for _, ownedID := range clues {
		if ownedID != clueID {
			out = append(out, ownedID)
		}
	}
	return out
}
