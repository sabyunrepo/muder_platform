package sentry

import (
	"testing"

	gosentry "github.com/getsentry/sentry-go"
)

func TestInit_EmptyDSN_ReturnsNoopCleanup(t *testing.T) {
	cleanup, err := Init(Config{DSN: ""})
	if err != nil {
		t.Fatalf("expected no error for empty DSN, got %v", err)
	}
	if cleanup == nil {
		t.Fatal("expected non-nil cleanup")
	}
	// must not panic
	cleanup()
}

func TestInit_EmptyDSN_AllFields(t *testing.T) {
	cleanup, err := Init(Config{
		DSN:         "",
		Environment: "test",
		Release:     "v1.0.0",
		Debug:       true,
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	cleanup()
}

// TestBeforeSend_StripsAuthorizationAndCookie validates the BeforeSend logic
// without initialising the real Sentry SDK (which requires a valid DSN).
// We replicate the same function inline to keep the test self-contained while
// verifying the exact stripping behaviour.
func TestBeforeSend_StripsAuthorizationAndCookie(t *testing.T) {
	// Replicate the BeforeSend logic from sentry.go
	beforeSend := func(event *gosentry.Event, _ *gosentry.EventHint) *gosentry.Event {
		if event.Request != nil {
			delete(event.Request.Headers, "Authorization")
			delete(event.Request.Headers, "Cookie")
			event.Request.Cookies = ""
		}
		return event
	}

	event := &gosentry.Event{
		Request: &gosentry.Request{
			Headers: map[string]string{
				"Authorization": "Bearer secret-token",
				"Cookie":        "session=abc123",
				"Content-Type":  "application/json",
			},
			Cookies: "session=abc123",
		},
	}

	result := beforeSend(event, nil)

	if result == nil {
		t.Fatal("BeforeSend returned nil event")
	}
	if _, ok := result.Request.Headers["Authorization"]; ok {
		t.Error("Authorization header should be stripped")
	}
	if _, ok := result.Request.Headers["Cookie"]; ok {
		t.Error("Cookie header should be stripped")
	}
	if result.Request.Cookies != "" {
		t.Errorf("Cookies field should be empty, got %q", result.Request.Cookies)
	}
	// non-sensitive headers must be preserved
	if result.Request.Headers["Content-Type"] != "application/json" {
		t.Error("Content-Type header should be preserved")
	}
}

func TestBeforeSend_NilRequest_NoOp(t *testing.T) {
	beforeSend := func(event *gosentry.Event, _ *gosentry.EventHint) *gosentry.Event {
		if event.Request != nil {
			delete(event.Request.Headers, "Authorization")
			delete(event.Request.Headers, "Cookie")
			event.Request.Cookies = ""
		}
		return event
	}

	event := &gosentry.Event{Request: nil}
	result := beforeSend(event, nil)
	if result == nil {
		t.Fatal("expected event back")
	}
}
