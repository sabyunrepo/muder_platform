package engine

import (
	"sync"
	"sync/atomic"
	"testing"
)

func TestEventBus_SubscribeAndPublish(t *testing.T) {
	bus := NewEventBus(nil)
	defer bus.Close()

	var received string
	bus.Subscribe("test:event", func(e Event) {
		received = e.Payload.(string)
	})

	bus.Publish(Event{Type: "test:event", Payload: "hello"})

	if received != "hello" {
		t.Fatalf("expected 'hello', got %q", received)
	}
}

func TestEventBus_MultipleSubscribers(t *testing.T) {
	bus := NewEventBus(nil)
	defer bus.Close()

	var count atomic.Int32
	bus.Subscribe("inc", func(_ Event) { count.Add(1) })
	bus.Subscribe("inc", func(_ Event) { count.Add(1) })
	bus.Subscribe("inc", func(_ Event) { count.Add(1) })

	bus.Publish(Event{Type: "inc"})

	if count.Load() != 3 {
		t.Fatalf("expected 3 handlers called, got %d", count.Load())
	}
}

func TestEventBus_Unsubscribe(t *testing.T) {
	bus := NewEventBus(nil)
	defer bus.Close()

	var called bool
	id := bus.Subscribe("test", func(_ Event) { called = true })
	bus.Unsubscribe(id)
	bus.Publish(Event{Type: "test"})

	if called {
		t.Fatal("handler should not be called after unsubscribe")
	}
}

func TestEventBus_PanicIsolation(t *testing.T) {
	bus := NewEventBus(nil)
	defer bus.Close()

	var secondCalled bool
	bus.Subscribe("panic", func(_ Event) { panic("boom") })
	bus.Subscribe("panic", func(_ Event) { secondCalled = true })

	bus.Publish(Event{Type: "panic"})

	if !secondCalled {
		t.Fatal("second handler should still be called after first panics")
	}
}

func TestEventBus_CloseStopsPublish(t *testing.T) {
	bus := NewEventBus(nil)

	var called bool
	bus.Subscribe("test", func(_ Event) { called = true })
	bus.Close()
	bus.Publish(Event{Type: "test"})

	if called {
		t.Fatal("handler should not be called after Close")
	}
}

func TestEventBus_CloseStopsSubscribe(t *testing.T) {
	bus := NewEventBus(nil)
	bus.Close()

	id := bus.Subscribe("test", func(_ Event) {})
	if id != -1 {
		t.Fatalf("expected -1 for subscribe after close, got %d", id)
	}
}

func TestEventBus_ConcurrentPublish(t *testing.T) {
	bus := NewEventBus(nil)
	defer bus.Close()

	var count atomic.Int64
	bus.Subscribe("concurrent", func(_ Event) { count.Add(1) })

	var wg sync.WaitGroup
	for i := 0; i < 100; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			bus.Publish(Event{Type: "concurrent"})
		}()
	}
	wg.Wait()

	if count.Load() != 100 {
		t.Fatalf("expected 100, got %d", count.Load())
	}
}

func TestEventBus_NoMatchingSubscribers(t *testing.T) {
	bus := NewEventBus(nil)
	defer bus.Close()

	// Should not panic even with no subscribers.
	bus.Publish(Event{Type: "unknown"})
}

func TestEventBus_SubscribeAll_FiresForEveryType(t *testing.T) {
	bus := NewEventBus(nil)
	defer bus.Close()

	var received []string
	bus.SubscribeAll(func(e Event) { received = append(received, e.Type) })

	bus.Publish(Event{Type: "phase:entered"})
	bus.Publish(Event{Type: "clue.acquired"})
	bus.Publish(Event{Type: "vote:tallied"})

	if len(received) != 3 {
		t.Fatalf("expected 3 events, got %d (%v)", len(received), received)
	}
}

func TestEventBus_SubscribeAll_CoexistsWithTyped(t *testing.T) {
	bus := NewEventBus(nil)
	defer bus.Close()

	var wildcardCount, typedCount atomic.Int64
	bus.SubscribeAll(func(_ Event) { wildcardCount.Add(1) })
	bus.Subscribe("phase:entered", func(_ Event) { typedCount.Add(1) })

	bus.Publish(Event{Type: "phase:entered"})
	bus.Publish(Event{Type: "clue.acquired"})

	if wildcardCount.Load() != 2 {
		t.Errorf("wildcard: expected 2, got %d", wildcardCount.Load())
	}
	if typedCount.Load() != 1 {
		t.Errorf("typed: expected 1, got %d", typedCount.Load())
	}
}

func TestEventBus_SubscribeAll_UnsubscribeRemovesWildcard(t *testing.T) {
	bus := NewEventBus(nil)
	defer bus.Close()

	var count atomic.Int64
	id := bus.SubscribeAll(func(_ Event) { count.Add(1) })

	bus.Publish(Event{Type: "x"})
	bus.Unsubscribe(id)
	bus.Publish(Event{Type: "x"})

	if count.Load() != 1 {
		t.Fatalf("expected 1 (wildcard removed after unsubscribe), got %d", count.Load())
	}
}
