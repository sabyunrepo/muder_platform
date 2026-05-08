package engine

import (
	"context"
	"strings"
	"testing"

	"github.com/google/uuid"
)

func TestPhaseEngine_AuditEventFallsBackWhenPayloadCannotMarshal(t *testing.T) {
	audit := &recordingAuditLogger{}
	pe := NewPhaseEngine(uuid.New(), nil, NewEventBus(nil), audit, nil, testPhaseDefinitions)

	pe.auditEvent(context.Background(), "bad.payload", map[string]any{
		"unsupported": func() {},
	})

	events := audit.eventsOfType("bad.payload")
	if len(events) != 1 {
		t.Fatalf("events len = %d, want 1", len(events))
	}
	if !strings.Contains(string(events[0].Payload), "marshalError") {
		t.Fatalf("fallback payload missing marshalError: %s", events[0].Payload)
	}
}
