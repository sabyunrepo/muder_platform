package auditlog

import (
	"context"
	"sync"
)

// CapturingLogger is a testutil Logger that records every AuditEvent appended
// to it. It is safe for concurrent use.
//
// Usage (across packages):
//
//	logger := auditlog.NewCapturingLogger()
//	svc := auth.NewService(..., logger, ...)
//	// exercise svc
//	entries := logger.Entries()
//	// assert entries[0].Action == auditlog.ActionUserLogin
//
// The type lives in the auditlog package (not a _test file) so any package
// can reference it in test files without a test-only import cycle.
type CapturingLogger struct {
	mu      sync.Mutex
	entries []AuditEvent
}

// NewCapturingLogger returns a zero-value CapturingLogger ready for use.
func NewCapturingLogger() *CapturingLogger {
	return &CapturingLogger{}
}

// Append implements Logger. It validates the event (same rules as DBLogger)
// and records it on success.
func (c *CapturingLogger) Append(_ context.Context, evt AuditEvent) error {
	if err := evt.Validate(); err != nil {
		return err
	}
	c.mu.Lock()
	c.entries = append(c.entries, evt)
	c.mu.Unlock()
	return nil
}

// Entries returns a snapshot copy of all captured events in append order.
func (c *CapturingLogger) Entries() []AuditEvent {
	c.mu.Lock()
	defer c.mu.Unlock()
	out := make([]AuditEvent, len(c.entries))
	copy(out, c.entries)
	return out
}

// Reset clears all captured events. Useful when reusing a logger across
// sub-tests.
func (c *CapturingLogger) Reset() {
	c.mu.Lock()
	c.entries = c.entries[:0]
	c.mu.Unlock()
}
