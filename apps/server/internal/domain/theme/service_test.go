package theme

import (
	"context"
	"encoding/json"
	"testing"

	"github.com/google/uuid"
	"github.com/rs/zerolog"
)

func TestGetCharacters_UsesBackendDisplayResolverWithoutLeakingAliasRules(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test in short mode")
	}
	f := setupThemeFixture(t)
	ctx := context.Background()
	creatorID := f.createUser(t)
	themeID := f.createThemeForUser(t, creatorID)

	charID := f.createCharacter(t, themeID, "홍길동", json.RawMessage(`[{
		"id":"alias-1",
		"display_name":"숨겨진 별칭",
		"priority":1,
		"condition":{"id":"group-1","operator":"AND","rules":[{"id":"rule-1","variable":"custom_flag","target_flag_key":"revealed","comparator":"=","value":"true"}]}
	}]`))

	svc := NewService(f.q, zerolog.Nop())
	got, err := svc.GetCharacters(ctx, themeID)
	if err != nil {
		t.Fatalf("GetCharacters: %v", err)
	}
	if len(got) != 1 {
		t.Fatalf("characters len = %d", len(got))
	}
	if got[0].ID != charID || got[0].Name != "홍길동" {
		t.Fatalf("public character display mismatch: %+v", got[0])
	}

	raw, err := json.Marshal(got)
	if err != nil {
		t.Fatalf("marshal public characters: %v", err)
	}
	if jsonContainsKey(t, raw, "alias_rules") || jsonContainsKey(t, raw, "mystery_role") || jsonContainsKey(t, raw, "is_culprit") {
		t.Fatalf("public characters leaked private fields: %s", string(raw))
	}
}

func jsonContainsKey(t *testing.T, raw []byte, key string) bool {
	t.Helper()
	var rows []map[string]any
	if err := json.Unmarshal(raw, &rows); err != nil {
		t.Fatalf("unmarshal rows: %v", err)
	}
	for _, row := range rows {
		if _, ok := row[key]; ok {
			return true
		}
	}
	return false
}

func (f *themeFixture) createCharacter(t *testing.T, themeID uuid.UUID, name string, aliasRules json.RawMessage) uuid.UUID {
	t.Helper()
	row, err := f.pool.Exec(context.Background(), `
		INSERT INTO theme_characters (theme_id, name, alias_rules)
		VALUES ($1, $2, $3)
	`, themeID, name, aliasRules)
	if err != nil {
		t.Fatalf("create character: %v", err)
	}
	if row.RowsAffected() != 1 {
		t.Fatalf("create character rows affected = %d", row.RowsAffected())
	}
	var id uuid.UUID
	if err := f.pool.QueryRow(context.Background(), `
		SELECT id FROM theme_characters WHERE theme_id = $1 AND name = $2
	`, themeID, name).Scan(&id); err != nil {
		t.Fatalf("read character id: %v", err)
	}
	return id
}
