package editor

import (
	"context"
	"testing"
)

// --- Characters ---

func TestService_CreateCharacter(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test in short mode")
	}
	f := setupFixture(t)
	ctx := context.Background()
	creatorID := f.createUser(t)
	themeID := f.createThemeForUser(t, creatorID)

	resp, err := f.svc.CreateCharacter(ctx, creatorID, themeID, CreateCharacterRequest{
		Name:      "Detective Holmes",
		IsCulprit: false,
		SortOrder: 1,
	})
	if err != nil {
		t.Fatalf("CreateCharacter: %v", err)
	}
	if resp.Name != "Detective Holmes" {
		t.Errorf("name mismatch: got %q", resp.Name)
	}
	if resp.ThemeID != themeID {
		t.Errorf("themeID mismatch")
	}
}

func TestService_ListCharacters(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test in short mode")
	}
	f := setupFixture(t)
	ctx := context.Background()
	creatorID := f.createUser(t)
	themeID := f.createThemeForUser(t, creatorID)

	if _, err := f.svc.CreateCharacter(ctx, creatorID, themeID, CreateCharacterRequest{
		Name: "A", SortOrder: 0,
	}); err != nil {
		t.Fatalf("create char A: %v", err)
	}
	if _, err := f.svc.CreateCharacter(ctx, creatorID, themeID, CreateCharacterRequest{
		Name: "B", SortOrder: 1,
	}); err != nil {
		t.Fatalf("create char B: %v", err)
	}

	chars, err := f.svc.ListCharacters(ctx, creatorID, themeID)
	if err != nil {
		t.Fatalf("ListCharacters: %v", err)
	}
	if len(chars) != 2 {
		t.Errorf("expected 2 characters, got %d", len(chars))
	}
}

func TestService_UpdateCharacter(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test in short mode")
	}
	f := setupFixture(t)
	ctx := context.Background()
	creatorID := f.createUser(t)
	themeID := f.createThemeForUser(t, creatorID)

	created, err := f.svc.CreateCharacter(ctx, creatorID, themeID, CreateCharacterRequest{
		Name: "Original", SortOrder: 0,
	})
	if err != nil {
		t.Fatalf("create: %v", err)
	}

	updated, err := f.svc.UpdateCharacter(ctx, creatorID, created.ID, UpdateCharacterRequest{
		Name:      "Updated",
		IsCulprit: true,
		SortOrder: 0,
	})
	if err != nil {
		t.Fatalf("UpdateCharacter: %v", err)
	}
	if updated.Name != "Updated" {
		t.Errorf("name not updated: got %q", updated.Name)
	}
	if !updated.IsCulprit {
		t.Error("IsCulprit should be true")
	}
}

func TestService_DeleteCharacter(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test in short mode")
	}
	f := setupFixture(t)
	ctx := context.Background()
	creatorID := f.createUser(t)
	themeID := f.createThemeForUser(t, creatorID)

	created, err := f.svc.CreateCharacter(ctx, creatorID, themeID, CreateCharacterRequest{
		Name: "ToDelete", SortOrder: 0,
	})
	if err != nil {
		t.Fatalf("create: %v", err)
	}

	if err := f.svc.DeleteCharacter(ctx, creatorID, created.ID); err != nil {
		t.Fatalf("DeleteCharacter: %v", err)
	}

	chars, err := f.svc.ListCharacters(ctx, creatorID, themeID)
	if err != nil {
		t.Fatalf("ListCharacters: %v", err)
	}
	if len(chars) != 0 {
		t.Errorf("expected 0 chars after delete, got %d", len(chars))
	}
}

// --- Clues ---

func TestService_CreateClue(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test in short mode")
	}
	f := setupFixture(t)
	ctx := context.Background()
	creatorID := f.createUser(t)
	themeID := f.createThemeForUser(t, creatorID)

	resp, err := f.svc.CreateClue(ctx, creatorID, themeID, CreateClueRequest{
		Name:      "Bloody Knife",
		IsCommon:  false,
		Level:     2,
		SortOrder: 0,
	})
	if err != nil {
		t.Fatalf("CreateClue: %v", err)
	}
	if resp.Name != "Bloody Knife" {
		t.Errorf("name mismatch: got %q", resp.Name)
	}
	if resp.Level != 2 {
		t.Errorf("level mismatch: got %d", resp.Level)
	}
}

func TestService_ListClues(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test in short mode")
	}
	f := setupFixture(t)
	ctx := context.Background()
	creatorID := f.createUser(t)
	themeID := f.createThemeForUser(t, creatorID)

	for _, name := range []string{"Clue-A", "Clue-B", "Clue-C"} {
		if _, err := f.svc.CreateClue(ctx, creatorID, themeID, CreateClueRequest{
			Name: name, Level: 1, SortOrder: 0,
		}); err != nil {
			t.Fatalf("create clue %s: %v", name, err)
		}
	}

	clues, err := f.svc.ListClues(ctx, creatorID, themeID)
	if err != nil {
		t.Fatalf("ListClues: %v", err)
	}
	if len(clues) != 3 {
		t.Errorf("expected 3 clues, got %d", len(clues))
	}
}

func TestService_DeleteClue(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test in short mode")
	}
	f := setupFixture(t)
	ctx := context.Background()
	creatorID := f.createUser(t)
	themeID := f.createThemeForUser(t, creatorID)

	clue, err := f.svc.CreateClue(ctx, creatorID, themeID, CreateClueRequest{
		Name: "TempClue", Level: 1, SortOrder: 0,
	})
	if err != nil {
		t.Fatalf("create clue: %v", err)
	}

	if err := f.svc.DeleteClue(ctx, creatorID, clue.ID); err != nil {
		t.Fatalf("DeleteClue: %v", err)
	}

	clues, err := f.svc.ListClues(ctx, creatorID, themeID)
	if err != nil {
		t.Fatalf("ListClues: %v", err)
	}
	if len(clues) != 0 {
		t.Errorf("expected 0 clues after delete, got %d", len(clues))
	}
}

func TestService_ClueRoundOrderValidation(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test in short mode")
	}
	f := setupFixture(t)
	ctx := context.Background()
	creatorID := f.createUser(t)
	themeID := f.createThemeForUser(t, creatorID)

	r1 := int32(3)
	r2 := int32(1) // reveal > hide — must be rejected

	_, err := f.svc.CreateClue(ctx, creatorID, themeID, CreateClueRequest{
		Name:        "BadOrder",
		Level:       1,
		SortOrder:   0,
		RevealRound: &r1,
		HideRound:   &r2,
	})
	if err == nil {
		t.Fatal("expected validation error for reveal_round > hide_round")
	}
}

// --- Content ---

func TestService_UpsertAndGetContent(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test in short mode")
	}
	f := setupFixture(t)
	ctx := context.Background()
	creatorID := f.createUser(t)
	themeID := f.createThemeForUser(t, creatorID)

	// get non-existent key → empty body, no error
	resp, err := f.svc.GetContent(ctx, creatorID, themeID, "story")
	if err != nil {
		t.Fatalf("GetContent missing: %v", err)
	}
	if resp.Body != "" {
		t.Errorf("expected empty body, got %q", resp.Body)
	}

	// upsert
	upserted, err := f.svc.UpsertContent(ctx, creatorID, themeID, "story", "Once upon a time...")
	if err != nil {
		t.Fatalf("UpsertContent: %v", err)
	}
	if upserted.Body != "Once upon a time..." {
		t.Errorf("body mismatch: got %q", upserted.Body)
	}

	// get after upsert
	resp, err = f.svc.GetContent(ctx, creatorID, themeID, "story")
	if err != nil {
		t.Fatalf("GetContent after upsert: %v", err)
	}
	if resp.Body != "Once upon a time..." {
		t.Errorf("body mismatch after upsert: got %q", resp.Body)
	}
}

func TestService_GetContent_InvalidKey(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test in short mode")
	}
	f := setupFixture(t)
	ctx := context.Background()
	creatorID := f.createUser(t)
	themeID := f.createThemeForUser(t, creatorID)

	_, err := f.svc.GetContent(ctx, creatorID, themeID, "invalid key!")
	if err == nil {
		t.Fatal("expected validation error for invalid content key")
	}
}
