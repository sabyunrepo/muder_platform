package eventbus

import (
	"context"
	"errors"
	"sync"
	"sync/atomic"
	"testing"

	"github.com/rs/zerolog"
)

// testEvent implements Event for testing.
type testEvent struct {
	typ  string
	data string
}

func (e testEvent) EventType() string { return e.typ }

func newTestBus() *Bus {
	return New(zerolog.Nop())
}

func TestPublishSubscribe(t *testing.T) {
	bus := newTestBus()
	var called bool

	bus.Subscribe("test.event", func(_ context.Context, e Event) error {
		called = true
		te, ok := e.(testEvent)
		if !ok {
			t.Fatalf("expected testEvent, got %T", e)
		}
		if te.data != "hello" {
			t.Errorf("expected data 'hello', got %q", te.data)
		}
		return nil
	})

	err := bus.Publish(context.Background(), testEvent{typ: "test.event", data: "hello"})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !called {
		t.Error("expected handler to be called")
	}
}

func TestMultipleHandlers(t *testing.T) {
	bus := newTestBus()
	var count atomic.Int32

	for range 3 {
		bus.Subscribe("multi.event", func(_ context.Context, _ Event) error {
			count.Add(1)
			return nil
		})
	}

	err := bus.Publish(context.Background(), testEvent{typ: "multi.event"})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if got := count.Load(); got != 3 {
		t.Errorf("expected 3 handler calls, got %d", got)
	}
}

func TestHandlerError(t *testing.T) {
	bus := newTestBus()
	wantErr := errors.New("handler failed")

	bus.Subscribe("err.event", func(_ context.Context, _ Event) error {
		return wantErr
	})

	err := bus.Publish(context.Background(), testEvent{typ: "err.event"})
	if !errors.Is(err, wantErr) {
		t.Errorf("expected error %v, got %v", wantErr, err)
	}
}

func TestNoSubscribers(t *testing.T) {
	bus := newTestBus()

	err := bus.Publish(context.Background(), testEvent{typ: "unsubscribed.event"})
	if err != nil {
		t.Fatalf("expected nil error for event with no subscribers, got %v", err)
	}
}

func TestConcurrentPublish(t *testing.T) {
	bus := newTestBus()
	var count atomic.Int64

	bus.Subscribe("concurrent.event", func(_ context.Context, _ Event) error {
		count.Add(1)
		return nil
	})

	const goroutines = 100
	var wg sync.WaitGroup
	wg.Add(goroutines)

	for range goroutines {
		go func() {
			defer wg.Done()
			_ = bus.Publish(context.Background(), testEvent{typ: "concurrent.event"})
		}()
	}

	wg.Wait()

	if got := count.Load(); got != goroutines {
		t.Errorf("expected %d handler calls, got %d", goroutines, got)
	}
}
