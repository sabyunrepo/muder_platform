package e2e_test

import (
	"context"
	"encoding/json"
	"testing"

	"github.com/google/uuid"
	"github.com/mmp-platform/server/internal/engine"
	"github.com/mmp-platform/server/internal/template"
	_ "github.com/mmp-platform/server/internal/module" // registers all modules via init()
)

// noopLogger satisfies engine.Logger with no output.
type noopLogger struct{}

func (noopLogger) Printf(string, ...any) {}

// smokeHarness wraps a PhaseEngine loaded from a template for smoke testing.
type smokeHarness struct {
	t       *testing.T
	eng     *engine.PhaseEngine
	bus     *engine.EventBus
	players []uuid.UUID
}

// newSmokeHarness loads a template, creates all modules, and starts the engine.
func newSmokeHarness(t *testing.T, templateID string, playerCount int) *smokeHarness {
	t.Helper()

	loader := template.NewLoader()
	tmpl, err := loader.Load(templateID)
	if err != nil {
		t.Fatalf("load template %q: %v", templateID, err)
	}

	// Create module instances from the template.
	moduleNames := make([]string, len(tmpl.Modules))
	for i, m := range tmpl.Modules {
		moduleNames[i] = m.ID
	}
	modules, err := engine.CreateModulesBatch(moduleNames)
	if err != nil {
		t.Fatalf("create modules for %q: %v", templateID, err)
	}

	// Convert template phases to PhaseDefinition.
	phases := make([]engine.PhaseDefinition, len(tmpl.Phases))
	for i, p := range tmpl.Phases {
		phases[i] = engine.PhaseDefinition{
			ID:   engine.Phase(p.ID),
			Name: p.Name,
		}
	}

	// Build module configs map.
	moduleConfigs := make(map[string]json.RawMessage, len(tmpl.Modules))
	for _, m := range tmpl.Modules {
		moduleConfigs[m.ID] = m.Config
	}

	// Create players.
	players := make([]uuid.UUID, playerCount)
	for i := range players {
		players[i] = uuid.New()
	}

	log := noopLogger{}
	bus := engine.NewEventBus(log)
	sessionID := uuid.New()

	eng := engine.NewPhaseEngine(sessionID, modules, bus, nil, log, phases)

	if err := eng.Start(context.Background(), moduleConfigs); err != nil {
		t.Fatalf("engine Start: %v", err)
	}

	return &smokeHarness{
		t:       t,
		eng:     eng,
		bus:     bus,
		players: players,
	}
}

// advanceAllPhases advances through every phase until the engine signals completion.
func (h *smokeHarness) advanceAllPhases(ctx context.Context) {
	h.t.Helper()
	for {
		hasNext, err := h.eng.AdvancePhase(ctx)
		if err != nil {
			h.t.Fatalf("AdvancePhase: %v", err)
		}
		if !hasNext {
			return
		}
	}
}

// sendMessage routes a player action to the named module.
func (h *smokeHarness) sendMessage(ctx context.Context, playerIdx int, moduleName string, msgType string, payload any) error {
	if playerIdx < 0 || playerIdx >= len(h.players) {
		h.t.Fatalf("player index %d out of range", playerIdx)
	}
	raw, err := json.Marshal(payload)
	if err != nil {
		return err
	}
	return h.eng.HandleMessage(ctx, h.players[playerIdx], moduleName, msgType, raw)
}

// stop shuts down the engine and fails the test on error.
func (h *smokeHarness) stop(ctx context.Context) {
	h.t.Helper()
	if err := h.eng.Stop(ctx); err != nil {
		h.t.Fatalf("engine Stop: %v", err)
	}
}
