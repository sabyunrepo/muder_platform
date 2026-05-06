package editor

import (
	"context"
	"encoding/json"
	"testing"

	"github.com/google/uuid"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// TestService_CreateTheme_HappyPath verifies a theme can be created and
// retrieved via GetTheme.
func TestService_CreateTheme_HappyPath(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test in short mode")
	}
	f := setupFixture(t)
	ctx := context.Background()
	creatorID := f.createUser(t)

	resp, err := f.svc.CreateTheme(ctx, creatorID, CreateThemeRequest{
		Title:       "Test Mystery",
		MinPlayers:  2,
		MaxPlayers:  6,
		DurationMin: 90,
	})
	if err != nil {
		t.Fatalf("CreateTheme: %v", err)
	}
	if resp.ID == [16]byte{} {
		t.Error("expected non-zero theme ID")
	}
	if resp.Title != "Test Mystery" {
		t.Errorf("title mismatch: got %q", resp.Title)
	}
	if resp.Status != "DRAFT" {
		t.Errorf("expected DRAFT status, got %q", resp.Status)
	}
	if resp.Slug == "" {
		t.Error("expected non-empty slug")
	}
}

func TestService_GetTheme_OwnershipEnforced(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test in short mode")
	}
	f := setupFixture(t)
	ctx := context.Background()
	creatorID := f.createUser(t)
	otherID := f.createUser(t)
	themeID := f.createThemeForUser(t, creatorID)

	// owner can retrieve
	resp, err := f.svc.GetTheme(ctx, creatorID, themeID)
	if err != nil {
		t.Fatalf("GetTheme owner: %v", err)
	}
	if resp.ID != themeID {
		t.Errorf("ID mismatch")
	}

	// non-owner must be forbidden
	_, err = f.svc.GetTheme(ctx, otherID, themeID)
	if err == nil {
		t.Fatal("expected error for non-owner GetTheme")
	}
}

func TestService_ListMyThemes(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test in short mode")
	}
	f := setupFixture(t)
	ctx := context.Background()
	creatorID := f.createUser(t)

	// zero themes initially
	themes, err := f.svc.ListMyThemes(ctx, creatorID)
	if err != nil {
		t.Fatalf("ListMyThemes empty: %v", err)
	}
	if len(themes) != 0 {
		t.Errorf("expected 0 themes, got %d", len(themes))
	}

	// create two themes
	f.createThemeForUser(t, creatorID)
	f.createThemeForUser(t, creatorID)

	themes, err = f.svc.ListMyThemes(ctx, creatorID)
	if err != nil {
		t.Fatalf("ListMyThemes: %v", err)
	}
	if len(themes) != 2 {
		t.Errorf("expected 2 themes, got %d", len(themes))
	}
}

func TestService_UpdateTheme(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test in short mode")
	}
	f := setupFixture(t)
	ctx := context.Background()
	creatorID := f.createUser(t)
	themeID := f.createThemeForUser(t, creatorID)

	resp, err := f.svc.UpdateTheme(ctx, creatorID, themeID, UpdateThemeRequest{
		Title:       "Updated Title",
		MinPlayers:  3,
		MaxPlayers:  8,
		DurationMin: 120,
	})
	if err != nil {
		t.Fatalf("UpdateTheme: %v", err)
	}
	if resp.Title != "Updated Title" {
		t.Errorf("title not updated: got %q", resp.Title)
	}
	if resp.MinPlayers != 3 {
		t.Errorf("min_players not updated: got %d", resp.MinPlayers)
	}
}

func TestService_UpdateTheme_CoverImageMediaReference(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test in short mode")
	}
	f := setupFixture(t)
	ctx := context.Background()
	creatorID := f.createUser(t)
	themeID := f.createThemeForUser(t, creatorID)
	otherThemeID := f.createThemeForUser(t, creatorID)
	media := createLocationMedia(t, f.q, themeID, "커버 이미지", MediaTypeImage)
	otherThemeMedia := createLocationMedia(t, f.q, otherThemeID, "다른 테마 이미지", MediaTypeImage)
	voiceMedia := createLocationMedia(t, f.q, themeID, "음성", MediaTypeVoice)

	updated, err := f.svc.UpdateTheme(ctx, creatorID, themeID, UpdateThemeRequest{
		Title:             "커버 참조 테마",
		CoverImageMediaID: OptionalUUID{Set: true, Value: uuidPtr(media.ID)},
		MinPlayers:        2,
		MaxPlayers:        6,
		DurationMin:       90,
	})
	if err != nil {
		t.Fatalf("UpdateTheme with cover image media: %v", err)
	}
	if updated.CoverImageMediaID == nil || *updated.CoverImageMediaID != media.ID {
		t.Fatalf("CoverImageMediaID = %v, want %s", updated.CoverImageMediaID, media.ID)
	}

	if _, err := f.svc.UpdateTheme(ctx, creatorID, updated.ID, UpdateThemeRequest{
		Title:             updated.Title,
		CoverImageMediaID: OptionalUUID{Set: true, Value: uuidPtr(otherThemeMedia.ID)},
		MinPlayers:        updated.MinPlayers,
		MaxPlayers:        updated.MaxPlayers,
		DurationMin:       updated.DurationMin,
	}); !isMediaNotInTheme(err) {
		t.Fatalf("UpdateTheme with other theme media error = %T %v, want media not in theme", err, err)
	}

	if _, err := f.svc.UpdateTheme(ctx, creatorID, updated.ID, UpdateThemeRequest{
		Title:             updated.Title,
		CoverImageMediaID: OptionalUUID{Set: true, Value: uuidPtr(voiceMedia.ID)},
		MinPlayers:        updated.MinPlayers,
		MaxPlayers:        updated.MaxPlayers,
		DurationMin:       updated.DurationMin,
	}); !isMediaNotInTheme(err) {
		t.Fatalf("UpdateTheme with non-image media error = %T %v, want media not in theme", err, err)
	}

	cleared, err := f.svc.UpdateTheme(ctx, creatorID, updated.ID, UpdateThemeRequest{
		Title:             updated.Title,
		CoverImageMediaID: OptionalUUID{Set: true},
		MinPlayers:        updated.MinPlayers,
		MaxPlayers:        updated.MaxPlayers,
		DurationMin:       updated.DurationMin,
	})
	if err != nil {
		t.Fatalf("UpdateTheme clear cover image media: %v", err)
	}
	if cleared.CoverImageMediaID != nil {
		t.Fatalf("CoverImageMediaID after clear = %v, want nil", cleared.CoverImageMediaID)
	}
}

func uuidPtr(id uuid.UUID) *uuid.UUID {
	return &id
}

func TestService_UpdateTheme_ForbiddenForNonOwner(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test in short mode")
	}
	f := setupFixture(t)
	ctx := context.Background()
	creatorID := f.createUser(t)
	otherID := f.createUser(t)
	themeID := f.createThemeForUser(t, creatorID)

	_, err := f.svc.UpdateTheme(ctx, otherID, themeID, UpdateThemeRequest{
		Title:       "Hack",
		MinPlayers:  2,
		MaxPlayers:  6,
		DurationMin: 60,
	})
	if err == nil {
		t.Fatal("expected forbidden error")
	}
}

func TestService_DeleteTheme_DraftOnly(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test in short mode")
	}
	f := setupFixture(t)
	ctx := context.Background()
	creatorID := f.createUser(t)
	themeID := f.createThemeForUser(t, creatorID)

	if err := f.svc.DeleteTheme(ctx, creatorID, themeID); err != nil {
		t.Fatalf("DeleteTheme: %v", err)
	}

	// after deletion GetTheme must return not-found
	_, err := f.svc.GetTheme(ctx, creatorID, themeID)
	if err == nil {
		t.Fatal("expected error after deletion")
	}
}

func TestService_DeleteTheme_ForbiddenForNonOwner(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test in short mode")
	}
	f := setupFixture(t)
	ctx := context.Background()
	creatorID := f.createUser(t)
	otherID := f.createUser(t)
	themeID := f.createThemeForUser(t, creatorID)

	if err := f.svc.DeleteTheme(ctx, otherID, themeID); err == nil {
		t.Fatal("expected forbidden error for non-owner")
	}
}

// TestGetTheme_AppliesNormalizer verifies that GetTheme normalizes a legacy
// config_json on the read path (D-20 lazy-on-read): clue_placement is promoted
// to locationClueConfig.clueIds, modules array is converted to object map.
func TestGetTheme_AppliesNormalizer(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test in short mode")
	}
	f := setupFixture(t)
	ctx := context.Background()
	creatorID := f.createUser(t)

	// Insert legacy shape directly (bypasses UpdateConfigJson write validation).
	legacy := json.RawMessage(`{
		"modules": [{"id": "voting"}],
		"clue_placement": {"c1": "library"},
		"locations": [{"id": "library"}]
	}`)
	themeID := f.insertThemeWithRawConfig(t, creatorID, legacy)

	got, err := f.svc.GetTheme(ctx, creatorID, themeID)
	require.NoError(t, err)

	var cfg map[string]any
	require.NoError(t, json.Unmarshal(got.ConfigJson, &cfg))

	// modules must be an object map, not an array.
	mods, ok := cfg["modules"].(map[string]any)
	require.True(t, ok, "modules must be an object map after normalization")
	require.Contains(t, mods, "voting")

	// clue_placement must be absent (promoted to locationClueConfig.clueIds).
	_, hasOldKey := cfg["clue_placement"]
	assert.False(t, hasOldKey, "lazy-on-read: clue_placement absent in response")

	// locations[0].locationClueConfig.clueIds must contain "c1".
	locs, ok := cfg["locations"].([]any)
	require.True(t, ok, "locations must be a list")
	require.Len(t, locs, 1)
	locMap, ok := locs[0].(map[string]any)
	require.True(t, ok)
	locClueCfg, ok := locMap["locationClueConfig"].(map[string]any)
	require.True(t, ok, "locationClueConfig must be present")
	clueIDs, ok := locClueCfg["clueIds"].([]any)
	require.True(t, ok, "clueIds must be a list")
	assert.Equal(t, []any{"c1"}, clueIDs)
}
