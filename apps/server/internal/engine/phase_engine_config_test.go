package engine

import (
	"context"
	"encoding/json"
	"testing"

	"github.com/google/uuid"
)

func TestPhaseEngine_NilAuditLogger(t *testing.T) {
	// Passing nil audit logger should not panic — uses noopAuditLogger.
	logger := &testLogger{t}
	bus := NewEventBus(logger)
	pe := NewPhaseEngine(uuid.New(), nil, bus, nil, logger, testPhaseDefinitions)

	ctx := context.Background()
	if err := pe.Start(ctx, nil); err != nil {
		t.Fatal(err)
	}
	pe.Stop(ctx)
}

func TestPhaseEngine_ModuleConfigPassedToInit(t *testing.T) {
	var receivedConfig json.RawMessage
	mod := &configCapture{stubCoreModule: stubCoreModule{name: "cfg_mod"}, onInit: func(cfg json.RawMessage) {
		receivedConfig = cfg
	}}
	pe, _ := newTestPhaseEngine(t, []Module{mod}, testPhaseDefinitions)

	configs := map[string]json.RawMessage{
		"cfg_mod": json.RawMessage(`{"key":"value"}`),
	}
	if err := pe.Start(context.Background(), configs); err != nil {
		t.Fatal(err)
	}
	defer pe.Stop(context.Background())

	if string(receivedConfig) != `{"key":"value"}` {
		t.Fatalf("expected config passed through, got %s", receivedConfig)
	}
}

// configCapture is a stub that captures the config passed to Init.
type configCapture struct {
	stubCoreModule
	onInit func(json.RawMessage)
}

func (c *configCapture) Init(ctx context.Context, deps ModuleDeps, config json.RawMessage) error {
	if c.onInit != nil {
		c.onInit(config)
	}
	return c.stubCoreModule.Init(ctx, deps, config)
}
