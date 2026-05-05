package ws

import (
	"encoding/json"
	"testing"

	"github.com/mmp-platform/server/internal/apperror"
)

func TestNewErrorEnvelope_IncludesRecoveryMetadata(t *testing.T) {
	env := NewErrorEnvelope(ErrCodeRateLimited, "too many requests")

	var payload ErrorPayload
	if err := json.Unmarshal(env.Payload, &payload); err != nil {
		t.Fatalf("unmarshal ErrorPayload: %v", err)
	}

	if payload.Code != ErrCodeRateLimited {
		t.Fatalf("Code = %d, want %d", payload.Code, ErrCodeRateLimited)
	}
	if payload.AppCode != apperror.ErrSessionInboxFull {
		t.Fatalf("AppCode = %q, want %q", payload.AppCode, apperror.ErrSessionInboxFull)
	}
	if payload.Severity == "" {
		t.Fatal("Severity is empty")
	}
	if !payload.Retryable {
		t.Fatal("Retryable = false, want true")
	}
	if payload.UserAction != "retry_later" {
		t.Fatalf("UserAction = %q, want retry_later", payload.UserAction)
	}
	if payload.RequestID == "" || payload.CorrelationID == "" {
		t.Fatalf("request/correlation id missing: %#v", payload)
	}
	if payload.RequestID != payload.CorrelationID {
		t.Fatalf("RequestID %q must mirror CorrelationID %q", payload.RequestID, payload.CorrelationID)
	}
	if payload.Fatal {
		t.Fatal("Fatal = true, want false")
	}
}

func TestNewFatalErrorEnvelope_MarksTerminalFailure(t *testing.T) {
	env := NewFatalErrorEnvelope(ErrCodeUnauthorized, "invalid session")

	var payload ErrorPayload
	if err := json.Unmarshal(env.Payload, &payload); err != nil {
		t.Fatalf("unmarshal ErrorPayload: %v", err)
	}

	if !payload.Fatal {
		t.Fatal("Fatal = false, want true")
	}
	if payload.Retryable {
		t.Fatal("Retryable = true, want false")
	}
}

func TestNewAppErrorEnvelope_RedactsDetail(t *testing.T) {
	appErr := apperror.New(
		apperror.ErrReadingAdvanceForbidden,
		403,
		"role detective cannot advance line 4 in hidden room",
	)
	env := NewAppErrorEnvelope(appErr, false)

	var payload ErrorPayload
	if err := json.Unmarshal(env.Payload, &payload); err != nil {
		t.Fatalf("unmarshal ErrorPayload: %v", err)
	}

	if payload.AppCode != apperror.ErrReadingAdvanceForbidden {
		t.Fatalf("AppCode = %q, want %q", payload.AppCode, apperror.ErrReadingAdvanceForbidden)
	}
	if payload.Message == appErr.Detail {
		t.Fatal("Message leaked AppError.Detail")
	}
	if payload.UserAction != "wait" {
		t.Fatalf("UserAction = %q, want wait", payload.UserAction)
	}
}
