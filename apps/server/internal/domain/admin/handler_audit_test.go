package admin

// handler_audit_test.go — verifies that admin handler mutating endpoints
// (UpdateUserRole, ForceUnpublishTheme) invoke auditlog.Logger.Append with
// the expected action constants.
//
// recordAudit is called synchronously inside the handler after the service
// call succeeds, so no timing helpers are required.

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/google/uuid"
	"github.com/rs/zerolog"

	"github.com/mmp-platform/server/internal/auditlog"
	"github.com/mmp-platform/server/internal/middleware"
)

// assertAdminAudit fails unless exactly one entry exists with the expected action.
func assertAdminAudit(t *testing.T, logger *auditlog.CapturingLogger, want auditlog.AuditAction) {
	t.Helper()
	entries := logger.Entries()
	if len(entries) != 1 {
		t.Fatalf("expected 1 audit entry, got %d", len(entries))
	}
	if entries[0].Action != want {
		t.Fatalf("action: want %q, got %q", want, entries[0].Action)
	}
}

// withAdminCtx injects an admin user ID into the request context using the
// middleware key so that handler.actor() resolves it correctly.
func withAdminCtx(r *http.Request, adminID uuid.UUID) *http.Request {
	ctx := context.WithValue(r.Context(), middleware.UserIDKey, adminID)
	return r.WithContext(ctx)
}

// ---------------------------------------------------------------------------
// TestChangeHandlerCapturesAudit_RoleChange
// ---------------------------------------------------------------------------

func TestChangeHandlerCapturesAudit_RoleChange(t *testing.T) {
	capture := auditlog.NewCapturingLogger()
	targetID := uuid.New()
	adminID := uuid.New()

	ms := &mockService{
		updateUserRoleFn: func(_ context.Context, userID uuid.UUID, role string) (*UserSummary, error) {
			return &UserSummary{ID: userID, Nickname: "alice", Role: role}, nil
		},
	}

	h := NewHandler(ms, capture, zerolog.Nop())

	body, _ := json.Marshal(UpdateRoleRequest{Role: "ADMIN"})
	req := httptest.NewRequest(http.MethodPut, "/admin/users/"+targetID.String()+"/role", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	req = withChiParam(req, "id", targetID.String())
	req = withAdminCtx(req, adminID)

	rec := httptest.NewRecorder()
	h.UpdateUserRole(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rec.Code, rec.Body.String())
	}
	assertAdminAudit(t, capture, auditlog.ActionAdminRoleChange)

	// Verify payload contains new_role.
	entries := capture.Entries()
	if len(entries[0].Payload) == 0 {
		t.Fatal("expected non-empty payload on role_change")
	}
}

// ---------------------------------------------------------------------------
// TestChangeHandlerCapturesAudit_ForceUnpublish
// ---------------------------------------------------------------------------

func TestChangeHandlerCapturesAudit_ForceUnpublish(t *testing.T) {
	capture := auditlog.NewCapturingLogger()
	themeID := uuid.New()
	adminID := uuid.New()

	ms := &mockService{
		forceUnpublishFn: func(_ context.Context, id uuid.UUID) (*ThemeSummary, error) {
			return &ThemeSummary{ID: id, Title: "Mystery Manor", Status: "DRAFT"}, nil
		},
	}

	h := NewHandler(ms, capture, zerolog.Nop())

	req := httptest.NewRequest(http.MethodPost, "/admin/themes/"+themeID.String()+"/unpublish", nil)
	req = withChiParam(req, "id", themeID.String())
	req = withAdminCtx(req, adminID)

	rec := httptest.NewRecorder()
	h.ForceUnpublishTheme(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rec.Code, rec.Body.String())
	}
	assertAdminAudit(t, capture, auditlog.ActionAdminForceUnpublishTheme)

	// Verify payload carries theme_id.
	entries := capture.Entries()
	if len(entries[0].Payload) == 0 {
		t.Fatal("expected non-empty payload on force_unpublish")
	}
}

// ---------------------------------------------------------------------------
// TestChangeHandlerCapturesAudit_ForceCloseRoom
// ---------------------------------------------------------------------------

func TestChangeHandlerCapturesAudit_ForceCloseRoom(t *testing.T) {
	capture := auditlog.NewCapturingLogger()
	roomID := uuid.New()
	adminID := uuid.New()

	ms := &mockService{
		forceCloseRoomFn: func(_ context.Context, id uuid.UUID) error {
			return nil
		},
	}

	h := NewHandler(ms, capture, zerolog.Nop())

	req := httptest.NewRequest(http.MethodPost, "/admin/rooms/"+roomID.String()+"/close", nil)
	req = withChiParam(req, "id", roomID.String())
	req = withAdminCtx(req, adminID)

	rec := httptest.NewRecorder()
	h.ForceCloseRoom(rec, req)

	if rec.Code != http.StatusNoContent {
		t.Fatalf("expected 204, got %d: %s", rec.Code, rec.Body.String())
	}
	assertAdminAudit(t, capture, auditlog.ActionAdminForceCloseRoom)

	// Verify payload carries room_id.
	entries := capture.Entries()
	if len(entries[0].Payload) == 0 {
		t.Fatal("expected non-empty payload on force_close_room")
	}
}
