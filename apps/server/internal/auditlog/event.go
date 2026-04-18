package auditlog

import (
	"encoding/json"
	"fmt"
	"time"

	"github.com/google/uuid"
)

// AuditAction identifies the type of event being audited.
//
// Constants are grouped by domain. The Phase 19 PR-6 expansion introduced
// the auth/admin/review/editor groups so that F-sec-4 (no audit coverage
// outside game sessions) is addressed: prior to PR-6 only the Game group
// existed and write attempts for session-less events were rejected by
// AuditEvent.Validate().
type AuditAction string

const (
	// --- Game (original 00018 taxonomy) ---
	ActionPlayerAction AuditAction = "player.action"
	ActionPhaseEnter   AuditAction = "phase.enter"
	ActionPhaseExit    AuditAction = "phase.exit"
	ActionWinDecision  AuditAction = "win.decision"
	ActionModulePanic  AuditAction = "module.panic"
	ActionRuleEval     AuditAction = "rule.eval"

	// --- Auth (Phase 19 PR-6) ---
	ActionUserRegister       AuditAction = "user.register"
	ActionUserLogin          AuditAction = "user.login"
	ActionUserLoginFail      AuditAction = "user.login_fail"
	ActionUserLogout         AuditAction = "user.logout"
	ActionUserPasswordChange AuditAction = "user.password_change"
	ActionUserDeleteAccount  AuditAction = "user.delete_account"

	// --- Admin (Phase 19 PR-6) ---
	ActionAdminBan                 AuditAction = "admin.ban"
	ActionAdminUnban               AuditAction = "admin.unban"
	ActionAdminRoleChange          AuditAction = "admin.role_change"
	ActionAdminForceUnpublishTheme AuditAction = "admin.theme.force_unpublish"
	ActionAdminForceCloseRoom      AuditAction = "admin.room.force_close"
	ActionAdminTrustedCreator      AuditAction = "admin.trusted_creator"

	// --- Review (Phase 19 PR-6) ---
	ActionReviewSubmit  AuditAction = "review.submit"
	ActionReviewApprove AuditAction = "review.approve"
	ActionReviewReject  AuditAction = "review.reject"
	ActionReviewSuspend AuditAction = "review.suspend"

	// --- Editor — delta D-SEC-1 (Phase 19 PR-6) ---
	ActionEditorClueEdgesReplace   AuditAction = "editor.clue_edges.replace"
	ActionEditorClueEdgeCreate     AuditAction = "editor.clue_edge.create"
	ActionEditorClueEdgeDelete     AuditAction = "editor.clue_edge.delete"
	ActionEditorClueRelationCreate AuditAction = "editor.clue_relation.create"
	ActionEditorClueRelationDelete AuditAction = "editor.clue_relation.delete"
)

// AuditEvent is the domain representation of a single audit log entry.
// It mirrors the audit_events DB row but uses Go-native nullable types.
//
// Two shapes are supported (Phase 19 PR-6):
//
//   - Game-bound: SessionID != uuid.Nil AND Seq > 0.
//     Persisted via the transactional per-session Append path; protected by
//     the partial UNIQUE(session_id, seq) index.
//
//   - Identity-bound: UserID != nil, SessionID == uuid.Nil, Seq == 0.
//     Persisted via AppendUserAuditEvent; used for auth/admin/review/editor
//     actions that occur outside any game session.
//
// Validate() rejects rows that carry neither identity.
type AuditEvent struct {
	// ID is set after persistence; zero value before insertion.
	ID int64
	// SessionID is uuid.Nil when the event is not tied to a game session.
	SessionID uuid.UUID
	// Seq is 0 when SessionID == uuid.Nil.
	Seq int64
	// ActorID is the user/bot that triggered the event; nil for system-
	// generated events (e.g. ActionModulePanic).
	ActorID *uuid.UUID
	// UserID is the user the audit entry is filed against. For self-
	// initiated events (login, password change) this typically equals
	// ActorID; for admin actions (ban) it is the target account.
	UserID *uuid.UUID
	// Action is one of the AuditAction constants above.
	Action   AuditAction
	ModuleID string
	Payload  json.RawMessage
	// CreatedAt is set by the database; zero value before insertion.
	CreatedAt time.Time
}

// HasSession reports whether the event is tied to a game session.
func (e AuditEvent) HasSession() bool { return e.SessionID != uuid.Nil }

// HasUser reports whether the event carries an identity-bound user_id.
func (e AuditEvent) HasUser() bool { return e.UserID != nil }

// Validate returns an error if the event is structurally invalid.
// Every row MUST carry either a SessionID or a UserID (or both); this
// invariant is enforced in the DB via CHECK audit_events_identity_required
// but is also asserted here so violations fail fast in the caller rather
// than round-tripping to postgres.
func (e AuditEvent) Validate() error {
	if !e.HasSession() && !e.HasUser() {
		return fmt.Errorf("auditlog: session_id or user_id required")
	}
	if e.Action == "" {
		return fmt.Errorf("auditlog: action must not be empty")
	}
	return nil
}
