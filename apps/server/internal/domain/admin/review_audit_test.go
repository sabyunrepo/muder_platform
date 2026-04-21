package admin

// review_audit_test.go — verifies that ReviewHandler.recordAudit emits the
// expected auditlog entry via an injected CapturingLogger.
//
// ReviewHandler.recordAudit is an unexported method accessible within this
// package (same-package test file).  Calling it directly keeps the test
// hermetic and fast — no DB or HTTP machinery required.
//
// The test covers the ActionReviewApprove path as the representative case
// for all four review actions (approve / reject / suspend / trusted_creator),
// since they all delegate to the same recordAudit implementation.

import (
	"context"
	"testing"

	"github.com/google/uuid"
	"github.com/rs/zerolog"

	"github.com/mmp-platform/server/internal/auditlog"
)

// assertReviewAudit fails unless exactly one entry exists with the expected action.
func assertReviewAudit(t *testing.T, logger *auditlog.CapturingLogger, want auditlog.AuditAction) {
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
// TestChangeHandlerCapturesAudit_Approve
// ---------------------------------------------------------------------------

func TestChangeHandlerCapturesAudit_Approve(t *testing.T) {
	capture := auditlog.NewCapturingLogger()
	adminID := uuid.New()
	themeID := uuid.New()

	h := &ReviewHandler{
		q:      nil, // unused — we call recordAudit directly
		audit:  capture,
		logger: zerolog.Nop(),
	}

	h.recordAudit(
		context.Background(),
		auditlog.ActionReviewApprove,
		actorPtr(adminID),
		nil, // target nil → falls back to actor per review_handler.go lines 62-65
		map[string]any{"theme_id": themeID.String(), "note": "looks good"},
	)

	assertReviewAudit(t, capture, auditlog.ActionReviewApprove)

	// ActorID must be set.
	entries := capture.Entries()
	if entries[0].ActorID == nil {
		t.Fatal("expected ActorID to be non-nil for review.approve")
	}
	// Payload must be non-empty.
	if len(entries[0].Payload) == 0 {
		t.Fatal("expected non-empty payload on review.approve")
	}
}
