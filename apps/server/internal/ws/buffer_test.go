package ws

import (
	"context"
	"sync"
	"testing"
	"time"

	"github.com/google/uuid"
)

// envWithSeq creates a test envelope with an explicit sequence number.
func envWithSeq(seq uint64) *Envelope {
	return &Envelope{Type: "test", Seq: seq, TS: time.Now().UnixMilli()}
}

// ---------------------------------------------------------------------------
// ReconnectBuffer
// ---------------------------------------------------------------------------

func TestBuffer_PushAndLen(t *testing.T) {
	buf := NewReconnectBuffer(time.Minute, 100)

	if buf.Len() != 0 {
		t.Fatal("new buffer should be empty")
	}

	for i := uint64(1); i <= 5; i++ {
		buf.Push(envWithSeq(i))
	}

	if got := buf.Len(); got != 5 {
		t.Fatalf("Len() = %d, want 5", got)
	}
}

func TestBuffer_Since(t *testing.T) {
	buf := NewReconnectBuffer(time.Minute, 100)

	for i := uint64(1); i <= 10; i++ {
		buf.Push(envWithSeq(i))
	}

	got := buf.Since(5)
	if len(got) != 5 {
		t.Fatalf("Since(5) returned %d items, want 5", len(got))
	}

	for i, env := range got {
		wantSeq := uint64(6 + i)
		if env.Seq != wantSeq {
			t.Errorf("got[%d].Seq = %d, want %d", i, env.Seq, wantSeq)
		}
	}
}

func TestBuffer_SinceZero(t *testing.T) {
	buf := NewReconnectBuffer(time.Minute, 100)

	for i := uint64(1); i <= 5; i++ {
		buf.Push(envWithSeq(i))
	}

	got := buf.Since(0)
	if len(got) != 5 {
		t.Fatalf("Since(0) returned %d items, want 5", len(got))
	}

	for i, env := range got {
		wantSeq := uint64(1 + i)
		if env.Seq != wantSeq {
			t.Errorf("got[%d].Seq = %d, want %d", i, env.Seq, wantSeq)
		}
	}
}

func TestBuffer_SinceEmpty(t *testing.T) {
	buf := NewReconnectBuffer(time.Minute, 10)

	if got := buf.Since(0); got != nil {
		t.Errorf("Since(0) on empty buffer = %v, want nil", got)
	}
}

func TestBuffer_RingOverflow(t *testing.T) {
	buf := NewReconnectBuffer(time.Minute, 3)

	for i := uint64(1); i <= 5; i++ {
		buf.Push(envWithSeq(i))
	}

	if got := buf.Len(); got != 3 {
		t.Fatalf("Len() = %d, want 3", got)
	}

	got := buf.Since(0)
	if len(got) != 3 {
		t.Fatalf("Since(0) returned %d items, want 3", len(got))
	}

	// Oldest entries (seq 1, 2) were evicted; only 3, 4, 5 remain.
	for i, env := range got {
		wantSeq := uint64(3 + i)
		if env.Seq != wantSeq {
			t.Errorf("got[%d].Seq = %d, want %d", i, env.Seq, wantSeq)
		}
	}
}

func TestBuffer_MaxAge(t *testing.T) {
	buf := NewReconnectBuffer(10*time.Millisecond, 100)

	buf.Push(envWithSeq(1))
	time.Sleep(20 * time.Millisecond)

	got := buf.Since(0)
	if len(got) != 0 {
		t.Fatalf("Since(0) after expiry returned %d items, want 0", len(got))
	}
}

func TestBuffer_Prune(t *testing.T) {
	buf := NewReconnectBuffer(10*time.Millisecond, 100)

	for i := uint64(1); i <= 5; i++ {
		buf.Push(envWithSeq(i))
	}

	time.Sleep(20 * time.Millisecond)
	buf.Prune()

	if got := buf.Len(); got != 0 {
		t.Fatalf("Len() after Prune = %d, want 0", got)
	}
}

func TestBuffer_PrunePartial(t *testing.T) {
	buf := NewReconnectBuffer(50*time.Millisecond, 100)

	buf.Push(envWithSeq(1))
	buf.Push(envWithSeq(2))

	time.Sleep(80 * time.Millisecond)

	// Push a fresh entry after the older ones expired.
	buf.Push(envWithSeq(3))
	buf.Prune()

	if got := buf.Len(); got != 1 {
		t.Fatalf("Len() after partial prune = %d, want 1", got)
	}
}

func TestBuffer_Reset(t *testing.T) {
	buf := NewReconnectBuffer(time.Minute, 100)

	for i := uint64(1); i <= 5; i++ {
		buf.Push(envWithSeq(i))
	}

	buf.Reset()

	if got := buf.Len(); got != 0 {
		t.Fatalf("Len() after Reset = %d, want 0", got)
	}

	if got := buf.Since(0); got != nil {
		t.Fatalf("Since(0) after Reset = %v, want nil", got)
	}
}

func TestBuffer_ConcurrentAccess(t *testing.T) {
	buf := NewReconnectBuffer(time.Minute, 100)
	const goroutines = 10
	const opsPerGoroutine = 100

	var wg sync.WaitGroup
	wg.Add(goroutines*2 + 1)

	// Writers.
	for g := 0; g < goroutines; g++ {
		go func(base uint64) {
			defer wg.Done()
			for i := uint64(0); i < opsPerGoroutine; i++ {
				buf.Push(envWithSeq(base + i))
			}
		}(uint64(g) * opsPerGoroutine)
	}

	// Readers.
	for g := 0; g < goroutines; g++ {
		go func() {
			defer wg.Done()
			for i := 0; i < opsPerGoroutine; i++ {
				_ = buf.Since(0)
				_ = buf.Len()
			}
		}()
	}

	// Pruner.
	go func() {
		defer wg.Done()
		for i := 0; i < 50; i++ {
			buf.Prune()
		}
	}()

	wg.Wait()

	// No specific value assertion — the race detector validates correctness.
	if buf.Len() > 100 {
		t.Fatalf("Len() = %d, exceeds maxSize 100", buf.Len())
	}
}

func TestBuffer_SinceOrderIsOldestFirst(t *testing.T) {
	buf := NewReconnectBuffer(time.Minute, 100)

	for i := uint64(1); i <= 20; i++ {
		buf.Push(envWithSeq(i))
	}

	result := buf.Since(0)
	for i := 1; i < len(result); i++ {
		if result[i].Seq <= result[i-1].Seq {
			t.Fatalf("out of order: result[%d].Seq=%d <= result[%d].Seq=%d",
				i, result[i].Seq, i-1, result[i-1].Seq)
		}
	}
}

func TestBuffer_DefaultParams(t *testing.T) {
	buf := NewReconnectBuffer(0, 0)

	if buf.maxAge != 60*time.Second {
		t.Errorf("default maxAge = %v, want 60s", buf.maxAge)
	}
	if buf.maxSize != 1000 {
		t.Errorf("default maxSize = %d, want 1000", buf.maxSize)
	}
}

// ---------------------------------------------------------------------------
// NoopPubSub
// ---------------------------------------------------------------------------

func TestNoopPubSub(t *testing.T) {
	var ps PubSub = NoopPubSub{}
	ctx := context.Background()
	id := uuid.New()
	env := envWithSeq(1)

	if err := ps.Publish(ctx, id, env); err != nil {
		t.Fatalf("Publish() = %v, want nil", err)
	}
	if err := ps.Subscribe(ctx, id); err != nil {
		t.Fatalf("Subscribe() = %v, want nil", err)
	}
	if err := ps.Unsubscribe(ctx, id); err != nil {
		t.Fatalf("Unsubscribe() = %v, want nil", err)
	}
	if err := ps.Close(); err != nil {
		t.Fatalf("Close() = %v, want nil", err)
	}
}
