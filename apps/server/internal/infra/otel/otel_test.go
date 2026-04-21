package otel

import (
	"context"
	"testing"
)

func TestInit_EmptyEndpoint_ReturnsNoopCleanup(t *testing.T) {
	cfg := Config{
		Endpoint:    "",
		ServiceName: "test-svc",
		Version:     "v0.0.1",
		Environment: "test",
	}

	cleanup, err := Init(context.Background(), cfg)
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if cleanup == nil {
		t.Fatal("expected non-nil cleanup func")
	}
	// no-op cleanup must not error
	if err := cleanup(context.Background()); err != nil {
		t.Fatalf("cleanup returned unexpected error: %v", err)
	}
}

func TestInit_DefaultSampleRate_NoopPath(t *testing.T) {
	// SampleRate=0 triggers the defaulting branch (sampleRate = 0.1).
	// With empty endpoint we confirm Init returns without error — the
	// defaulting logic runs only when a real exporter is created, so this
	// test validates the no-op path does not panic.
	cfg := Config{
		Endpoint:    "",
		ServiceName: "test-svc",
		SampleRate:  0,
	}

	cleanup, err := Init(context.Background(), cfg)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	_ = cleanup(context.Background())
}

func TestInit_NegativeSampleRate_NoopPath(t *testing.T) {
	cfg := Config{
		Endpoint:   "",
		SampleRate: -1.0,
	}

	cleanup, err := Init(context.Background(), cfg)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	_ = cleanup(context.Background())
}

func TestInit_InsecureFlag_NoRealEndpoint(t *testing.T) {
	// Insecure=true path: with an empty endpoint we still get a no-op
	// cleanup. The real insecure-exporter path requires network; we
	// verify the branch is not panicking for the no-endpoint guard.
	cfg := Config{
		Endpoint: "",
		Insecure: true,
	}

	cleanup, err := Init(context.Background(), cfg)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if err := cleanup(context.Background()); err != nil {
		t.Fatalf("cleanup error: %v", err)
	}
}
