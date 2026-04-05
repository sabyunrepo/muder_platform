package ws

import (
	"sync"
	"time"
)

// ReconnectBuffer is a per-session ring buffer that stores recent outgoing
// Envelopes so that reconnecting clients can catch up on missed messages.
// All methods are safe for concurrent use.
type ReconnectBuffer struct {
	mu      sync.RWMutex
	entries []bufferEntry
	head    int // index of the next write position
	count   int // number of valid entries in the buffer
	maxAge  time.Duration
	maxSize int
}

type bufferEntry struct {
	env *Envelope
	at  time.Time
}

// NewReconnectBuffer creates a ring buffer that retains up to maxSize envelopes
// for at most maxAge. Typical values: maxAge=60s, maxSize=1000.
func NewReconnectBuffer(maxAge time.Duration, maxSize int) *ReconnectBuffer {
	if maxSize <= 0 {
		maxSize = 1000
	}
	if maxAge <= 0 {
		maxAge = 60 * time.Second
	}
	return &ReconnectBuffer{
		entries: make([]bufferEntry, maxSize),
		maxAge:  maxAge,
		maxSize: maxSize,
	}
}

// Push appends an envelope to the ring buffer. If the buffer is full the
// oldest entry is overwritten. Expired entries are pruned opportunistically.
func (rb *ReconnectBuffer) Push(env *Envelope) {
	rb.mu.Lock()
	defer rb.mu.Unlock()

	now := time.Now()
	rb.pruneLocked(now)

	rb.entries[rb.head] = bufferEntry{env: env, at: now}
	rb.head = (rb.head + 1) % rb.maxSize

	if rb.count < rb.maxSize {
		rb.count++
	}
}

// Since returns all buffered envelopes whose Seq is strictly greater than seq
// and that are still within maxAge. The returned slice is ordered oldest-first,
// ready to be replayed to a reconnecting client.
func (rb *ReconnectBuffer) Since(seq uint64) []*Envelope {
	rb.mu.RLock()
	defer rb.mu.RUnlock()

	if rb.count == 0 {
		return nil
	}

	now := time.Now()
	cutoff := now.Add(-rb.maxAge)

	// start is the index of the oldest valid entry in the ring.
	start := (rb.head - rb.count + rb.maxSize) % rb.maxSize

	result := make([]*Envelope, 0, rb.count)
	for i := 0; i < rb.count; i++ {
		idx := (start + i) % rb.maxSize
		e := rb.entries[idx]

		if e.at.Before(cutoff) {
			continue
		}
		if e.env.Seq <= seq {
			continue
		}
		result = append(result, e.env)
	}

	return result
}

// Prune removes entries older than maxAge. It is safe to call periodically
// (e.g. from a ticker) in addition to the automatic pruning on Push.
func (rb *ReconnectBuffer) Prune() {
	rb.mu.Lock()
	defer rb.mu.Unlock()

	rb.pruneLocked(time.Now())
}

// pruneLocked removes expired entries from the tail of the ring buffer.
// Caller must hold rb.mu (write lock).
func (rb *ReconnectBuffer) pruneLocked(now time.Time) {
	cutoff := now.Add(-rb.maxAge)

	for rb.count > 0 {
		// Oldest entry is at the tail of the ring.
		tail := (rb.head - rb.count + rb.maxSize) % rb.maxSize
		if rb.entries[tail].at.Before(cutoff) {
			rb.entries[tail] = bufferEntry{} // release pointer for GC
			rb.count--
		} else {
			break
		}
	}
}

// Len returns the number of entries currently in the buffer.
func (rb *ReconnectBuffer) Len() int {
	rb.mu.RLock()
	defer rb.mu.RUnlock()

	return rb.count
}

// Reset clears all entries from the buffer.
func (rb *ReconnectBuffer) Reset() {
	rb.mu.Lock()
	defer rb.mu.Unlock()

	for i := range rb.entries {
		rb.entries[i] = bufferEntry{}
	}
	rb.head = 0
	rb.count = 0
}
