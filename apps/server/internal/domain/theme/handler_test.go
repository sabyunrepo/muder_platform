package theme

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	"github.com/mmp-platform/server/internal/apperror"
)

// mockService implements Service for testing.
type mockService struct {
	getThemeFn       func(ctx context.Context, themeID uuid.UUID) (*ThemeResponse, error)
	getThemeBySlugFn func(ctx context.Context, slug string) (*ThemeResponse, error)
	listPublishedFn  func(ctx context.Context, limit, offset int32) ([]ThemeSummary, error)
	getCharactersFn  func(ctx context.Context, themeID uuid.UUID) ([]CharacterResponse, error)
}

func (m *mockService) GetTheme(ctx context.Context, themeID uuid.UUID) (*ThemeResponse, error) {
	return m.getThemeFn(ctx, themeID)
}

func (m *mockService) GetThemeBySlug(ctx context.Context, slug string) (*ThemeResponse, error) {
	return m.getThemeBySlugFn(ctx, slug)
}

func (m *mockService) ListPublished(ctx context.Context, limit, offset int32) ([]ThemeSummary, error) {
	return m.listPublishedFn(ctx, limit, offset)
}

func (m *mockService) GetCharacters(ctx context.Context, themeID uuid.UUID) ([]CharacterResponse, error) {
	return m.getCharactersFn(ctx, themeID)
}

func newThemeRouter(h *Handler) *chi.Mux {
	r := chi.NewRouter()
	r.Get("/themes", h.ListPublished)
	r.Get("/themes/{id}", h.GetTheme)
	r.Get("/themes/slug/{slug}", h.GetThemeBySlug)
	r.Get("/themes/{id}/characters", h.GetCharacters)
	return r
}

func TestListPublished_Success(t *testing.T) {
	desc := "A murder mystery"
	mock := &mockService{
		listPublishedFn: func(_ context.Context, limit, offset int32) ([]ThemeSummary, error) {
			if limit != 20 {
				t.Errorf("expected default limit 20, got %d", limit)
			}
			if offset != 0 {
				t.Errorf("expected default offset 0, got %d", offset)
			}
			return []ThemeSummary{
				{
					ID:          uuid.New(),
					Title:       "Test Theme",
					Slug:        "test-theme",
					Description: &desc,
					MinPlayers:  4,
					MaxPlayers:  8,
					DurationMin: 60,
					Price:       1000,
					CreatorID:   uuid.New(),
				},
			}, nil
		},
	}

	h := NewHandler(mock)
	r := newThemeRouter(h)

	req := httptest.NewRequest(http.MethodGet, "/themes", nil)
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d; body: %s", rec.Code, rec.Body.String())
	}

	var resp []ThemeSummary
	if err := json.NewDecoder(rec.Body).Decode(&resp); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}
	if len(resp) != 1 {
		t.Fatalf("expected 1 theme, got %d", len(resp))
	}
	if resp[0].Title != "Test Theme" {
		t.Errorf("expected title 'Test Theme', got %q", resp[0].Title)
	}
}

func TestGetTheme_Success(t *testing.T) {
	tid := uuid.New()
	now := time.Now().UTC().Truncate(time.Second)
	mock := &mockService{
		getThemeFn: func(_ context.Context, id uuid.UUID) (*ThemeResponse, error) {
			if id != tid {
				t.Fatalf("expected theme ID %v, got %v", tid, id)
			}
			return &ThemeResponse{
				ThemeSummary: ThemeSummary{
					ID:         tid,
					Title:      "Mystery Manor",
					Slug:       "mystery-manor",
					MinPlayers: 4,
					MaxPlayers: 8,
					DurationMin: 90,
					Price:      2000,
					CreatorID:  uuid.New(),
				},
				Status:     "PUBLISHED",
				ConfigJson: json.RawMessage(`{"key":"value"}`),
				Version:    1,
				PublishedAt: &now,
				CreatedAt:  now,
			}, nil
		},
	}

	h := NewHandler(mock)
	r := newThemeRouter(h)

	req := httptest.NewRequest(http.MethodGet, "/themes/"+tid.String(), nil)
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d; body: %s", rec.Code, rec.Body.String())
	}

	var resp ThemeResponse
	if err := json.NewDecoder(rec.Body).Decode(&resp); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}
	if resp.Title != "Mystery Manor" {
		t.Errorf("expected title 'Mystery Manor', got %q", resp.Title)
	}
	if resp.Status != "PUBLISHED" {
		t.Errorf("expected status 'PUBLISHED', got %q", resp.Status)
	}
}

func TestGetTheme_NotFound(t *testing.T) {
	mock := &mockService{
		getThemeFn: func(_ context.Context, _ uuid.UUID) (*ThemeResponse, error) {
			return nil, apperror.NotFound("theme not found")
		},
	}

	h := NewHandler(mock)
	r := newThemeRouter(h)

	req := httptest.NewRequest(http.MethodGet, "/themes/"+uuid.New().String(), nil)
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, req)

	if rec.Code != http.StatusNotFound {
		t.Fatalf("expected status 404, got %d; body: %s", rec.Code, rec.Body.String())
	}
}

func TestGetTheme_InvalidUUID(t *testing.T) {
	mock := &mockService{}

	h := NewHandler(mock)
	r := newThemeRouter(h)

	req := httptest.NewRequest(http.MethodGet, "/themes/not-a-uuid", nil)
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Fatalf("expected status 400, got %d; body: %s", rec.Code, rec.Body.String())
	}
}

func TestGetThemeBySlug_Success(t *testing.T) {
	mock := &mockService{
		getThemeBySlugFn: func(_ context.Context, slug string) (*ThemeResponse, error) {
			if slug != "dark-mansion" {
				t.Fatalf("expected slug 'dark-mansion', got %q", slug)
			}
			return &ThemeResponse{
				ThemeSummary: ThemeSummary{
					ID:         uuid.New(),
					Title:      "Dark Mansion",
					Slug:       "dark-mansion",
					MinPlayers: 3,
					MaxPlayers: 6,
					DurationMin: 45,
					Price:      500,
					CreatorID:  uuid.New(),
				},
				Status:  "PUBLISHED",
				Version: 2,
				CreatedAt: time.Now().UTC(),
			}, nil
		},
	}

	h := NewHandler(mock)
	r := newThemeRouter(h)

	req := httptest.NewRequest(http.MethodGet, "/themes/slug/dark-mansion", nil)
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d; body: %s", rec.Code, rec.Body.String())
	}

	var resp ThemeResponse
	if err := json.NewDecoder(rec.Body).Decode(&resp); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}
	if resp.Slug != "dark-mansion" {
		t.Errorf("expected slug 'dark-mansion', got %q", resp.Slug)
	}
}

func TestGetCharacters_Success(t *testing.T) {
	tid := uuid.New()
	desc := "The butler"
	imgURL := "https://example.com/butler.png"
	mock := &mockService{
		getCharactersFn: func(_ context.Context, id uuid.UUID) ([]CharacterResponse, error) {
			if id != tid {
				t.Fatalf("expected theme ID %v, got %v", tid, id)
			}
			return []CharacterResponse{
				{
					ID:          uuid.New(),
					Name:        "Butler",
					Description: &desc,
					ImageURL:    &imgURL,
					SortOrder:   1,
				},
				{
					ID:        uuid.New(),
					Name:      "Maid",
					SortOrder: 2,
				},
			}, nil
		},
	}

	h := NewHandler(mock)
	r := newThemeRouter(h)

	req := httptest.NewRequest(http.MethodGet, "/themes/"+tid.String()+"/characters", nil)
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d; body: %s", rec.Code, rec.Body.String())
	}

	// Capture raw bytes before consuming the body
	raw := rec.Body.Bytes()

	var resp []CharacterResponse
	if err := json.Unmarshal(raw, &resp); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}
	if len(resp) != 2 {
		t.Fatalf("expected 2 characters, got %d", len(resp))
	}
	if resp[0].Name != "Butler" {
		t.Errorf("expected first character 'Butler', got %q", resp[0].Name)
	}

	// Verify IsCulprit is not present in JSON output
	var rawSlice []map[string]any
	if err := json.Unmarshal(raw, &rawSlice); err != nil {
		t.Fatalf("failed to unmarshal raw response: %v", err)
	}
	for i, entry := range rawSlice {
		if _, ok := entry["is_culprit"]; ok {
			t.Errorf("character %d: is_culprit should not be present in public API response", i)
		}
	}
}
