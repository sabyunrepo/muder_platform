package editor

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"testing"

	"github.com/jackc/pgx/v5"

	"github.com/mmp-platform/server/internal/db"
)

func TestService_DeleteCharacter_CleansEditorReferencesAndRoleSheet(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test in short mode")
	}
	f := setupFixture(t)
	ctx := context.Background()
	creatorID := f.createUser(t)
	themeID := f.createThemeForUser(t, creatorID)
	deleted, err := f.svc.CreateCharacter(ctx, creatorID, themeID, CreateCharacterRequest{Name: "삭제 캐릭터"})
	if err != nil {
		t.Fatalf("CreateCharacter deleted: %v", err)
	}
	kept, err := f.svc.CreateCharacter(ctx, creatorID, themeID, CreateCharacterRequest{Name: "남길 캐릭터"})
	if err != nil {
		t.Fatalf("CreateCharacter kept: %v", err)
	}
	if _, err := f.svc.UpsertCharacterRoleSheet(ctx, creatorID, deleted.ID, UpsertRoleSheetRequest{
		Format:   RoleSheetFormatMarkdown,
		Markdown: &RoleSheetMarkdown{Body: "삭제될 역할지"},
	}); err != nil {
		t.Fatalf("UpsertCharacterRoleSheet: %v", err)
	}

	theme, err := f.q.GetTheme(ctx, themeID)
	if err != nil {
		t.Fatalf("GetTheme: %v", err)
	}
	rawConfig := []byte(fmt.Sprintf(`{
		"modules": {"starting_clue": {"enabled": true, "config": {"startingClues": {"%s": ["clue-1"], "%s": ["clue-2"]}}}},
		"character_missions": {"%s": [{"id":"m1","targetCharacterId":"%s"}], "%s": [{"id":"m2"}]},
		"character_clues": {"%s": ["legacy-clue"], "%s": ["kept-legacy"]}
	}`, deleted.ID, kept.ID, deleted.ID, deleted.ID, kept.ID, deleted.ID, kept.ID))
	if _, err := f.q.UpdateThemeConfigJson(ctx, db.UpdateThemeConfigJsonParams{
		ID:         themeID,
		ConfigJson: rawConfig,
		Version:    theme.Version,
	}); err != nil {
		t.Fatalf("UpdateThemeConfigJson: %v", err)
	}

	if err := f.svc.DeleteCharacter(ctx, creatorID, deleted.ID); err != nil {
		t.Fatalf("DeleteCharacter: %v", err)
	}

	updated, err := f.q.GetTheme(ctx, themeID)
	if err != nil {
		t.Fatalf("GetTheme after delete: %v", err)
	}
	var decodedConfig any
	if err := json.Unmarshal(updated.ConfigJson, &decodedConfig); err != nil {
		t.Fatalf("unmarshal updated config_json: %v", err)
	}
	if jsonConfigContainsStringOrKey(decodedConfig, deleted.ID.String()) {
		t.Fatalf("deleted character id still present in config_json: %s", string(updated.ConfigJson))
	}
	if !jsonConfigContainsStringOrKey(decodedConfig, kept.ID.String()) {
		t.Fatalf("kept character id was unexpectedly removed: %s", string(updated.ConfigJson))
	}
	if _, err := f.q.GetContent(ctx, db.GetContentParams{ThemeID: themeID, Key: roleSheetContentKey(deleted.ID)}); !errors.Is(err, pgx.ErrNoRows) {
		t.Fatalf("expected deleted character role sheet content to be removed, got %v", err)
	}
}

func TestService_DeleteLocation_CleansEditorReferences(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test in short mode")
	}
	f := setupFixture(t)
	ctx := context.Background()
	creatorID := f.createUser(t)
	themeID := f.createThemeForUser(t, creatorID)
	mapResp, err := f.svc.CreateMap(ctx, creatorID, themeID, CreateMapRequest{Name: "지도"})
	if err != nil {
		t.Fatalf("CreateMap: %v", err)
	}
	deleted, err := f.svc.CreateLocation(ctx, creatorID, themeID, mapResp.ID, CreateLocationRequest{Name: "삭제 장소"})
	if err != nil {
		t.Fatalf("CreateLocation deleted: %v", err)
	}
	kept, err := f.svc.CreateLocation(ctx, creatorID, themeID, mapResp.ID, CreateLocationRequest{Name: "남길 장소"})
	if err != nil {
		t.Fatalf("CreateLocation kept: %v", err)
	}

	theme, err := f.q.GetTheme(ctx, themeID)
	if err != nil {
		t.Fatalf("GetTheme: %v", err)
	}
	rawConfig := []byte(fmt.Sprintf(`{
		"locations": [
			{"id":"%s","name":"삭제 장소","locationClueConfig":{"clueIds":["clue-1"]}},
			{"id":"%s","name":"남길 장소","locationClueConfig":{"clueIds":["clue-2"]}}
		],
		"locationMeta": {
			"%s": {"entryMessage":"삭제"},
			"child": {"parentLocationId":"%s","entryMessage":"자식"},
			"%s": {"entryMessage":"남김"}
		},
		"clue_placement": {"legacy-clue":"%s","kept-clue":"%s"}
	}`, deleted.ID, kept.ID, deleted.ID, deleted.ID, kept.ID, deleted.ID, kept.ID))
	if _, err := f.q.UpdateThemeConfigJson(ctx, db.UpdateThemeConfigJsonParams{
		ID:         themeID,
		ConfigJson: rawConfig,
		Version:    theme.Version,
	}); err != nil {
		t.Fatalf("UpdateThemeConfigJson: %v", err)
	}

	if err := f.svc.DeleteLocation(ctx, creatorID, deleted.ID); err != nil {
		t.Fatalf("DeleteLocation: %v", err)
	}

	updated, err := f.q.GetTheme(ctx, themeID)
	if err != nil {
		t.Fatalf("GetTheme after delete: %v", err)
	}
	var decodedConfig any
	if err := json.Unmarshal(updated.ConfigJson, &decodedConfig); err != nil {
		t.Fatalf("unmarshal updated config_json: %v", err)
	}
	if jsonConfigContainsStringOrKey(decodedConfig, deleted.ID.String()) {
		t.Fatalf("deleted location id still present in config_json: %s", string(updated.ConfigJson))
	}
	if !jsonConfigContainsStringOrKey(decodedConfig, kept.ID.String()) {
		t.Fatalf("kept location id was unexpectedly removed: %s", string(updated.ConfigJson))
	}
}
