package engine

import (
	"context"
	"fmt"

	"github.com/mmp-platform/server/internal/apperror"
)

// ValidationState holds runtime state visible to validators during event
// dispatch. Distinct from GameState (serialisable): validators need live
// module instances and phase metadata that are not persisted.
type ValidationState struct {
	Phase             string
	AllowedEventTypes []string
	Modules           map[string]Module
}

// Validator validates a GameEvent against the current ValidationState before
// dispatch. Implementations must be side-effect-free.
type Validator interface {
	Validate(ctx context.Context, event GameEvent, state ValidationState) error
}

// Chain is an ordered list of Validators. It short-circuits on the first error.
type Chain []Validator

// Validate runs each validator in order. Returns the first non-nil error.
func (c Chain) Validate(ctx context.Context, event GameEvent, state ValidationState) error {
	for _, v := range c {
		if err := ctx.Err(); err != nil {
			return apperror.BadRequest(fmt.Sprintf("validator: context cancelled: %v", err))
		}
		if err := v.Validate(ctx, event, state); err != nil {
			if ae, ok := err.(*apperror.AppError); ok {
				return ae
			}
			return apperror.BadRequest(err.Error())
		}
	}
	return nil
}

// PhaseValidator checks that event.Type is permitted in the current phase.
// An empty AllowedEventTypes list means all event types are permitted.
type PhaseValidator struct{}

func (PhaseValidator) Validate(_ context.Context, event GameEvent, state ValidationState) error {
	if len(state.AllowedEventTypes) == 0 {
		return nil
	}
	for _, allowed := range state.AllowedEventTypes {
		if event.Type == allowed {
			return nil
		}
	}
	return apperror.BadRequest(
		fmt.Sprintf("validator: action %q not allowed in phase %q", event.Type, state.Phase),
	)
}

// PlayerValidator checks that the event actor is a valid session participant.
// Currently a no-op stub — real validation requires the session participant
// registry which is not yet available in ValidationState.
type PlayerValidator struct{}

func (PlayerValidator) Validate(_ context.Context, _ GameEvent, _ ValidationState) error {
	return nil
}

// EventValidator is an optional interface for modules that support dry-run
// event validation without side effects.
type EventValidator interface {
	ValidateEvent(ctx context.Context, event GameEvent, state ValidationState) error
}

// ModuleValidator delegates pre-dispatch validation to modules that implement
// EventValidator. Modules without EventValidator are silently skipped.
type ModuleValidator struct{}

func (ModuleValidator) Validate(ctx context.Context, event GameEvent, state ValidationState) error {
	for _, mod := range state.Modules {
		ev, ok := mod.(EventValidator)
		if !ok {
			continue
		}
		if err := ev.ValidateEvent(ctx, event, state); err != nil {
			return err
		}
	}
	return nil
}
