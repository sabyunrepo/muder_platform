package engine

import (
	"context"
	"encoding/json"
	"errors"
	"testing"

	"github.com/mmp-platform/server/internal/apperror"
)

// --- helpers ---

type passingValidator struct{}

func (passingValidator) Validate(_ context.Context, _ GameEvent, _ ValidationState) error {
	return nil
}

type failingValidator struct{ err error }

func (f failingValidator) Validate(_ context.Context, _ GameEvent, _ ValidationState) error {
	return f.err
}

type countingValidator struct {
	called *int
	err    error
}

func (c countingValidator) Validate(_ context.Context, _ GameEvent, _ ValidationState) error {
	*c.called++
	return c.err
}

// valStubPlugin satisfies the Plugin interface (Core 7) for ModuleValidator tests.
type valStubPlugin struct{ name string }

func (s *valStubPlugin) ID() string                         { return s.name }
func (s *valStubPlugin) Name() string                       { return s.name }
func (s *valStubPlugin) Version() string                    { return "1.0.0" }
func (s *valStubPlugin) GetConfigSchema() json.RawMessage   { return json.RawMessage(`{}`) }
func (s *valStubPlugin) DefaultConfig() json.RawMessage     { return json.RawMessage(`{}`) }
func (s *valStubPlugin) Init(_ context.Context, _ json.RawMessage) error { return nil }
func (s *valStubPlugin) Cleanup(_ context.Context) error    { return nil }

// valStubValidator is a Plugin that also implements EventValidator.
type valStubValidator struct {
	valStubPlugin
	err error
}

func (s *valStubValidator) ValidateEvent(_ context.Context, _ GameEvent, _ ValidationState) error {
	return s.err
}

// --- Chain tests ---

func TestChain_Empty(t *testing.T) {
	c := Chain{}
	if err := c.Validate(context.Background(), GameEvent{}, ValidationState{}); err != nil {
		t.Fatalf("empty chain should return nil, got %v", err)
	}
}

func TestChain_AllPass(t *testing.T) {
	c := Chain{passingValidator{}, passingValidator{}, passingValidator{}}
	if err := c.Validate(context.Background(), GameEvent{}, ValidationState{}); err != nil {
		t.Fatalf("all-pass chain should return nil, got %v", err)
	}
}

func TestChain_ShortCircuit(t *testing.T) {
	third := 0
	c := Chain{
		passingValidator{},
		failingValidator{err: apperror.BadRequest("second fails")},
		countingValidator{called: &third},
	}
	err := c.Validate(context.Background(), GameEvent{}, ValidationState{})
	if err == nil {
		t.Fatal("expected error from second validator")
	}
	if third != 0 {
		t.Fatalf("third validator should not have been called, called %d times", third)
	}
	var ae *apperror.AppError
	if !errors.As(err, &ae) {
		t.Fatalf("expected *apperror.AppError, got %T", err)
	}
}

func TestChain_ContextCancelled(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	c := Chain{passingValidator{}}
	err := c.Validate(ctx, GameEvent{}, ValidationState{})
	if err == nil {
		t.Fatal("expected error on cancelled ctx")
	}
	var ae *apperror.AppError
	if !errors.As(err, &ae) {
		t.Fatalf("expected *apperror.AppError wrapping ctx error, got %T", err)
	}
}

func TestChain_WrapsNonAppError(t *testing.T) {
	c := Chain{failingValidator{err: errors.New("raw error")}}
	err := c.Validate(context.Background(), GameEvent{}, ValidationState{})
	var ae *apperror.AppError
	if !errors.As(err, &ae) {
		t.Fatalf("expected raw error wrapped in AppError, got %T", err)
	}
}

// --- PhaseValidator tests ---

func TestPhaseValidator_AllowedAction(t *testing.T) {
	v := PhaseValidator{}
	state := ValidationState{
		Phase:             "voting",
		AllowedEventTypes: []string{"vote.cast", "vote.skip"},
	}
	if err := v.Validate(context.Background(), GameEvent{Type: "vote.cast"}, state); err != nil {
		t.Fatalf("allowed action should pass, got %v", err)
	}
}

func TestPhaseValidator_DisallowedAction(t *testing.T) {
	v := PhaseValidator{}
	state := ValidationState{
		Phase:             "voting",
		AllowedEventTypes: []string{"vote.cast"},
	}
	err := v.Validate(context.Background(), GameEvent{Type: "chat.send"}, state)
	if err == nil {
		t.Fatal("disallowed action should fail")
	}
	var ae *apperror.AppError
	if !errors.As(err, &ae) {
		t.Fatalf("expected *apperror.AppError, got %T", err)
	}
}

func TestPhaseValidator_EmptyAllowedMeansOpen(t *testing.T) {
	v := PhaseValidator{}
	state := ValidationState{Phase: "freeplay", AllowedEventTypes: nil}
	if err := v.Validate(context.Background(), GameEvent{Type: "anything"}, state); err != nil {
		t.Fatalf("empty allowed list = open phase, got %v", err)
	}
}

// --- PlayerValidator tests ---

func TestPlayerValidator_Stub(t *testing.T) {
	v := PlayerValidator{}
	if err := v.Validate(context.Background(), GameEvent{}, ValidationState{}); err != nil {
		t.Fatalf("stub should always pass, got %v", err)
	}
}

// --- ModuleValidator tests ---

func TestModuleValidator_NoModules(t *testing.T) {
	v := ModuleValidator{}
	state := ValidationState{Modules: map[string]Plugin{}}
	if err := v.Validate(context.Background(), GameEvent{}, state); err != nil {
		t.Fatalf("no modules should pass, got %v", err)
	}
}

func TestModuleValidator_SkipsNonEventValidator(t *testing.T) {
	v := ModuleValidator{}
	state := ValidationState{
		Modules: map[string]Plugin{"plain": &valStubPlugin{name: "plain"}},
	}
	if err := v.Validate(context.Background(), GameEvent{}, state); err != nil {
		t.Fatalf("module without EventValidator should be skipped, got %v", err)
	}
}

func TestModuleValidator_EventValidator_Pass(t *testing.T) {
	v := ModuleValidator{}
	mod := &valStubValidator{valStubPlugin: valStubPlugin{name: "ev"}, err: nil}
	state := ValidationState{Modules: map[string]Plugin{"ev": mod}}
	if err := v.Validate(context.Background(), GameEvent{Type: "test"}, state); err != nil {
		t.Fatalf("passing EventValidator should return nil, got %v", err)
	}
}

func TestModuleValidator_EventValidator_Fail(t *testing.T) {
	v := ModuleValidator{}
	appErr := apperror.BadRequest("module rejects event")
	mod := &valStubValidator{valStubPlugin: valStubPlugin{name: "ev"}, err: appErr}
	state := ValidationState{Modules: map[string]Plugin{"ev": mod}}
	err := v.Validate(context.Background(), GameEvent{Type: "test"}, state)
	if err == nil {
		t.Fatal("expected error from EventValidator module")
	}
	var ae *apperror.AppError
	if !errors.As(err, &ae) {
		t.Fatalf("expected *apperror.AppError, got %T: %v", err, err)
	}
}
