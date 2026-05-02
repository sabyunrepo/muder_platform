package editor

import (
	"context"
	"strings"
	"testing"

	"github.com/google/uuid"
)

// --- Characters ---

func TestNormalizeMysteryRole(t *testing.T) {
	tests := []struct {
		name      string
		role      string
		isCulprit bool
		want      string
		wantErr   bool
	}{
		{name: "empty role keeps legacy culprit flag", role: "", isCulprit: true, want: MysteryRoleCulprit},
		{name: "empty role defaults to suspect", role: "", isCulprit: false, want: MysteryRoleSuspect},
		{name: "explicit culprit can omit legacy flag", role: MysteryRoleCulprit, isCulprit: false, want: MysteryRoleCulprit},
		{name: "explicit detective is accepted", role: MysteryRoleDetective, isCulprit: false, want: MysteryRoleDetective},
		{name: "legacy culprit flag cannot conflict with explicit non-culprit role", role: MysteryRoleAccomplice, isCulprit: true, wantErr: true},
		{name: "unknown role is rejected", role: "host", isCulprit: false, wantErr: true},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			got, err := normalizeMysteryRole(tc.role, tc.isCulprit)
			if tc.wantErr {
				if err == nil {
					t.Fatal("expected error")
				}
				return
			}
			if err != nil {
				t.Fatalf("normalizeMysteryRole: %v", err)
			}
			if got != tc.want {
				t.Fatalf("role mismatch: got %q, want %q", got, tc.want)
			}
		})
	}
}

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

func TestService_ContentAPIRejectsRoleSheetKey(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test in short mode")
	}
	f := setupFixture(t)
	ctx := context.Background()
	creatorID := f.createUser(t)
	themeID := f.createThemeForUser(t, creatorID)

	_, err := f.svc.GetContent(ctx, creatorID, themeID, "role_sheet:character-1")
	if err == nil {
		t.Fatal("expected role_sheet key to be rejected by general content API")
	}
	if !strings.Contains(err.Error(), "invalid content key format") {
		t.Fatalf("expected invalid content key error, got %v", err)
	}

	_, err = f.svc.UpsertContent(ctx, creatorID, themeID, "role_sheet:character-1", "body")
	if err == nil {
		t.Fatal("expected role_sheet key upsert to be rejected by general content API")
	}
	if !strings.Contains(err.Error(), "invalid content key format") {
		t.Fatalf("expected invalid content key error, got %v", err)
	}
}

func TestService_UpsertAndGetCharacterRoleSheet(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test in short mode")
	}
	f := setupFixture(t)
	ctx := context.Background()
	creatorID := f.createUser(t)
	themeID := f.createThemeForUser(t, creatorID)
	char, err := f.svc.CreateCharacter(ctx, creatorID, themeID, CreateCharacterRequest{Name: "탐정"})
	if err != nil {
		t.Fatalf("CreateCharacter: %v", err)
	}

	missing, err := f.svc.GetCharacterRoleSheet(ctx, creatorID, char.ID)
	if err != nil {
		t.Fatalf("GetCharacterRoleSheet missing: %v", err)
	}
	if missing.Format != RoleSheetFormatMarkdown || missing.Markdown == nil || missing.Markdown.Body != "" {
		t.Fatalf("unexpected missing role sheet: %+v", missing)
	}

	upserted, err := f.svc.UpsertCharacterRoleSheet(ctx, creatorID, char.ID, UpsertRoleSheetRequest{
		Format:   RoleSheetFormatMarkdown,
		Markdown: &RoleSheetMarkdown{Body: "## 비밀\n알리바이"},
	})
	if err != nil {
		t.Fatalf("UpsertCharacterRoleSheet: %v", err)
	}
	if upserted.Markdown == nil || upserted.Markdown.Body != "## 비밀\n알리바이" {
		t.Fatalf("upserted body mismatch: %+v", upserted)
	}

	got, err := f.svc.GetCharacterRoleSheet(ctx, creatorID, char.ID)
	if err != nil {
		t.Fatalf("GetCharacterRoleSheet after upsert: %v", err)
	}
	if got.Markdown == nil || got.Markdown.Body != "## 비밀\n알리바이" {
		t.Fatalf("body mismatch after upsert: %+v", got)
	}
}

func TestService_GetCharacterRoleSheet_NotFound(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test in short mode")
	}
	f := setupFixture(t)
	ctx := context.Background()
	creatorID := f.createUser(t)

	_, err := f.svc.GetCharacterRoleSheet(ctx, creatorID, uuid.New())
	if err == nil {
		t.Fatal("expected missing character error")
	}
	if !strings.Contains(err.Error(), "character not found") {
		t.Fatalf("expected character not found error, got %v", err)
	}
}

func TestService_UpsertCharacterRoleSheet_RejectsUnsupportedFormat(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test in short mode")
	}
	f := setupFixture(t)
	ctx := context.Background()
	creatorID := f.createUser(t)
	themeID := f.createThemeForUser(t, creatorID)
	char, err := f.svc.CreateCharacter(ctx, creatorID, themeID, CreateCharacterRequest{Name: "용의자"})
	if err != nil {
		t.Fatalf("CreateCharacter: %v", err)
	}

	_, err = f.svc.UpsertCharacterRoleSheet(ctx, creatorID, char.ID, UpsertRoleSheetRequest{
		Format:   "pdf",
		Markdown: &RoleSheetMarkdown{Body: "later"},
	})
	if err == nil {
		t.Fatal("expected error for unsupported role sheet format")
	}
	if !strings.Contains(err.Error(), "unsupported role sheet format") {
		t.Fatalf("expected unsupported format error, got %v", err)
	}
}

func TestService_UpsertCharacterRoleSheet_RejectsMissingMarkdown(t *testing.T) {
	svc := &service{}

	_, err := svc.UpsertCharacterRoleSheet(context.Background(), uuid.New(), uuid.New(), UpsertRoleSheetRequest{
		Format: RoleSheetFormatMarkdown,
	})
	if err == nil {
		t.Fatal("expected error for missing markdown role sheet body")
	}
	if !strings.Contains(err.Error(), "markdown role sheet body is required") {
		t.Fatalf("expected missing markdown error, got %v", err)
	}
}

func TestService_UpsertCharacterRoleSheet_RejectsTooLongBody(t *testing.T) {
	svc := &service{}

	_, err := svc.UpsertCharacterRoleSheet(context.Background(), uuid.New(), uuid.New(), UpsertRoleSheetRequest{
		Format:   RoleSheetFormatMarkdown,
		Markdown: &RoleSheetMarkdown{Body: strings.Repeat("a", maxRoleSheetBodyBytes+1)},
	})
	if err == nil {
		t.Fatal("expected error for too long role sheet body")
	}
	if !strings.Contains(err.Error(), "role sheet body is too long") {
		t.Fatalf("expected too long body error, got %v", err)
	}
}
