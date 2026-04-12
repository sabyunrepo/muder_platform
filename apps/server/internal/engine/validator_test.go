package engine

import (
	"context"
	"encoding/json"
	"errors"
	"testing"

	"github.com/google/uuid"
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

// valStubModule satisfies the Module interface for ModuleValidator tests.
type valStubModule struct{ name string }

func (s *valStubModule) Name() string { return s.name }
func (s *valStubModule) Init(_ context.Context, _ ModuleDeps, _ json.RawMessage) error {
	return nil
}
func (s *valStubModule) BuildState() (json.RawMessage, error) {
	return json.Marshal(map[string]string{"name": s.name})
}
func (s *valStubModule) HandleMessage(_ context.Context, _ uuid.UUID, _ string, _ json.RawMessage) error {
	return nil
}
func (s *valStubModule) Cleanup(_ context.Context) error { return nil }

// valStubValidator is a Module that also implements EventValidator.
type valStubValidator struct {
	valStubModule
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
	state := ValidationState{Modules: map[string]Module{}}
	if err := v.Validate(context.Background(), GameEvent{}, state); err != nil {
		t.Fatalf("no modules should pass, got %v", err)
	}
}

func TestModuleValidator_SkipsNonEventValidator(t *testing.T) {
	v := ModuleValidator{}
	state := ValidationState{
		Modules: map[string]Module{"plain": &valStubModule{name: "plain"}},
	}
	if err := v.Validate(context.Background(), GameEvent{}, state); err != nil {
		t.Fatalf("module without EventValidator should be skipped, got %v", err)
	}
}

func TestModuleValidator_EventValidator_Pass(t *testing.T) {
	v := ModuleValidator{}
	mod := &valStubValidator{valStubModule: valStubModule{name: "ev"}, err: nil}
	state := ValidationState{Modules: map[string]Module{"ev": mod}}
	if err := v.Validate(context.Background(), GameEvent{Type: "test"}, state); err != nil {
		t.Fatalf("passing EventValidator should return nil, got %v", err)
	}
}

func TestModuleValidator_EventValidator_Fail(t *testing.T) {
	v := ModuleValidator{}
	appErr := apperror.BadRequest("module rejects event")
	mod := &valStubValidator{valStubModule: valStubModule{name: "ev"}, err: appErr}
	state := ValidationState{Modules: map[string]Module{"ev": mod}}
	err := v.Validate(context.Background(), GameEvent{Type: "test"}, state)
	if err == nil {
		t.Fatal("expected error from EventValidator module")
	}
	var ae *apperror.AppError
	if !errors.As(err, &ae) {
		t.Fatalf("expected *apperror.AppError, got %T: %v", err, err)
	}
}
