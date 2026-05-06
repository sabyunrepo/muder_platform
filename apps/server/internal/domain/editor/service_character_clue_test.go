package editor

import (
	"context"
	"strings"
	"testing"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"

	"github.com/mmp-platform/server/internal/db"
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

func TestCharacterRolePolicy(t *testing.T) {
	tests := []struct {
		name                string
		role                string
		legacyIsCulprit     bool
		wantRole            string
		wantCulprit         bool
		wantSpoiler         bool
		wantVotingCandidate bool
		wantErr             bool
	}{
		{name: "empty role defaults to suspect", wantRole: MysteryRoleSuspect, wantVotingCandidate: true},
		{name: "legacy culprit flag maps to culprit", legacyIsCulprit: true, wantRole: MysteryRoleCulprit, wantCulprit: true, wantSpoiler: true, wantVotingCandidate: true},
		{name: "explicit culprit is spoiler and candidate", role: MysteryRoleCulprit, wantRole: MysteryRoleCulprit, wantCulprit: true, wantSpoiler: true, wantVotingCandidate: true},
		{name: "accomplice is spoiler but not culprit", role: MysteryRoleAccomplice, wantRole: MysteryRoleAccomplice, wantSpoiler: true, wantVotingCandidate: true},
		{name: "detective is spoiler and excluded by default voting policy", role: MysteryRoleDetective, wantRole: MysteryRoleDetective, wantSpoiler: true, wantVotingCandidate: false},
		{name: "legacy culprit cannot conflict with detective", role: MysteryRoleDetective, legacyIsCulprit: true, wantErr: true},
		{name: "unknown role is rejected", role: "gm", wantErr: true},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			got, err := BuildCharacterRolePolicy(tc.role, tc.legacyIsCulprit)
			if tc.wantErr {
				if err == nil {
					t.Fatal("expected error")
				}
				return
			}
			if err != nil {
				t.Fatalf("BuildCharacterRolePolicy: %v", err)
			}
			if got.MysteryRole != tc.wantRole {
				t.Fatalf("MysteryRole = %q, want %q", got.MysteryRole, tc.wantRole)
			}
			if got.IsCulprit != tc.wantCulprit {
				t.Fatalf("IsCulprit = %v, want %v", got.IsCulprit, tc.wantCulprit)
			}
			if got.IsSpoiler != tc.wantSpoiler {
				t.Fatalf("IsSpoiler = %v, want %v", got.IsSpoiler, tc.wantSpoiler)
			}
			if got.DefaultVotingCandidate != tc.wantVotingCandidate {
				t.Fatalf("DefaultVotingCandidate = %v, want %v", got.DefaultVotingCandidate, tc.wantVotingCandidate)
			}
		})
	}
}

func TestCharacterVisibilityPolicy(t *testing.T) {
	tests := []struct {
		name  string
		role  string
		input CharacterVisibilityInput
		want  CharacterVisibilityPolicy
	}{
		{
			name: "playable suspect is visible and voting candidate by default",
			role: MysteryRoleSuspect,
			want: CharacterVisibilityPolicy{
				IsPlayable:        true,
				ShowInIntro:       true,
				CanSpeakInReading: true,
				IsVotingCandidate: true,
			},
		},
		{
			name: "detective is excluded from voting by default",
			role: MysteryRoleDetective,
			want: CharacterVisibilityPolicy{
				IsPlayable:        true,
				ShowInIntro:       true,
				CanSpeakInReading: true,
				IsVotingCandidate: false,
			},
		},
		{
			name: "npc is not voting candidate unless creator opts in",
			role: MysteryRoleSuspect,
			input: CharacterVisibilityInput{
				IsPlayable: boolPtr(false),
			},
			want: CharacterVisibilityPolicy{
				IsPlayable:        false,
				ShowInIntro:       true,
				CanSpeakInReading: true,
				IsVotingCandidate: false,
			},
		},
		{
			name: "creator overrides npc exposure independently",
			role: MysteryRoleSuspect,
			input: CharacterVisibilityInput{
				IsPlayable:        boolPtr(false),
				ShowInIntro:       boolPtr(false),
				CanSpeakInReading: boolPtr(true),
				IsVotingCandidate: boolPtr(true),
			},
			want: CharacterVisibilityPolicy{
				IsPlayable:        false,
				ShowInIntro:       false,
				CanSpeakInReading: true,
				IsVotingCandidate: true,
			},
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			rolePolicy, err := BuildCharacterRolePolicy(tc.role, false)
			if err != nil {
				t.Fatalf("BuildCharacterRolePolicy: %v", err)
			}
			got := BuildCharacterVisibilityPolicy(rolePolicy, tc.input)
			if got != tc.want {
				t.Fatalf("policy = %+v, want %+v", got, tc.want)
			}
		})
	}
}

func TestCharacterVisibilityPolicyWithDefaultsDisablesVotingWhenPlayableTurnsOff(t *testing.T) {
	got := BuildCharacterVisibilityPolicyWithDefaults(
		CharacterVisibilityInput{IsPlayable: boolPtr(false)},
		CharacterVisibilityPolicy{
			IsPlayable:        true,
			ShowInIntro:       true,
			CanSpeakInReading: true,
			IsVotingCandidate: true,
		},
	)

	if got.IsPlayable || got.IsVotingCandidate {
		t.Fatalf("NPC conversion should disable voting by default: %+v", got)
	}
	if !got.ShowInIntro || !got.CanSpeakInReading {
		t.Fatalf("unrelated visibility fields should be preserved: %+v", got)
	}
}

func boolPtr(value bool) *bool {
	return &value
}

func textPtr(value string) *string {
	return &value
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
	if !resp.IsPlayable || !resp.ShowInIntro || !resp.CanSpeakInReading || !resp.IsVotingCandidate {
		t.Errorf("default visibility policy not applied: %+v", resp)
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
		Name: "Original", SortOrder: 0, ImageURL: textPtr("https://cdn.example/original.webp"),
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
	if !updated.IsPlayable || !updated.ShowInIntro || !updated.CanSpeakInReading || !updated.IsVotingCandidate {
		t.Errorf("update should preserve default playable visibility: %+v", updated)
	}
	if updated.ImageURL == nil || *updated.ImageURL != "https://cdn.example/original.webp" {
		t.Fatalf("omitted image_url should preserve stored character image: %+v", updated.ImageURL)
	}

	clearedImage, err := f.svc.UpdateCharacter(ctx, creatorID, created.ID, UpdateCharacterRequest{
		Name:      "Updated",
		IsCulprit: true,
		SortOrder: 0,
		ImageURL:  textPtr(""),
	})
	if err != nil {
		t.Fatalf("UpdateCharacter clear image: %v", err)
	}
	if clearedImage.ImageURL != nil {
		t.Fatalf("empty image_url should clear stored character image: %+v", clearedImage.ImageURL)
	}
}

func TestService_CharacterEndcardContract(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test in short mode")
	}
	f := setupFixture(t)
	ctx := context.Background()
	creatorID := f.createUser(t)
	themeID := f.createThemeForUser(t, creatorID)

	created, err := f.svc.CreateCharacter(ctx, creatorID, themeID, CreateCharacterRequest{
		Name:            "탐정",
		EndcardTitle:    textPtr("탐정의 결말"),
		EndcardBody:     textPtr("사건 이후에도 기록을 이어간다."),
		EndcardImageURL: textPtr("https://cdn.example/endcard.webp"),
	})
	if err != nil {
		t.Fatalf("CreateCharacter: %v", err)
	}
	if created.EndcardTitle == nil || *created.EndcardTitle != "탐정의 결말" {
		t.Fatalf("EndcardTitle mismatch: %+v", created.EndcardTitle)
	}
	if created.EndcardBody == nil || *created.EndcardBody != "사건 이후에도 기록을 이어간다." {
		t.Fatalf("EndcardBody mismatch: %+v", created.EndcardBody)
	}
	if created.EndcardImageURL == nil || *created.EndcardImageURL != "https://cdn.example/endcard.webp" {
		t.Fatalf("EndcardImageURL mismatch: %+v", created.EndcardImageURL)
	}

	updated, err := f.svc.UpdateCharacter(ctx, creatorID, created.ID, UpdateCharacterRequest{
		Name:            "탐정 수정",
		MysteryRole:     created.MysteryRole,
		IsCulprit:       created.IsCulprit,
		SortOrder:       created.SortOrder,
		EndcardTitle:    textPtr("탐정의 후일담"),
		EndcardBody:     created.EndcardBody,
		EndcardImageURL: created.EndcardImageURL,
	})
	if err != nil {
		t.Fatalf("UpdateCharacter: %v", err)
	}
	if updated.EndcardTitle == nil || *updated.EndcardTitle != "탐정의 후일담" {
		t.Fatalf("updated EndcardTitle mismatch: %+v", updated.EndcardTitle)
	}

	listed, err := f.svc.ListCharacters(ctx, creatorID, themeID)
	if err != nil {
		t.Fatalf("ListCharacters: %v", err)
	}
	if len(listed) != 1 || listed[0].EndcardBody == nil || *listed[0].EndcardBody != "사건 이후에도 기록을 이어간다." {
		t.Fatalf("list endcard body mismatch: %+v", listed)
	}

	preserved, err := f.svc.UpdateCharacter(ctx, creatorID, created.ID, UpdateCharacterRequest{
		Name:        "탐정 이름만 수정",
		MysteryRole: updated.MysteryRole,
		IsCulprit:   updated.IsCulprit,
		SortOrder:   updated.SortOrder,
	})
	if err != nil {
		t.Fatalf("UpdateCharacter preserve: %v", err)
	}
	if preserved.EndcardTitle == nil || *preserved.EndcardTitle != "탐정의 후일담" {
		t.Fatalf("omitted endcard title should be preserved: %+v", preserved.EndcardTitle)
	}

	cleared, err := f.svc.UpdateCharacter(ctx, creatorID, created.ID, UpdateCharacterRequest{
		Name:         preserved.Name,
		MysteryRole:  preserved.MysteryRole,
		IsCulprit:    preserved.IsCulprit,
		SortOrder:    preserved.SortOrder,
		EndcardTitle: textPtr(""),
		EndcardBody:  textPtr(""),
	})
	if err != nil {
		t.Fatalf("UpdateCharacter clear: %v", err)
	}
	if cleared.EndcardTitle != nil || cleared.EndcardBody != nil {
		t.Fatalf("empty endcard fields should clear stored values: %+v", cleared)
	}
	if cleared.EndcardImageURL == nil || *cleared.EndcardImageURL != "https://cdn.example/endcard.webp" {
		t.Fatalf("omitted endcard image url should be preserved: %+v", cleared.EndcardImageURL)
	}

	clearedImage, err := f.svc.UpdateCharacter(ctx, creatorID, created.ID, UpdateCharacterRequest{
		Name:            cleared.Name,
		MysteryRole:     cleared.MysteryRole,
		IsCulprit:       cleared.IsCulprit,
		SortOrder:       cleared.SortOrder,
		EndcardImageURL: textPtr(""),
	})
	if err != nil {
		t.Fatalf("UpdateCharacter clear image: %v", err)
	}
	if clearedImage.EndcardImageURL != nil {
		t.Fatalf("empty endcard image url should clear stored value: %+v", clearedImage.EndcardImageURL)
	}
}

func TestService_CreateCharacterNPCVisibility(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test in short mode")
	}
	f := setupFixture(t)
	ctx := context.Background()
	creatorID := f.createUser(t)
	themeID := f.createThemeForUser(t, creatorID)

	resp, err := f.svc.CreateCharacter(ctx, creatorID, themeID, CreateCharacterRequest{
		Name:              "피해자",
		IsPlayable:        boolPtr(false),
		ShowInIntro:       boolPtr(true),
		CanSpeakInReading: boolPtr(true),
		SortOrder:         2,
	})
	if err != nil {
		t.Fatalf("CreateCharacter: %v", err)
	}

	if resp.IsPlayable {
		t.Fatal("NPC should not be playable")
	}
	if !resp.ShowInIntro || !resp.CanSpeakInReading {
		t.Fatalf("NPC intro/reading policy mismatch: %+v", resp)
	}
	if resp.IsVotingCandidate {
		t.Fatal("NPC should be excluded from voting by default")
	}
}

func TestService_UpdateCharacterPreservesVisibilityWhenOmitted(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test in short mode")
	}
	f := setupFixture(t)
	ctx := context.Background()
	creatorID := f.createUser(t)
	themeID := f.createThemeForUser(t, creatorID)

	created, err := f.svc.CreateCharacter(ctx, creatorID, themeID, CreateCharacterRequest{
		Name:        "피해자",
		IsPlayable:  boolPtr(false),
		ShowInIntro: boolPtr(false),
		SortOrder:   3,
	})
	if err != nil {
		t.Fatalf("create: %v", err)
	}

	updated, err := f.svc.UpdateCharacter(ctx, creatorID, created.ID, UpdateCharacterRequest{
		Name:        "피해자 수정",
		MysteryRole: created.MysteryRole,
		IsCulprit:   created.IsCulprit,
		SortOrder:   created.SortOrder,
	})
	if err != nil {
		t.Fatalf("UpdateCharacter: %v", err)
	}

	if updated.IsPlayable || updated.ShowInIntro || updated.IsVotingCandidate {
		t.Fatalf("visibility should be preserved when omitted: %+v", updated)
	}
	if !updated.CanSpeakInReading {
		t.Fatalf("reading policy should remain enabled: %+v", updated)
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

func TestRoleSheetResponseFromContent_LegacyRawMarkdownJSONLookalike(t *testing.T) {
	charID := uuid.New()
	themeID := uuid.New()
	raw := `{"format":"pdf","pdf":{"media_id":"00000000-0000-0000-0000-000000000000"}}`
	resp := roleSheetResponseFromContent(
		db.ThemeCharacter{ID: charID, ThemeID: themeID},
		db.ThemeContent{
			ThemeID: themeID,
			Key:     roleSheetContentKey(charID),
			Body:    `{"format":"pdf","pdf":{"media_id":"00000000-0000-0000-0000-000000000000"}}`,
		},
	)
	if resp.Format != RoleSheetFormatMarkdown || resp.Markdown == nil {
		t.Fatalf("legacy invalid PDF-looking markdown must remain markdown: %+v", resp)
	}
	if resp.Markdown.Body != raw {
		t.Fatalf("legacy markdown body must be preserved as-is: got %q", resp.Markdown.Body)
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
		Format: "audio",
	})
	if err == nil {
		t.Fatal("expected error for unsupported role sheet format")
	}
	if !strings.Contains(err.Error(), "unsupported role sheet format") {
		t.Fatalf("expected unsupported format error, got %v", err)
	}
}

func TestService_UpsertAndGetCharacterRoleSheetImages(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test in short mode")
	}
	f := setupFixture(t)
	ctx := context.Background()
	creatorID := f.createUser(t)
	themeID := f.createThemeForUser(t, creatorID)
	char, err := f.svc.CreateCharacter(ctx, creatorID, themeID, CreateCharacterRequest{Name: "이미지 캐릭터"})
	if err != nil {
		t.Fatalf("CreateCharacter: %v", err)
	}
	imageURLs := []string{
		" https://cdn.example.com/roles/char-1-page-1.webp ",
		"https://cdn.example.com/roles/char-1-page-2.png",
	}
	wantImageURLs := []string{
		"https://cdn.example.com/roles/char-1-page-1.webp",
		"https://cdn.example.com/roles/char-1-page-2.png",
	}

	upserted, err := f.svc.UpsertCharacterRoleSheet(ctx, creatorID, char.ID, UpsertRoleSheetRequest{
		Format: RoleSheetFormatImages,
		Images: &RoleSheetImages{ImageURLs: imageURLs},
	})
	if err != nil {
		t.Fatalf("UpsertCharacterRoleSheet images: %v", err)
	}
	if upserted.Format != RoleSheetFormatImages || upserted.Images == nil || upserted.Markdown != nil || upserted.PDF != nil {
		t.Fatalf("unexpected images role sheet response: %+v", upserted)
	}
	if strings.Join(upserted.Images.ImageURLs, ",") != strings.Join(wantImageURLs, ",") {
		t.Fatalf("image URLs order mismatch: got %+v, want %+v", upserted.Images.ImageURLs, wantImageURLs)
	}

	got, err := f.svc.GetCharacterRoleSheet(ctx, creatorID, char.ID)
	if err != nil {
		t.Fatalf("GetCharacterRoleSheet images: %v", err)
	}
	if got.Format != RoleSheetFormatImages || got.Images == nil || got.Markdown != nil || got.PDF != nil {
		t.Fatalf("unexpected stored images role sheet: %+v", got)
	}
	if strings.Join(got.Images.ImageURLs, ",") != strings.Join(wantImageURLs, ",") {
		t.Fatalf("stored image URLs order mismatch: got %+v, want %+v", got.Images.ImageURLs, wantImageURLs)
	}
}

func TestService_UpsertCharacterRoleSheet_RejectsInvalidImages(t *testing.T) {
	tests := []struct {
		name    string
		images  *RoleSheetImages
		wantErr string
	}{
		{name: "missing images", images: nil, wantErr: "image role sheet pages are required"},
		{name: "empty images", images: &RoleSheetImages{}, wantErr: "image role sheet pages are required"},
		{name: "blank URL", images: &RoleSheetImages{ImageURLs: []string{" "}}, wantErr: "image role sheet page URL is required"},
		{name: "relative URL", images: &RoleSheetImages{ImageURLs: []string{"/uploads/page-1.png"}}, wantErr: "image role sheet page URL must be a valid URL"},
		{name: "non web URL", images: &RoleSheetImages{ImageURLs: []string{"ftp://example.com/page-1.png"}}, wantErr: "image role sheet page URL must be a valid URL"},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			svc := &service{}
			_, err := svc.UpsertCharacterRoleSheet(context.Background(), uuid.New(), uuid.New(), UpsertRoleSheetRequest{
				Format: RoleSheetFormatImages,
				Images: tc.images,
			})
			if err == nil {
				t.Fatal("expected error for invalid image role sheet")
			}
			if !strings.Contains(err.Error(), tc.wantErr) {
				t.Fatalf("expected %q error, got %v", tc.wantErr, err)
			}
		})
	}
}

func TestService_UpsertAndGetCharacterRoleSheetPDF(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test in short mode")
	}
	f := setupFixture(t)
	ctx := context.Background()
	creatorID := f.createUser(t)
	themeID := f.createThemeForUser(t, creatorID)
	char, err := f.svc.CreateCharacter(ctx, creatorID, themeID, CreateCharacterRequest{Name: "PDF 캐릭터"})
	if err != nil {
		t.Fatalf("CreateCharacter: %v", err)
	}
	media, err := f.q.CreateMedia(ctx, db.CreateMediaParams{
		ThemeID:    themeID,
		Name:       "role-sheet.pdf",
		Type:       MediaTypeDocument,
		SourceType: SourceTypeFile,
		StorageKey: pgtype.Text{String: "themes/test/role-sheet.pdf", Valid: true},
		FileSize:   pgtype.Int8{Int64: 1024, Valid: true},
		MimeType:   pgtype.Text{String: "application/pdf", Valid: true},
		Tags:       []string{},
	})
	if err != nil {
		t.Fatalf("CreateMedia: %v", err)
	}

	upserted, err := f.svc.UpsertCharacterRoleSheet(ctx, creatorID, char.ID, UpsertRoleSheetRequest{
		Format: RoleSheetFormatPDF,
		PDF:    &RoleSheetPDF{MediaID: media.ID},
	})
	if err != nil {
		t.Fatalf("UpsertCharacterRoleSheet pdf: %v", err)
	}
	if upserted.Format != RoleSheetFormatPDF || upserted.PDF == nil || upserted.PDF.MediaID != media.ID || upserted.Markdown != nil {
		t.Fatalf("unexpected pdf role sheet response: %+v", upserted)
	}

	got, err := f.svc.GetCharacterRoleSheet(ctx, creatorID, char.ID)
	if err != nil {
		t.Fatalf("GetCharacterRoleSheet pdf: %v", err)
	}
	if got.Format != RoleSheetFormatPDF || got.PDF == nil || got.PDF.MediaID != media.ID || got.Markdown != nil {
		t.Fatalf("unexpected stored pdf role sheet: %+v", got)
	}
}

func TestService_UpsertCharacterRoleSheet_RejectsNonPDFMedia(t *testing.T) {
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
	media, err := f.q.CreateMedia(ctx, db.CreateMediaParams{
		ThemeID:    themeID,
		Name:       "voice.mp3",
		Type:       MediaTypeVoice,
		SourceType: SourceTypeFile,
		StorageKey: pgtype.Text{String: "themes/test/voice.mp3", Valid: true},
		FileSize:   pgtype.Int8{Int64: 1024, Valid: true},
		MimeType:   pgtype.Text{String: "audio/mpeg", Valid: true},
		Tags:       []string{},
	})
	if err != nil {
		t.Fatalf("CreateMedia: %v", err)
	}

	_, err = f.svc.UpsertCharacterRoleSheet(ctx, creatorID, char.ID, UpsertRoleSheetRequest{
		Format: RoleSheetFormatPDF,
		PDF:    &RoleSheetPDF{MediaID: media.ID},
	})
	if err == nil || !strings.Contains(err.Error(), "PDF document") {
		t.Fatalf("expected PDF document validation error, got %v", err)
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
