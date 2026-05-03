package editor

import (
	"context"
	"fmt"
	"strings"
	"testing"

	"github.com/google/uuid"

	"github.com/mmp-platform/server/internal/db"
)

func TestService_DeleteClue_CleansEditorReferences(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test in short mode")
	}
	f := setupFixture(t)
	ctx := context.Background()
	creatorID := f.createUser(t)
	themeID := f.createThemeForUser(t, creatorID)
	deletedID := f.createClue(t, themeID, "삭제할 단서")
	keptID := f.createClue(t, themeID, "남길 단서")

	theme, err := f.q.GetTheme(ctx, themeID)
	if err != nil {
		t.Fatalf("GetTheme: %v", err)
	}
	rawConfig := []byte(fmt.Sprintf(`{
		"locations": [{"id":"loc-1","locationClueConfig":{"clueIds":["%s","%s"]}}],
		"modules": {"starting_clue": {"enabled": true, "config": {"startingClues": {"char-1": ["%s","%s"]}}}}
	}`, deletedID, keptID, deletedID, keptID))
	if _, err := f.q.UpdateThemeConfigJson(ctx, db.UpdateThemeConfigJsonParams{
		ID:         themeID,
		ConfigJson: rawConfig,
		Version:    theme.Version,
	}); err != nil {
		t.Fatalf("UpdateThemeConfigJson: %v", err)
	}
	group, err := f.q.InsertClueEdgeGroup(ctx, db.InsertClueEdgeGroupParams{
		ThemeID: themeID, TargetID: keptID, Trigger: edgeTriggerCRAFT, Mode: edgeModeAND,
	})
	if err != nil {
		t.Fatalf("InsertClueEdgeGroup: %v", err)
	}
	if _, err := f.q.BulkInsertClueEdgeMembers(ctx, db.BulkInsertClueEdgeMembersParams{
		GroupIds: []uuid.UUID{group.ID}, SourceIds: []uuid.UUID{deletedID},
	}); err != nil {
		t.Fatalf("BulkInsertClueEdgeMembers: %v", err)
	}

	if err := f.svc.DeleteClue(ctx, creatorID, deletedID); err != nil {
		t.Fatalf("DeleteClue: %v", err)
	}

	updated, err := f.q.GetTheme(ctx, themeID)
	if err != nil {
		t.Fatalf("GetTheme after delete: %v", err)
	}
	if strings.Contains(string(updated.ConfigJson), deletedID.String()) {
		t.Fatalf("deleted clue id still present in config_json: %s", string(updated.ConfigJson))
	}
	if !strings.Contains(string(updated.ConfigJson), keptID.String()) {
		t.Fatalf("kept clue id was unexpectedly removed: %s", string(updated.ConfigJson))
	}
	groups, err := f.q.ListClueEdgeGroupsByTheme(ctx, themeID)
	if err != nil {
		t.Fatalf("ListClueEdgeGroupsByTheme: %v", err)
	}
	if len(groups) != 0 {
		t.Fatalf("expected referencing clue edge group removed, got %d", len(groups))
	}
}
