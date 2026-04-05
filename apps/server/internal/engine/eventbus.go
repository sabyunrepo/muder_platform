package engine

import (
	"fmt"
	"runtime/debug"
	"sync"
)

// EventBus is a session-scoped, callback-based event system.
// Each game session gets its own EventBus instance (no global singleton).
type EventBus struct {
	mu       sync.RWMutex
	handlers map[string][]handlerEntry
	nextID   int
	closed   bool
	logger   Logger
}

type handlerEntry struct {
	id int
	fn EventHandler
}

// EventHandler is a callback invoked when an event is published.
type EventHandler func(event Event)

// Event carries data through the EventBus.
type Event struct {
	Type    string
	Payload any
}

// NewEventBus creates a new session-scoped event bus.
func NewEventBus(logger Logger) *EventBus {
	return &EventBus{
		handlers: make(map[string][]handlerEntry),
		logger:   logger,
	}
}

// Subscribe registers a handler for an event type.
// Returns a subscription ID for later unsubscription.
func (eb *EventBus) Subscribe(eventType string, handler EventHandler) int {
	eb.mu.Lock()
	defer eb.mu.Unlock()

	if eb.closed {
		return -1
	}

	eb.nextID++
	id := eb.nextID
	eb.handlers[eventType] = append(eb.handlers[eventType], handlerEntry{
		id: id,
		fn: handler,
	})
	return id
}

// Unsubscribe removes a handler by subscription ID.
func (eb *EventBus) Unsubscribe(subID int) {
	eb.mu.Lock()
	defer eb.mu.Unlock()

	for eventType, entries := range eb.handlers {
		for i, entry := range entries {
			if entry.id == subID {
				eb.handlers[eventType] = append(entries[:i], entries[i+1:]...)
				return
			}
		}
	}
}

// Publish dispatches an event to all registered handlers.
// Errors in individual handlers are isolated — one panic doesn't crash others.
func (eb *EventBus) Publish(event Event) {
	eb.mu.RLock()
	if eb.closed {
		eb.mu.RUnlock()
		return
	}
	// Copy handlers to release lock before calling them.
	entries := make([]handlerEntry, len(eb.handlers[event.Type]))
	copy(entries, eb.handlers[event.Type])
	eb.mu.RUnlock()

	for _, entry := range entries {
		func() {
			defer func() {
				if r := recover(); r != nil {
					if eb.logger != nil {
						eb.logger.Printf("engine/eventbus: handler panic on %q: %v\n%s",
							event.Type, r, debug.Stack())
					} else {
						fmt.Printf("engine/eventbus: handler panic on %q: %v\n", event.Type, r)
					}
				}
			}()
			entry.fn(event)
		}()
	}
}

// Close shuts down the event bus and clears all handlers (GC cleanup).
func (eb *EventBus) Close() {
	eb.mu.Lock()
	defer eb.mu.Unlock()

	eb.closed = true
	eb.handlers = nil
}
