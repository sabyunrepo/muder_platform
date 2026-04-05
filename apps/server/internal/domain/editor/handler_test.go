package editor

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	"github.com/mmp-platform/server/internal/apperror"
	"github.com/mmp-platform/server/internal/middleware"
)

// --- mock service ---

type mockService struct {
	createThemeFn    func(ctx context.Context, creatorID uuid.UUID, req CreateThemeRequest) (*ThemeResponse, error)
	updateThemeFn    func(ctx context.Context, creatorID, themeID uuid.UUID, req UpdateThemeRequest) (*ThemeResponse, error)
	deleteThemeFn    func(ctx context.Context, creatorID, themeID uuid.UUID) error
	listMyThemesFn   func(ctx context.Context, creatorID uuid.UUID) ([]ThemeSummary, error)
	publishThemeFn   func(ctx context.Context, creatorID, themeID uuid.UUID) (*ThemeResponse, error)
	unpublishThemeFn func(ctx context.Context, creatorID, themeID uuid.UUID) (*ThemeResponse, error)
	createCharFn     func(ctx context.Context, creatorID, themeID uuid.UUID, req CreateCharacterRequest) (*CharacterResponse, error)
	updateCharFn     func(ctx context.Context, creatorID, charID uuid.UUID, req UpdateCharacterRequest) (*CharacterResponse, error)
	deleteCharFn     func(ctx context.Context, creatorID, charID uuid.UUID) error
	updateConfigFn   func(ctx context.Context, creatorID, themeID uuid.UUID, config json.RawMessage) (*ThemeResponse, error)
}

func (m *mockService) CreateTheme(ctx context.Context, creatorID uuid.UUID, req CreateThemeRequest) (*ThemeResponse, error) {
	return m.createThemeFn(ctx, creatorID, req)
}
func (m *mockService) UpdateTheme(ctx context.Context, creatorID, themeID uuid.UUID, req UpdateThemeRequest) (*ThemeResponse, error) {
	return m.updateThemeFn(ctx, creatorID, themeID, req)
}
func (m *mockService) DeleteTheme(ctx context.Context, creatorID, themeID uuid.UUID) error {
	return m.deleteThemeFn(ctx, creatorID, themeID)
}
func (m *mockService) ListMyThemes(ctx context.Context, creatorID uuid.UUID) ([]ThemeSummary, error) {
	return m.listMyThemesFn(ctx, creatorID)
}
func (m *mockService) PublishTheme(ctx context.Context, creatorID, themeID uuid.UUID) (*ThemeResponse, error) {
	return m.publishThemeFn(ctx, creatorID, themeID)
}
func (m *mockService) UnpublishTheme(ctx context.Context, creatorID, themeID uuid.UUID) (*ThemeResponse, error) {
	return m.unpublishThemeFn(ctx, creatorID, themeID)
}
func (m *mockService) CreateCharacter(ctx context.Context, creatorID, themeID uuid.UUID, req CreateCharacterRequest) (*CharacterResponse, error) {
	return m.createCharFn(ctx, creatorID, themeID, req)
}
func (m *mockService) UpdateCharacter(ctx context.Context, creatorID, charID uuid.UUID, req UpdateCharacterRequest) (*CharacterResponse, error) {
	return m.updateCharFn(ctx, creatorID, charID, req)
}
func (m *mockService) DeleteCharacter(ctx context.Context, creatorID, charID uuid.UUID) error {
	return m.deleteCharFn(ctx, creatorID, charID)
}
func (m *mockService) UpdateConfigJson(ctx context.Context, creatorID, themeID uuid.UUID, config json.RawMessage) (*ThemeResponse, error) {
	return m.updateConfigFn(ctx, creatorID, themeID, config)
}

// --- test helpers ---

var (
	testCreatorID = uuid.MustParse("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa")
	testThemeID   = uuid.MustParse("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb")
	testCharID    = uuid.MustParse("cccccccc-cccc-cccc-cccc-cccccccccccc")
	testNow       = time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC)
)

func sampleThemeResponse() *ThemeResponse {
	desc := "A test theme"
	return &ThemeResponse{
		ID:          testThemeID,
		Title:       "Test Theme",
		Slug:        "test-theme-ab12",
		Description: &desc,
		MinPlayers:  4,
		MaxPlayers:  8,
		DurationMin: 60,
		Price:       0,
		Status:      "DRAFT",
		Version:     1,
		CreatedAt:   testNow,
	}
}

func sampleCharResponse() *CharacterResponse {
	desc := "A detective"
	return &CharacterResponse{
		ID:          testCharID,
		ThemeID:     testThemeID,
		Name:        "Detective",
		Description: &desc,
		IsCulprit:   false,
		SortOrder:   0,
	}
}

// withAuth injects user ID and role into context, matching middleware keys.
func withAuth(r *http.Request) *http.Request {
	ctx := context.WithValue(r.Context(), middleware.UserIDKey, testCreatorID)
	ctx = context.WithValue(ctx, middleware.UserRoleKey, "CREATOR")
	return r.WithContext(ctx)
}

// chiContext sets chi URL params on a request.
func chiContext(r *http.Request, params map[string]string) *http.Request {
	rctx := chi.NewRouteContext()
	for k, v := range params {
		rctx.URLParams.Add(k, v)
	}
	return r.WithContext(context.WithValue(r.Context(), chi.RouteCtxKey, rctx))
}

// --- tests ---

func TestListMyThemes(t *testing.T) {
	ms := &mockService{
		listMyThemesFn: func(_ context.Context, _ uuid.UUID) ([]ThemeSummary, error) {
			return []ThemeSummary{
				{ID: testThemeID, Title: "T1", Status: "DRAFT", MinPlayers: 4, MaxPlayers: 8, Version: 1, CreatedAt: testNow},
			}, nil
		},
	}
	h := NewHandler(ms)

	r := httptest.NewRequest(http.MethodGet, "/editor/themes", nil)
	r = withAuth(r)
	w := httptest.NewRecorder()

	h.ListMyThemes(w, r)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}
}

func TestCreateTheme_Success(t *testing.T) {
	ms := &mockService{
		createThemeFn: func(_ context.Context, _ uuid.UUID, _ CreateThemeRequest) (*ThemeResponse, error) {
			return sampleThemeResponse(), nil
		},
	}
	h := NewHandler(ms)

	body := `{"title":"Test Theme","min_players":4,"max_players":8,"duration_min":60,"price":0}`
	r := httptest.NewRequest(http.MethodPost, "/editor/themes", bytes.NewBufferString(body))
	r.Header.Set("Content-Type", "application/json")
	r = withAuth(r)
	w := httptest.NewRecorder()

	h.CreateTheme(w, r)

	if w.Code != http.StatusCreated {
		t.Fatalf("expected 201, got %d: %s", w.Code, w.Body.String())
	}
}

func TestCreateTheme_InvalidBody(t *testing.T) {
	ms := &mockService{}
	h := NewHandler(ms)

	// missing required fields
	body := `{"title":"X"}`
	r := httptest.NewRequest(http.MethodPost, "/editor/themes", bytes.NewBufferString(body))
	r.Header.Set("Content-Type", "application/json")
	r = withAuth(r)
	w := httptest.NewRecorder()

	h.CreateTheme(w, r)

	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d: %s", w.Code, w.Body.String())
	}
}

func TestUpdateTheme_Success(t *testing.T) {
	ms := &mockService{
		updateThemeFn: func(_ context.Context, _, _ uuid.UUID, _ UpdateThemeRequest) (*ThemeResponse, error) {
			return sampleThemeResponse(), nil
		},
	}
	h := NewHandler(ms)

	body := `{"title":"Updated Theme","min_players":4,"max_players":8,"duration_min":60,"price":0}`
	r := httptest.NewRequest(http.MethodPut, "/editor/themes/"+testThemeID.String(), bytes.NewBufferString(body))
	r.Header.Set("Content-Type", "application/json")
	r = withAuth(r)
	r = chiContext(r, map[string]string{"id": testThemeID.String()})
	w := httptest.NewRecorder()

	h.UpdateTheme(w, r)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}
}

func TestDeleteTheme_Success(t *testing.T) {
	ms := &mockService{
		deleteThemeFn: func(_ context.Context, _, _ uuid.UUID) error {
			return nil
		},
	}
	h := NewHandler(ms)

	r := httptest.NewRequest(http.MethodDelete, "/editor/themes/"+testThemeID.String(), nil)
	r = withAuth(r)
	r = chiContext(r, map[string]string{"id": testThemeID.String()})
	w := httptest.NewRecorder()

	h.DeleteTheme(w, r)

	if w.Code != http.StatusNoContent {
		t.Fatalf("expected 204, got %d", w.Code)
	}
}

func TestDeleteTheme_Forbidden(t *testing.T) {
	ms := &mockService{
		deleteThemeFn: func(_ context.Context, _, _ uuid.UUID) error {
			return apperror.Forbidden("you do not own this theme")
		},
	}
	h := NewHandler(ms)

	r := httptest.NewRequest(http.MethodDelete, "/editor/themes/"+testThemeID.String(), nil)
	r = withAuth(r)
	r = chiContext(r, map[string]string{"id": testThemeID.String()})
	w := httptest.NewRecorder()

	h.DeleteTheme(w, r)

	if w.Code != http.StatusForbidden {
		t.Fatalf("expected 403, got %d: %s", w.Code, w.Body.String())
	}
}

func TestPublishTheme_Success(t *testing.T) {
	ms := &mockService{
		publishThemeFn: func(_ context.Context, _, _ uuid.UUID) (*ThemeResponse, error) {
			resp := sampleThemeResponse()
			resp.Status = "PUBLISHED"
			return resp, nil
		},
	}
	h := NewHandler(ms)

	r := httptest.NewRequest(http.MethodPost, "/editor/themes/"+testThemeID.String()+"/publish", nil)
	r = withAuth(r)
	r = chiContext(r, map[string]string{"id": testThemeID.String()})
	w := httptest.NewRecorder()

	h.PublishTheme(w, r)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}
}

func TestUnpublishTheme_Success(t *testing.T) {
	ms := &mockService{
		unpublishThemeFn: func(_ context.Context, _, _ uuid.UUID) (*ThemeResponse, error) {
			return sampleThemeResponse(), nil
		},
	}
	h := NewHandler(ms)

	r := httptest.NewRequest(http.MethodPost, "/editor/themes/"+testThemeID.String()+"/unpublish", nil)
	r = withAuth(r)
	r = chiContext(r, map[string]string{"id": testThemeID.String()})
	w := httptest.NewRecorder()

	h.UnpublishTheme(w, r)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}
}

func TestCreateCharacter_Success(t *testing.T) {
	ms := &mockService{
		createCharFn: func(_ context.Context, _, _ uuid.UUID, _ CreateCharacterRequest) (*CharacterResponse, error) {
			return sampleCharResponse(), nil
		},
	}
	h := NewHandler(ms)

	body := `{"name":"Detective","description":"A detective","is_culprit":false,"sort_order":0}`
	r := httptest.NewRequest(http.MethodPost, "/editor/themes/"+testThemeID.String()+"/characters", bytes.NewBufferString(body))
	r.Header.Set("Content-Type", "application/json")
	r = withAuth(r)
	r = chiContext(r, map[string]string{"id": testThemeID.String()})
	w := httptest.NewRecorder()

	h.CreateCharacter(w, r)

	if w.Code != http.StatusCreated {
		t.Fatalf("expected 201, got %d: %s", w.Code, w.Body.String())
	}
}

func TestUpdateCharacter_Success(t *testing.T) {
	ms := &mockService{
		updateCharFn: func(_ context.Context, _, _ uuid.UUID, _ UpdateCharacterRequest) (*CharacterResponse, error) {
			return sampleCharResponse(), nil
		},
	}
	h := NewHandler(ms)

	body := `{"name":"Detective Updated","is_culprit":false,"sort_order":1}`
	r := httptest.NewRequest(http.MethodPut, "/editor/characters/"+testCharID.String(), bytes.NewBufferString(body))
	r.Header.Set("Content-Type", "application/json")
	r = withAuth(r)
	r = chiContext(r, map[string]string{"id": testCharID.String()})
	w := httptest.NewRecorder()

	h.UpdateCharacter(w, r)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}
}

func TestDeleteCharacter_Success(t *testing.T) {
	ms := &mockService{
		deleteCharFn: func(_ context.Context, _, _ uuid.UUID) error {
			return nil
		},
	}
	h := NewHandler(ms)

	r := httptest.NewRequest(http.MethodDelete, "/editor/characters/"+testCharID.String(), nil)
	r = withAuth(r)
	r = chiContext(r, map[string]string{"id": testCharID.String()})
	w := httptest.NewRecorder()

	h.DeleteCharacter(w, r)

	if w.Code != http.StatusNoContent {
		t.Fatalf("expected 204, got %d", w.Code)
	}
}

func TestUpdateConfigJson_Success(t *testing.T) {
	ms := &mockService{
		updateConfigFn: func(_ context.Context, _, _ uuid.UUID, _ json.RawMessage) (*ThemeResponse, error) {
			resp := sampleThemeResponse()
			resp.ConfigJson = json.RawMessage(`{"phases":["intro","discussion"]}`)
			return resp, nil
		},
	}
	h := NewHandler(ms)

	body := `{"phases":["intro","discussion"]}`
	r := httptest.NewRequest(http.MethodPut, "/editor/themes/"+testThemeID.String()+"/config", bytes.NewBufferString(body))
	r.Header.Set("Content-Type", "application/json")
	r = withAuth(r)
	r = chiContext(r, map[string]string{"id": testThemeID.String()})
	w := httptest.NewRecorder()

	h.UpdateConfigJson(w, r)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}
}
