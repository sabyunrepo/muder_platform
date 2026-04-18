package trade_clue

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/mmp-platform/server/internal/engine"
)

// --- PhaseReactor ---

// ReactTo handles the ALLOW_EXCHANGE phase action that gates trade/show
// behaviour. Any other action is surfaced as an error so unexpected wiring
// is caught during development.
func (m *TradeClueModule) ReactTo(_ context.Context, action engine.PhaseActionPayload) error {
	switch action.Action {
	case engine.ActionAllowExchange:
		var params struct {
			Allowed bool `json:"allowed"`
		}
		// Default to true if no params provided.
		params.Allowed = true
		if action.Params != nil && len(action.Params) > 0 {
			if err := json.Unmarshal(action.Params, &params); err != nil {
				return fmt.Errorf("trade_clue: invalid ALLOW_EXCHANGE params: %w", err)
			}
		}
		m.mu.Lock()
		m.exchangeAllowed = params.Allowed
		m.mu.Unlock()
		return nil
	default:
		return fmt.Errorf("trade_clue: unsupported action %q", action.Action)
	}
}

// SupportedActions reports the phase actions this module reacts to.
func (m *TradeClueModule) SupportedActions() []engine.PhaseAction {
	return []engine.PhaseAction{engine.ActionAllowExchange}
}
