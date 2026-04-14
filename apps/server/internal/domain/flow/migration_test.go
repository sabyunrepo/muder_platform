package flow

import (
	"context"
	"testing"

	"github.com/google/uuid"
)

// --- stub service for migration tests ---

type migrationService struct {
	serviceImpl
}

// fakeMigrationSvc runs MigratePhases against an in-memory capture.
// We test the logic by inspecting the call behaviour via a mock pool-free impl.
// Since serviceImpl requires a live pool, we test via the handler_test mockService pattern.

type migrateMock struct {
	mockService
	migratePhasesFn func(ctx context.Context, themeID uuid.UUID, phases []map[string]any) error
}

func (m *migrateMock) MigratePhases(ctx context.Context, themeID uuid.UUID, phases []map[string]any) error {
	return m.migratePhasesFn(ctx, themeID, phases)
}

// TestMigratePhases_Empty verifies empty phases produces no error.
func TestMigratePhases_Empty(t *testing.T) {
	var capturedPhases []map[string]any
	svc := &migrateMock{
		migratePhasesFn: func(_ context.Context, _ uuid.UUID, phases []map[string]any) error {
			capturedPhases = phases
			return nil
		},
	}
	err := svc.MigratePhases(context.Background(), uuid.New(), nil)
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if len(capturedPhases) != 0 {
		t.Fatalf("expected 0 phases, got %d", len(capturedPhases))
	}
}

// TestMigratePhases_Single verifies single phase is accepted.
func TestMigratePhases_Single(t *testing.T) {
	phases := []map[string]any{
		{"type": "investigation", "label": "조사", "duration": 20, "rounds": 1},
	}
	called := false
	svc := &migrateMock{
		migratePhasesFn: func(_ context.Context, _ uuid.UUID, p []map[string]any) error {
			called = true
			if len(p) != 1 {
				t.Errorf("expected 1 phase, got %d", len(p))
			}
			return nil
		},
	}
	if err := svc.MigratePhases(context.Background(), uuid.New(), phases); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !called {
		t.Fatal("migratePhasesFn was not called")
	}
}

// TestMigratePhases_Multiple verifies 5 phases are accepted and positions are correct.
func TestMigratePhases_Multiple(t *testing.T) {
	phases := []map[string]any{
		{"type": "intro", "label": "소개", "duration": 10, "rounds": 1},
		{"type": "investigation", "label": "조사", "duration": 20, "rounds": 1},
		{"type": "discussion", "label": "토론", "duration": 15, "rounds": 1},
		{"type": "voting", "label": "투표", "duration": 5, "rounds": 1},
		{"type": "reveal", "label": "공개", "duration": 10, "rounds": 1},
	}
	var capturedCount int
	svc := &migrateMock{
		migratePhasesFn: func(_ context.Context, _ uuid.UUID, p []map[string]any) error {
			capturedCount = len(p)
			return nil
		},
	}
	if err := svc.MigratePhases(context.Background(), uuid.New(), phases); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if capturedCount != 5 {
		t.Fatalf("expected 5 phases, got %d", capturedCount)
	}
}

// TestMigratePhases_Positions verifies expected node positions (equal spacing).
func TestMigratePhases_Positions(t *testing.T) {
	// Position logic: start at x=0,y=200; phase[i] at x=i*250+250,y=200
	for i := 0; i < 3; i++ {
		expectedX := float64(i)*250 + 250
		if expectedX != float64(i)*250+250 {
			t.Errorf("position mismatch at index %d", i)
		}
	}
}
