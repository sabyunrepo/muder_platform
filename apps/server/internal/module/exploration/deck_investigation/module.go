package deck_investigation

import (
	"context"
	"encoding/json"
	"fmt"
	"sync"

	"github.com/google/uuid"

	"github.com/mmp-platform/server/internal/engine"
)

func init() {
	engine.Register("deck_investigation", func() engine.Module { return NewModule() })
}

type Module struct {
	engine.PublicStateMarker

	mu                  sync.RWMutex
	deps                engine.ModuleDeps
	config              Config
	defaultTokenAmounts map[string]int
	balancesByCharacter map[string]map[string]int
}

func NewModule() *Module {
	return &Module{}
}

func (m *Module) Name() string { return "deck_investigation" }

func (m *Module) Init(ctx context.Context, deps engine.ModuleDeps, config json.RawMessage) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	m.deps = deps
	m.config = Config{}
	if len(config) > 0 {
		if err := json.Unmarshal(config, &m.config); err != nil {
			return fmt.Errorf("deck_investigation: invalid config: %w", err)
		}
	}
	if err := ValidateConfig(m.config); err != nil {
		return err
	}

	m.defaultTokenAmounts = make(map[string]int, len(m.config.Tokens))
	for _, token := range m.config.Tokens {
		m.defaultTokenAmounts[token.ID] = token.DefaultAmount
	}
	m.balancesByCharacter = map[string]map[string]int{}
	m.ensureRosterLocked(ctx)
	return nil
}

func (m *Module) BuildState() (json.RawMessage, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	state := map[string]any{
		"tokens": map[string]any{
			"byCharacter": cloneBalances(m.balancesByCharacter),
		},
	}
	return json.Marshal(state)
}

func (m *Module) HandleMessage(_ context.Context, _ uuid.UUID, _ string, _ json.RawMessage) error {
	return fmt.Errorf("deck_investigation: no direct messages supported")
}

func (m *Module) Cleanup(_ context.Context) error { return nil }

func (m *Module) SupportedActions() []engine.PhaseAction {
	return []engine.PhaseAction{
		engine.ActionGrantInvestigationToken,
		engine.ActionResetInvestigationToken,
	}
}

func (m *Module) ReactTo(ctx context.Context, action engine.PhaseActionPayload) error {
	switch action.Action {
	case engine.ActionGrantInvestigationToken:
		var params investigationTokenActionParams
		if err := json.Unmarshal(action.Params, &params); err != nil {
			return fmt.Errorf("deck_investigation: invalid GRANT_INVESTIGATION_TOKEN params: %w", err)
		}
		if params.Amount <= 0 {
			return fmt.Errorf("deck_investigation: amount must be positive, got %d", params.Amount)
		}
		return m.applyTokenAction(ctx, params, func(current, _ int) int {
			return current + params.Amount
		})
	case engine.ActionResetInvestigationToken:
		var params investigationTokenActionParams
		if err := json.Unmarshal(action.Params, &params); err != nil {
			return fmt.Errorf("deck_investigation: invalid RESET_INVESTIGATION_TOKEN params: %w", err)
		}
		resetAmount := func(_ int, defaultAmount int) int {
			return defaultAmount
		}
		switch params.Mode {
		case "", investigationTokenResetModeDefault:
		case investigationTokenResetModeZero:
			resetAmount = func(_ int, _ int) int {
				return 0
			}
		default:
			return fmt.Errorf("deck_investigation: unsupported reset mode %q", params.Mode)
		}
		return m.applyTokenAction(ctx, params, resetAmount)
	default:
		return fmt.Errorf("deck_investigation: unsupported action %q", action.Action)
	}
}

const (
	investigationTokenResetModeDefault = "default"
	investigationTokenResetModeZero    = "zero"
)

type investigationTokenActionParams struct {
	TokenID string                 `json:"tokenId"`
	Amount  int                    `json:"amount,omitempty"`
	Mode    string                 `json:"mode,omitempty"`
	Target  map[string]interface{} `json:"target,omitempty"`
}

func (m *Module) applyTokenAction(
	ctx context.Context,
	params investigationTokenActionParams,
	nextAmount func(current int, defaultAmount int) int,
) error {
	if params.TokenID == "" {
		return fmt.Errorf("deck_investigation: tokenId is required")
	}
	defaultAmount, ok := m.defaultTokenAmounts[params.TokenID]
	if !ok {
		return fmt.Errorf("deck_investigation: unknown token %q", params.TokenID)
	}

	m.mu.Lock()
	defer m.mu.Unlock()

	targets := m.resolveTargetCharacterIDsLocked(ctx, params.Target)
	for _, characterID := range targets {
		m.ensureCharacterLocked(characterID)
		m.balancesByCharacter[characterID][params.TokenID] = nextAmount(
			m.balancesByCharacter[characterID][params.TokenID],
			defaultAmount,
		)
	}
	m.publishTokenChangedLocked(params.TokenID, targets)
	return nil
}

func (m *Module) resolveTargetCharacterIDsLocked(ctx context.Context, target map[string]interface{}) []string {
	targetType, _ := target["type"].(string)
	if targetType == "character" {
		if characterID, _ := target["character_id"].(string); characterID != "" {
			return []string{characterID}
		}
		if characterID, _ := target["characterId"].(string); characterID != "" {
			return []string{characterID}
		}
	}

	m.ensureRosterLocked(ctx)
	targets := make([]string, 0, len(m.balancesByCharacter))
	for characterID := range m.balancesByCharacter {
		targets = append(targets, characterID)
	}
	return targets
}

func (m *Module) ensureRosterLocked(ctx context.Context) {
	rosterProvider, ok := m.deps.PlayerInfoProvider.(engine.PlayerRuntimeRosterProvider)
	if !ok {
		return
	}
	for _, player := range rosterProvider.PlayerRuntimeRoster(ctx) {
		characterID := player.TargetCode
		if characterID == "" {
			characterID = player.PlayerID.String()
		}
		m.ensureCharacterLocked(characterID)
	}
}

func (m *Module) ensureCharacterLocked(characterID string) {
	if characterID == "" {
		return
	}
	if _, ok := m.balancesByCharacter[characterID]; !ok {
		m.balancesByCharacter[characterID] = make(map[string]int, len(m.defaultTokenAmounts))
		for tokenID, amount := range m.defaultTokenAmounts {
			m.balancesByCharacter[characterID][tokenID] = amount
		}
	}
}

func (m *Module) publishTokenChangedLocked(tokenID string, characterIDs []string) {
	if m.deps.EventBus == nil {
		return
	}
	m.deps.EventBus.Publish(engine.Event{
		Type: "deck_investigation.tokens_changed",
		Payload: map[string]any{
			"tokenId":      tokenID,
			"characterIds": append([]string(nil), characterIDs...),
		},
	})
}

func cloneBalances(source map[string]map[string]int) map[string]map[string]int {
	clone := make(map[string]map[string]int, len(source))
	for characterID, balances := range source {
		clone[characterID] = make(map[string]int, len(balances))
		for tokenID, amount := range balances {
			clone[characterID][tokenID] = amount
		}
	}
	return clone
}

var (
	_ engine.Module       = (*Module)(nil)
	_ engine.PhaseReactor = (*Module)(nil)
)
