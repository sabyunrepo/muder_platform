package eventbus

import (
	"context"
	"sync"

	"github.com/rs/zerolog"
)

// Event is the interface that all events must implement.
type Event interface {
	EventType() string
}

// Handler is a function that processes an event.
type Handler func(ctx context.Context, event Event) error

// Bus is a synchronous in-process event bus.
type Bus struct {
	handlers map[string][]Handler
	mu       sync.RWMutex
	logger   zerolog.Logger
}

// New creates a new event bus.
func New(logger zerolog.Logger) *Bus {
	return &Bus{
		handlers: make(map[string][]Handler),
		logger:   logger.With().Str("component", "eventbus").Logger(),
	}
}

// Subscribe registers a handler for the given event type.
func (b *Bus) Subscribe(eventType string, handler Handler) {
	b.mu.Lock()
	defer b.mu.Unlock()
	b.handlers[eventType] = append(b.handlers[eventType], handler)
}

// Publish dispatches an event to all registered handlers synchronously.
func (b *Bus) Publish(ctx context.Context, event Event) error {
	b.mu.RLock()
	handlers := b.handlers[event.EventType()]
	b.mu.RUnlock()

	for _, h := range handlers {
		if err := h(ctx, event); err != nil {
			b.logger.Error().Err(err).Str("event", event.EventType()).Msg("event handler failed")
			return err
		}
	}
	return nil
}
