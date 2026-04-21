package otel

import (
	"bytes"
	"context"
	"testing"

	"github.com/rs/zerolog"
)

func TestLogHook_NilContext_NoOp(t *testing.T) {
	var buf bytes.Buffer
	log := zerolog.New(&buf).Hook(LogHook{})

	// No context on the event — hook must not panic.
	log.Info().Msg("no context")

	if buf.Len() == 0 {
		t.Fatal("expected log output")
	}
}

func TestLogHook_BackgroundContext_NoSpan(t *testing.T) {
	var buf bytes.Buffer
	log := zerolog.New(&buf).Hook(LogHook{})

	// Background context has no active span — span.SpanContext() is invalid,
	// so the hook should not inject trace_id/span_id.
	log.Info().Ctx(context.Background()).Msg("no span")

	out := buf.String()
	if out == "" {
		t.Fatal("expected log output")
	}
	// trace_id should NOT appear when there is no valid span
	if contains(out, "trace_id") {
		t.Errorf("trace_id should not appear without a valid span, got: %s", out)
	}
}

func TestLogHook_ImplementsZerologHook(t *testing.T) {
	// compile-time interface check surfaced as runtime assertion
	var _ zerolog.Hook = LogHook{}
}

// contains is a simple string substring check to avoid importing strings in
// the test package unnecessarily.
func contains(s, sub string) bool {
	return len(s) >= len(sub) && (s == sub || len(sub) == 0 ||
		func() bool {
			for i := 0; i <= len(s)-len(sub); i++ {
				if s[i:i+len(sub)] == sub {
					return true
				}
			}
			return false
		}())
}
