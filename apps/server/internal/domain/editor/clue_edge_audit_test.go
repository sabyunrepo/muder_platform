package editor

// clue_edge_audit_test.go — verifies that ReplaceClueEdges emits the expected
// auditlog entry (ActionEditorClueEdgesReplace) via an injected
// CapturingLogger.
//
// Handler.recordAudit is called synchronously after a successful service
// call, so no timing helpers are needed.

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
)

// assertEditorAudit fails unless exactly one entry exists with the expected action.
func assertEditorAudit(t *testing.T, logger *auditlog.CapturingLogger, want auditlog.AuditAction) {
	t.Helper()
	entries := logger.Entries()
	if len(entries) != 1 {
		t.Fatalf("expected 1 audit entry, got %d", len(entries))
	}
	if entries[0].Action != want {
		t.Fatalf("action: want %q, got %q", want, entries[0].Action)
	}
}

// ---------------------------------------------------------------------------
// TestChangeHandlerCapturesAudit_ClueEdgesReplace
// ---------------------------------------------------------------------------

func TestChangeHandlerCapturesAudit_ClueEdgesReplace(t *testing.T) {
	capture := auditlog.NewCapturingLogger()
	replacedID := uuid.New()

	ms := &mockService{
		replaceClueEdgesFn: func(_ context.Context, creatorID, themeID uuid.UUID, reqs []ClueEdgeGroupRequest) ([]ClueEdgeGroupResponse, error) {
			return []ClueEdgeGroupResponse{{
				ID:       replacedID,
				TargetID: reqs[0].TargetID,
				Sources:  reqs[0].Sources,
				Trigger:  reqs[0].Trigger,
				Mode:     reqs[0].Mode,
			}}, nil
		},
	}

	h := NewHandler(ms, capture, zerolog.Nop())

	body, _ := json.Marshal([]ClueEdgeGroupRequest{{
		TargetID: uuid.New(),
		Sources:  []uuid.UUID{uuid.New()},
		Trigger:  "AUTO",
		Mode:     "AND",
	}})
	req := httptest.NewRequest(http.MethodPut, "/editor/themes/"+testThemeID.String()+"/clue-edges", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	req = withAuth(req)
	req = chiContext(req, map[string]string{"id": testThemeID.String()})

	rec := httptest.NewRecorder()
	h.ReplaceClueEdges(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rec.Code, rec.Body.String())
	}

	assertEditorAudit(t, capture, auditlog.ActionEditorClueEdgesReplace)

	// ActorID and UserID must point to the creator.
	entries := capture.Entries()
	if entries[0].ActorID == nil || *entries[0].ActorID != testCreatorID {
		t.Fatalf("ActorID: want %s, got %v", testCreatorID, entries[0].ActorID)
	}
	if entries[0].UserID == nil || *entries[0].UserID != testCreatorID {
		t.Fatalf("UserID: want %s, got %v", testCreatorID, entries[0].UserID)
	}
	// Payload must carry theme_id and counts.
	if len(entries[0].Payload) == 0 {
		t.Fatal("expected non-empty payload on clue_edges.replace")
	}
	var payload map[string]any
	if err := json.Unmarshal(entries[0].Payload, &payload); err != nil {
		t.Fatalf("payload unmarshal: %v", err)
	}
	if payload["theme_id"] != testThemeID.String() {
		t.Fatalf("payload.theme_id: want %s, got %v", testThemeID, payload["theme_id"])
	}
}
