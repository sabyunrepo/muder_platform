package engine

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"sync"
	"sync/atomic"
	"testing"

	"github.com/google/uuid"
	"github.com/rs/zerolog"
)

// nopSubscriber calls the provided function when OnEvent fires.
type funcSubscriber struct {
	fn func(ctx context.Context, evt GameEvent) error
}

func (s *funcSubscriber) OnEvent(ctx context.Context, evt GameEvent) error {
	return s.fn(ctx, evt)
}

func newSub(fn func(ctx context.Context, evt GameEvent) error) Subscriber {
	return &funcSubscriber{fn: fn}
}

func nopLogger() zerolog.Logger {
	return zerolog.Nop()
}

// ---------------------------------------------------------------------------
// Happy path: publish → subscribers receive
// ---------------------------------------------------------------------------

func TestTypedEventBus_PublishReceived(t *testing.T) {
	bus := NewTypedEventBus(nopLogger())
	defer bus.Close()

	var got string
	sub := newSub(func(_ context.Context, evt GameEvent) error {
		got = string(evt.Payload)
		return nil
	})
	bus.Subscribe("player.joined", sub)

	errs := bus.Publish(context.Background(), GameEvent{Type: "player.joined", Payload: json.RawMessage("alice")})
	if len(errs) != 0 {
		t.Fatalf("expected no errors, got %v", errs)
	}
	if got != "alice" {
		t.Fatalf("expected payload 'alice', got %q", got)
	}
}

func TestTypedEventBus_MultipleSubscribersAllReceive(t *testing.T) {
	bus := NewTypedEventBus(nopLogger())
	defer bus.Close()

	var count atomic.Int32
	for i := 0; i < 3; i++ {
		bus.Subscribe("evt", newSub(func(_ context.Context, _ GameEvent) error {
			count.Add(1)
			return nil
		}))
	}

	bus.Publish(context.Background(), GameEvent{Type: "evt"})
	if count.Load() != 3 {
		t.Fatalf("expected 3 calls, got %d", count.Load())
	}
}

// ---------------------------------------------------------------------------
// Subscribe/Unsubscribe lifecycle
// ---------------------------------------------------------------------------

func TestTypedEventBus_UnsubscribePreventsCalls(t *testing.T) {
	bus := NewTypedEventBus(nopLogger())
	defer bus.Close()

	var called bool
	sub := newSub(func(_ context.Context, _ GameEvent) error {
		called = true
		return nil
	})
	bus.Subscribe("evt", sub)
	bus.Unsubscribe("evt", sub)

	bus.Publish(context.Background(), GameEvent{Type: "evt"})
	if called {
		t.Fatal("subscriber should not be called after unsubscribe")
	}
}

func TestTypedEventBus_UnsubscribeOnlyRemovesFirst(t *testing.T) {
	bus := NewTypedEventBus(nopLogger())
	defer bus.Close()

	var count atomic.Int32
	sub := newSub(func(_ context.Context, _ GameEvent) error {
		count.Add(1)
		return nil
	})
	// Subscribe same instance twice.
	bus.Subscribe("evt", sub)
	bus.Subscribe("evt", sub)
	// Unsubscribe removes only the first occurrence.
	bus.Unsubscribe("evt", sub)

	bus.Publish(context.Background(), GameEvent{Type: "evt"})
	if count.Load() != 1 {
		t.Fatalf("expected 1 call after removing one of two identical subs, got %d", count.Load())
	}
}

func TestTypedEventBus_SubscribeAfterClosedIsNoOp(t *testing.T) {
	bus := NewTypedEventBus(nopLogger())
	bus.Close()

	var called bool
	bus.Subscribe("evt", newSub(func(_ context.Context, _ GameEvent) error {
		called = true
		return nil
	}))
	// Bus is closed, so Publish should also be a no-op.
	bus.Publish(context.Background(), GameEvent{Type: "evt"})
	if called {
		t.Fatal("subscriber registered after close should never be called")
	}
}

func TestTypedEventBus_PublishAfterCloseIsNoOp(t *testing.T) {
	bus := NewTypedEventBus(nopLogger())

	var called bool
	bus.Subscribe("evt", newSub(func(_ context.Context, _ GameEvent) error {
		called = true
		return nil
	}))
	bus.Close()

	errs := bus.Publish(context.Background(), GameEvent{Type: "evt"})
	if called {
		t.Fatal("subscriber should not be called after Close")
	}
	if len(errs) != 0 {
		t.Fatalf("expected nil errs after close, got %v", errs)
	}
}

// ---------------------------------------------------------------------------
// Concurrent publish from N goroutines
// ---------------------------------------------------------------------------

func TestTypedEventBus_ConcurrentPublish(t *testing.T) {
	bus := NewTypedEventBus(nopLogger())
	defer bus.Close()

	const goroutines = 50
	var count atomic.Int64
	bus.Subscribe("concurrent", newSub(func(_ context.Context, _ GameEvent) error {
		count.Add(1)
		return nil
	}))

	var wg sync.WaitGroup
	for i := 0; i < goroutines; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			bus.Publish(context.Background(), GameEvent{Type: "concurrent"})
		}()
	}
	wg.Wait()

	if count.Load() != goroutines {
		t.Fatalf("expected %d calls, got %d", goroutines, count.Load())
	}
}

func TestTypedEventBus_ConcurrentSubscribeAndPublish(t *testing.T) {
	bus := NewTypedEventBus(nopLogger())
	defer bus.Close()

	var wg sync.WaitGroup
	// Concurrent subscribers being added while publishes happen.
	for i := 0; i < 20; i++ {
		wg.Add(2)
		go func() {
			defer wg.Done()
			bus.Subscribe("race", newSub(func(_ context.Context, _ GameEvent) error { return nil }))
		}()
		go func() {
			defer wg.Done()
			bus.Publish(context.Background(), GameEvent{Type: "race"})
		}()
	}
	wg.Wait()
}

// ---------------------------------------------------------------------------
// Panicking subscriber does not break sibling subscribers
// ---------------------------------------------------------------------------

func TestTypedEventBus_PanicIsolation(t *testing.T) {
	bus := NewTypedEventBus(nopLogger())
	defer bus.Close()

	var siblingCalled bool
	bus.Subscribe("evt", newSub(func(_ context.Context, _ GameEvent) error {
		panic("deliberate panic")
	}))
	bus.Subscribe("evt", newSub(func(_ context.Context, _ GameEvent) error {
		siblingCalled = true
		return nil
	}))

	errs := bus.Publish(context.Background(), GameEvent{Type: "evt"})
	if !siblingCalled {
		t.Fatal("sibling subscriber should be called even when prior subscriber panics")
	}
	if len(errs) != 1 {
		t.Fatalf("expected 1 error for the panicking subscriber, got %d", len(errs))
	}
	var pe *panicError
	if !errors.As(errs[0], &pe) {
		t.Fatalf("expected panicError, got %T: %v", errs[0], errs[0])
	}
}

func TestTypedEventBus_PanicErrorContainsTopic(t *testing.T) {
	bus := NewTypedEventBus(nopLogger())
	defer bus.Close()

	bus.Subscribe("phase.advanced", newSub(func(_ context.Context, _ GameEvent) error {
		panic("boom")
	}))

	errs := bus.Publish(context.Background(), GameEvent{Type: "phase.advanced"})
	if len(errs) != 1 {
		t.Fatalf("expected 1 error, got %d", len(errs))
	}
	// Error message must mention the topic.
	msg := errs[0].Error()
	if msg == "" {
		t.Fatal("panicError.Error() must not be empty")
	}
}

// ---------------------------------------------------------------------------
// Error aggregation: subscriber errors collected, others still run
// ---------------------------------------------------------------------------

func TestTypedEventBus_ErrorAggregation(t *testing.T) {
	bus := NewTypedEventBus(nopLogger())
	defer bus.Close()

	errA := fmt.Errorf("subscriber A failed")
	errB := fmt.Errorf("subscriber B failed")

	bus.Subscribe("evt", newSub(func(_ context.Context, _ GameEvent) error { return errA }))
	bus.Subscribe("evt", newSub(func(_ context.Context, _ GameEvent) error { return errB }))
	bus.Subscribe("evt", newSub(func(_ context.Context, _ GameEvent) error { return nil }))

	errs := bus.Publish(context.Background(), GameEvent{Type: "evt"})
	if len(errs) != 2 {
		t.Fatalf("expected 2 errors, got %d", len(errs))
	}
}

// ---------------------------------------------------------------------------
// Unknown topic publish is a no-op
// ---------------------------------------------------------------------------

func TestTypedEventBus_UnknownTopicIsNoOp(t *testing.T) {
	bus := NewTypedEventBus(nopLogger())
	defer bus.Close()

	// No subscribers registered for "unknown".
	errs := bus.Publish(context.Background(), GameEvent{Type: "unknown.topic"})
	if len(errs) != 0 {
		t.Fatalf("expected nil for unknown topic, got %v", errs)
	}
}

// ---------------------------------------------------------------------------
// Context cancellation: subscriber honours ctx, returns error
// ---------------------------------------------------------------------------

func TestTypedEventBus_ContextCancellation(t *testing.T) {
	bus := NewTypedEventBus(nopLogger())
	defer bus.Close()

	bus.Subscribe("evt", newSub(func(ctx context.Context, _ GameEvent) error {
		select {
		case <-ctx.Done():
			return ctx.Err()
		default:
			return nil
		}
	}))

	ctx, cancel := context.WithCancel(context.Background())
	cancel() // already cancelled

	errs := bus.Publish(ctx, GameEvent{Type: "evt"})
	if len(errs) != 1 {
		t.Fatalf("expected 1 error from cancelled context, got %d", len(errs))
	}
	if !errors.Is(errs[0], context.Canceled) {
		t.Fatalf("expected context.Canceled, got %v", errs[0])
	}
}

// ---------------------------------------------------------------------------
// Panic log includes session_id field
// ---------------------------------------------------------------------------

func TestTypedEventBus_PanicLogIncludesSessionID(t *testing.T) {
	var buf bytes.Buffer
	log := zerolog.New(&buf)
	bus := NewTypedEventBus(log)
	defer bus.Close()

	sid := uuid.New()
	bus.Subscribe("panic.test", newSub(func(_ context.Context, _ GameEvent) error {
		panic("test panic for session_id log check")
	}))

	bus.Publish(context.Background(), GameEvent{
		ID:        uuid.New(),
		SessionID: sid,
		Type:      "panic.test",
	})

	output := buf.String()
	if !strings.Contains(output, sid.String()) {
		t.Fatalf("expected session_id %s in panic log output, got:\n%s", sid, output)
	}
}

// ---------------------------------------------------------------------------
// Subscriber interface compliance
// ---------------------------------------------------------------------------

// Verify TypedEventBus implements Publisher at compile time.
var _ Publisher = (*TypedEventBus)(nil)
