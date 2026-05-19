package theme

import (
	"context"
	"encoding/json"
	"testing"

	"github.com/google/uuid"
	"github.com/rs/zerolog"

	"github.com/mmp-platform/server/internal/apperror"
)

func TestGetTheme_HidesUnpublishedThemes(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test in short mode")
	}
	f := setupThemeFixture(t)
	ctx := context.Background()
	creatorID := f.createUser(t)
	themeID, _ := f.createThemeForUserWithStatus(t, creatorID, "DRAFT", json.RawMessage(`{"private":"draft"}`))

	svc := NewService(f.q, zerolog.Nop())
	_, err := svc.GetTheme(ctx, themeID)
	if err == nil {
		t.Fatal("expected not found error")
	}
	appErr, ok := err.(*apperror.AppError)
	if !ok {
		t.Fatalf("expected AppError, got %T", err)
	}
	if appErr.Code != apperror.ErrNotFound {
		t.Fatalf("expected NOT_FOUND, got %s", appErr.Code)
	}
}

func TestGetThemeBySlug_HidesUnpublishedThemes(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test in short mode")
	}
	f := setupThemeFixture(t)
	ctx := context.Background()
	creatorID := f.createUser(t)
	_, slug := f.createThemeForUserWithStatus(t, creatorID, "DRAFT", json.RawMessage(`{"private":"draft"}`))

	svc := NewService(f.q, zerolog.Nop())
	_, err := svc.GetThemeBySlug(ctx, slug)
	if err == nil {
		t.Fatal("expected not found error")
	}
	appErr, ok := err.(*apperror.AppError)
	if !ok {
		t.Fatalf("expected AppError, got %T", err)
	}
	if appErr.Code != apperror.ErrNotFound {
		t.Fatalf("expected NOT_FOUND, got %s", appErr.Code)
	}
}

func TestGetTheme_ReturnsPublishedThemeWithoutConfigJson(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test in short mode")
	}
	f := setupThemeFixture(t)
	ctx := context.Background()
	creatorID := f.createUser(t)
	themeID, _ := f.createThemeForUserWithStatus(t, creatorID, "PUBLISHED", json.RawMessage(`{"private":"published-runtime-config"}`))

	svc := NewService(f.q, zerolog.Nop())
	got, err := svc.GetTheme(ctx, themeID)
	if err != nil {
		t.Fatalf("GetTheme: %v", err)
	}
	if got.ID != themeID {
		t.Fatalf("theme id = %s, want %s", got.ID, themeID)
	}
	if got.Status != "PUBLISHED" {
		t.Fatalf("status = %s, want PUBLISHED", got.Status)
	}

	raw, err := json.Marshal(got)
	if err != nil {
		t.Fatalf("marshal theme: %v", err)
	}
	if jsonObjectContainsKey(t, raw, "config_json") {
		t.Fatalf("public theme response leaked config_json: %s", string(raw))
	}
}

func TestGetThemeBySlug_ReturnsPublishedThemeWithoutConfigJson(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test in short mode")
	}
	f := setupThemeFixture(t)
	ctx := context.Background()
	creatorID := f.createUser(t)
	_, slug := f.createThemeForUserWithStatus(t, creatorID, "PUBLISHED", json.RawMessage(`{"private":"published-runtime-config"}`))

	svc := NewService(f.q, zerolog.Nop())
	got, err := svc.GetThemeBySlug(ctx, slug)
	if err != nil {
		t.Fatalf("GetThemeBySlug: %v", err)
	}
	if got.Slug != slug {
		t.Fatalf("slug = %s, want %s", got.Slug, slug)
	}
	if got.Status != "PUBLISHED" {
		t.Fatalf("status = %s, want PUBLISHED", got.Status)
	}

	raw, err := json.Marshal(got)
	if err != nil {
		t.Fatalf("marshal theme: %v", err)
	}
	if jsonObjectContainsKey(t, raw, "config_json") {
		t.Fatalf("public theme response leaked config_json: %s", string(raw))
	}
}

func TestGetCharacters_UsesBackendDisplayResolverWithoutLeakingAliasRules(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test in short mode")
	}
	f := setupThemeFixture(t)
	ctx := context.Background()
	creatorID := f.createUser(t)
	themeID, _ := f.createThemeForUserWithStatus(t, creatorID, "PUBLISHED", json.RawMessage(`{}`))

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

func TestGetCharacters_HidesUnpublishedThemes(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test in short mode")
	}
	f := setupThemeFixture(t)
	ctx := context.Background()
	creatorID := f.createUser(t)
	themeID, _ := f.createThemeForUserWithStatus(t, creatorID, "DRAFT", json.RawMessage(`{}`))
	f.createCharacter(t, themeID, "비공개 캐릭터", json.RawMessage(`[]`))

	svc := NewService(f.q, zerolog.Nop())
	_, err := svc.GetCharacters(ctx, themeID)
	assertNotFound(t, err)
}

func jsonObjectContainsKey(t *testing.T, raw []byte, key string) bool {
	t.Helper()
	var row map[string]any
	if err := json.Unmarshal(raw, &row); err != nil {
		t.Fatalf("unmarshal row: %v", err)
	}
	_, ok := row[key]
	return ok
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

func assertNotFound(t *testing.T, err error) {
	t.Helper()
	if err == nil {
		t.Fatal("expected not found error")
	}
	appErr, ok := err.(*apperror.AppError)
	if !ok {
		t.Fatalf("expected AppError, got %T", err)
	}
	if appErr.Code != apperror.ErrNotFound {
		t.Fatalf("expected NOT_FOUND, got %s", appErr.Code)
	}
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
