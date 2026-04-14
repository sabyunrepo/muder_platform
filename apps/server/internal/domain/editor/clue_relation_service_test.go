package editor

import (
	"context"
	"testing"

	"github.com/google/uuid"
	"github.com/mmp-platform/server/internal/db"
)

// Tests require testcontainers (Docker). Each test sets up its own container.

func TestClueRelation_FKCascadeOnClueDelete(t *testing.T) {
	f := setupFixture(t)
	ctx := context.Background()

	creatorID := f.createUser(t)
	themeID := f.createThemeForUser(t, creatorID)
	clueA := f.createClue(t, themeID, "단서A")
	clueB := f.createClue(t, themeID, "단서B")

	// Insert relation A→B
	_, err := f.q.BulkInsertClueRelations(ctx, db.BulkInsertClueRelationsParams{
		Column1: themeID,
		Column2: []uuid.UUID{clueA},
		Column3: []uuid.UUID{clueB},
		Column4: []string{"AND"},
	})
	if err != nil {
		t.Fatalf("BulkInsertClueRelations: %v", err)
	}

	// Confirm 1 relation exists
	rows, err := f.q.ListClueRelationsByTheme(ctx, themeID)
	if err != nil || len(rows) != 1 {
		t.Fatalf("expected 1 relation, got %d (err=%v)", len(rows), err)
	}

	// Delete clue A — ON DELETE CASCADE removes the relation
	if _, err := f.pool.Exec(ctx, `DELETE FROM theme_clues WHERE id=$1`, clueA); err != nil {
		t.Fatalf("delete clue: %v", err)
	}

	rows, err = f.q.ListClueRelationsByTheme(ctx, themeID)
	if err != nil {
		t.Fatalf("ListClueRelationsByTheme after delete: %v", err)
	}
	if len(rows) != 0 {
		t.Errorf("expected 0 relations after cascade, got %d", len(rows))
	}
}

func TestClueRelation_CrossThemeRejection(t *testing.T) {
	f := setupFixture(t)
	ctx := context.Background()

	creatorID := f.createUser(t)
	themeA := f.createThemeForUser(t, creatorID)
	themeB := f.createThemeForUser(t, creatorID)

	clueInA := f.createClue(t, themeA, "단서A")
	clueInB := f.createClue(t, themeB, "단서B")

	// Clue from themeA used in themeB's relations — service should reject
	_, err := f.svc.ReplaceClueRelations(ctx, creatorID, themeB, []ClueRelationRequest{
		{SourceID: clueInA, TargetID: clueInB, Mode: "AND"},
	})
	if err == nil {
		t.Fatal("expected error for cross-theme relation, got nil")
	}
}

func TestClueRelation_TxRollbackOnCycle(t *testing.T) {
	f := setupFixture(t)
	ctx := context.Background()

	creatorID := f.createUser(t)
	themeID := f.createThemeForUser(t, creatorID)
	clueA := f.createClue(t, themeID, "단서A")
	clueB := f.createClue(t, themeID, "단서B")

	// Establish valid relation A→B
	if _, err := f.svc.ReplaceClueRelations(ctx, creatorID, themeID, []ClueRelationRequest{
		{SourceID: clueA, TargetID: clueB, Mode: "AND"},
	}); err != nil {
		t.Fatalf("initial ReplaceClueRelations: %v", err)
	}

	// Attempt cycle A→B, B→A — must fail
	if _, err := f.svc.ReplaceClueRelations(ctx, creatorID, themeID, []ClueRelationRequest{
		{SourceID: clueA, TargetID: clueB, Mode: "AND"},
		{SourceID: clueB, TargetID: clueA, Mode: "AND"},
	}); err == nil {
		t.Fatal("expected CYCLE_DETECTED error, got nil")
	}

	// TX must have rolled back: original A→B relation should still exist
	rows, err := f.q.ListClueRelationsByTheme(ctx, themeID)
	if err != nil {
		t.Fatalf("ListClueRelationsByTheme: %v", err)
	}
	if len(rows) != 1 {
		t.Errorf("expected 1 relation after cycle rollback, got %d", len(rows))
	}
}
