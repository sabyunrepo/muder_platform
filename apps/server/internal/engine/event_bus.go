package engine

import (
	"context"
	"runtime/debug"
	"sync"

	"github.com/rs/zerolog"
)

// GameEvent is a placeholder type until PR-A1 (module_types.go) is merged.
// TODO(phase-9.0): rebase onto PR-A1 GameEvent
type GameEvent struct {
	// Topic is the event routing key (e.g. "player.joined", "phase.advanced").
	Topic   string
	Payload any
}

// Subscriber is the interface that typed event listeners must implement.
// OnEvent is called for every published event whose topic matches the subscription.
// Returning a non-nil error does not stop sibling subscribers; errors are collected
// and returned in aggregate by TypedEventBus.Publish.
type Subscriber interface {
	OnEvent(ctx context.Context, evt GameEvent) error
}

// Publisher is the interface for typed event publishing.
// Publish dispatches evt to all registered subscribers for evt.Topic and
// returns the collected (non-nil) errors. A nil slice means full success.
type Publisher interface {
	Publish(ctx context.Context, evt GameEvent) []error
}

// TypedEventBus is a session-scoped, typed pub/sub event bus.
// It replaces the callback-based EventBus for the Phase 9.0 GenrePlugin architecture.
// Each game session owns its own TypedEventBus instance — no global singleton.
//
// Concurrency: safe for concurrent Subscribe/Unsubscribe/Publish calls.
// Subscriber panics are recovered per-subscriber; a panicking subscriber
// never takes down sibling subscribers or the caller.
type TypedEventBus struct {
	mu     sync.RWMutex
	subs   map[string][]Subscriber
	log    zerolog.Logger
	closed bool
}

// NewTypedEventBus creates a new session-scoped typed event bus.
// The provided logger is used for panic recovery diagnostics.
func NewTypedEventBus(log zerolog.Logger) *TypedEventBus {
	return &TypedEventBus{
		subs: make(map[string][]Subscriber),
		log:  log,
	}
}

// Subscribe registers sub for events published on topic.
// No-ops if the bus is closed.
func (b *TypedEventBus) Subscribe(topic string, sub Subscriber) {
	b.mu.Lock()
	defer b.mu.Unlock()

	if b.closed {
		return
	}
	b.subs[topic] = append(b.subs[topic], sub)
}

// Unsubscribe removes the first occurrence of sub from the topic's subscriber list.
// It compares by identity (pointer equality). No-ops if sub is not found.
func (b *TypedEventBus) Unsubscribe(topic string, sub Subscriber) {
	b.mu.Lock()
	defer b.mu.Unlock()

	list := b.subs[topic]
	for i, s := range list {
		if s == sub {
			b.subs[topic] = append(list[:i], list[i+1:]...)
			return
		}
	}
}

// Publish dispatches evt to all subscribers registered for evt.Topic.
// It returns the aggregate slice of non-nil errors returned by subscribers.
// A nil return means all subscribers completed without error.
//
// Panics in subscribers are recovered: the panic is logged via zerolog and
// treated as an error (wrapped in panicError), so sibling subscribers are
// always called regardless of panicking neighbours.
//
// Publish is a no-op if the bus is closed or if no subscribers exist for the topic.
func (b *TypedEventBus) Publish(ctx context.Context, evt GameEvent) []error {
	b.mu.RLock()
	if b.closed {
		b.mu.RUnlock()
		return nil
	}
	// Snapshot subscribers under read-lock to avoid holding the lock during calls.
	src := b.subs[evt.Topic]
	if len(src) == 0 {
		b.mu.RUnlock()
		return nil
	}
	snapshot := make([]Subscriber, len(src))
	copy(snapshot, src)
	b.mu.RUnlock()

	var errs []error
	for _, sub := range snapshot {
		if err := b.callSafe(ctx, sub, evt); err != nil {
			errs = append(errs, err)
		}
	}
	return errs
}

// callSafe calls sub.OnEvent, recovering any panic.
// A recovered panic is logged and returned as a panicError.
func (b *TypedEventBus) callSafe(ctx context.Context, sub Subscriber, evt GameEvent) (retErr error) {
	defer func() {
		if r := recover(); r != nil {
			stack := debug.Stack()
			b.log.Error().
				Str("topic", evt.Topic).
				Interface("panic", r).
				Bytes("stack", stack).
				Msg("engine/event_bus: subscriber panic recovered")
			retErr = &panicError{topic: evt.Topic, value: r}
		}
	}()
	return sub.OnEvent(ctx, evt)
}

// Close shuts down the bus and clears all subscribers for GC.
// Any subsequent Publish or Subscribe calls are silently no-oped.
func (b *TypedEventBus) Close() {
	b.mu.Lock()
	defer b.mu.Unlock()

	b.closed = true
	b.subs = nil
}

// panicError wraps a recovered panic value so callers can distinguish it from
// a normal subscriber error if needed.
type panicError struct {
	topic string
	value any
}

func (e *panicError) Error() string {
	return "subscriber panic on topic " + e.topic
}
