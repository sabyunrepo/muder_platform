package auditlog

import (
	"encoding/json"
	"fmt"
	"time"

	"github.com/google/uuid"
)

// AuditAction identifies the type of game event being audited.
type AuditAction string

const (
	ActionPlayerAction AuditAction = "player.action"
	ActionPhaseEnter   AuditAction = "phase.enter"
	ActionPhaseExit    AuditAction = "phase.exit"
	ActionWinDecision  AuditAction = "win.decision"
	ActionModulePanic  AuditAction = "module.panic"
	ActionRuleEval     AuditAction = "rule.eval"
)

// AuditEvent is the domain representation of a single audit log entry.
// It mirrors the audit_events DB row but uses Go-native nullable types.
type AuditEvent struct {
	// ID is set after persistence; zero value before insertion.
	ID        int64
	SessionID uuid.UUID
	Seq       int64
	// ActorID is nil for system-generated events.
	ActorID  *uuid.UUID
	Action   AuditAction
	ModuleID string
	Payload  json.RawMessage
	// CreatedAt is set by the database; zero value before insertion.
	CreatedAt time.Time
}

// Validate returns an error if the event is structurally invalid.
func (e AuditEvent) Validate() error {
	if e.SessionID == uuid.Nil {
		return fmt.Errorf("auditlog: session_id must not be zero")
	}
	if e.Action == "" {
		return fmt.Errorf("auditlog: action must not be empty")
	}
	return nil
}
