package theme_test

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"go.uber.org/mock/gomock"

	"github.com/mmp-platform/server/internal/apperror"
	"github.com/mmp-platform/server/internal/domain/theme"
	"github.com/mmp-platform/server/internal/domain/theme/mocks"
)

func newThemeRouter(h *theme.Handler) *chi.Mux {
	r := chi.NewRouter()
	r.Get("/themes", h.ListPublished)
	r.Get("/themes/{id}", h.GetTheme)
	r.Get("/themes/slug/{slug}", h.GetThemeBySlug)
	r.Get("/themes/{id}/characters", h.GetCharacters)
	return r
}

func TestListPublished_Success(t *testing.T) {
	ctrl := gomock.NewController(t)
	mock := mocks.NewMockService(ctrl)

	desc := "A murder mystery"
	mock.EXPECT().
		ListPublished(gomock.Any(), gomock.Eq(int32(20)), gomock.Eq(int32(0))).
		Return([]theme.ThemeSummary{
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
		}, nil).Times(1)

	h := theme.NewHandler(mock)
	r := newThemeRouter(h)

	req := httptest.NewRequest(http.MethodGet, "/themes", nil)
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d; body: %s", rec.Code, rec.Body.String())
	}

	var resp []theme.ThemeSummary
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
	ctrl := gomock.NewController(t)
	mock := mocks.NewMockService(ctrl)

	tid := uuid.New()
	now := time.Now().UTC().Truncate(time.Second)
	mock.EXPECT().
		GetTheme(gomock.Any(), gomock.Eq(tid)).
		Return(&theme.ThemeResponse{
			ThemeSummary: theme.ThemeSummary{
				ID:          tid,
				Title:       "Mystery Manor",
				Slug:        "mystery-manor",
				MinPlayers:  4,
				MaxPlayers:  8,
				DurationMin: 90,
				Price:       2000,
				CreatorID:   uuid.New(),
			},
			Status:      "PUBLISHED",
			ConfigJson:  json.RawMessage(`{"key":"value"}`),
			Version:     1,
			PublishedAt: &now,
			CreatedAt:   now,
		}, nil).Times(1)

	h := theme.NewHandler(mock)
	r := newThemeRouter(h)

	req := httptest.NewRequest(http.MethodGet, "/themes/"+tid.String(), nil)
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d; body: %s", rec.Code, rec.Body.String())
	}

	var resp theme.ThemeResponse
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
	ctrl := gomock.NewController(t)
	mock := mocks.NewMockService(ctrl)

	mock.EXPECT().
		GetTheme(gomock.Any(), gomock.Any()).
		Return(nil, apperror.NotFound("theme not found")).Times(1)

	h := theme.NewHandler(mock)
	r := newThemeRouter(h)

	req := httptest.NewRequest(http.MethodGet, "/themes/"+uuid.New().String(), nil)
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, req)

	if rec.Code != http.StatusNotFound {
		t.Fatalf("expected status 404, got %d; body: %s", rec.Code, rec.Body.String())
	}
}

func TestGetTheme_InvalidUUID(t *testing.T) {
	ctrl := gomock.NewController(t)
	mock := mocks.NewMockService(ctrl)

	h := theme.NewHandler(mock)
	r := newThemeRouter(h)

	req := httptest.NewRequest(http.MethodGet, "/themes/not-a-uuid", nil)
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Fatalf("expected status 400, got %d; body: %s", rec.Code, rec.Body.String())
	}
}

func TestGetThemeBySlug_Success(t *testing.T) {
	ctrl := gomock.NewController(t)
	mock := mocks.NewMockService(ctrl)

	mock.EXPECT().
		GetThemeBySlug(gomock.Any(), gomock.Eq("dark-mansion")).
		Return(&theme.ThemeResponse{
			ThemeSummary: theme.ThemeSummary{
				ID:          uuid.New(),
				Title:       "Dark Mansion",
				Slug:        "dark-mansion",
				MinPlayers:  3,
				MaxPlayers:  6,
				DurationMin: 45,
				Price:       500,
				CreatorID:   uuid.New(),
			},
			Status:    "PUBLISHED",
			Version:   2,
			CreatedAt: time.Now().UTC(),
		}, nil).Times(1)

	h := theme.NewHandler(mock)
	r := newThemeRouter(h)

	req := httptest.NewRequest(http.MethodGet, "/themes/slug/dark-mansion", nil)
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d; body: %s", rec.Code, rec.Body.String())
	}

	var resp theme.ThemeResponse
	if err := json.NewDecoder(rec.Body).Decode(&resp); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}
	if resp.Slug != "dark-mansion" {
		t.Errorf("expected slug 'dark-mansion', got %q", resp.Slug)
	}
}

func TestGetCharacters_Success(t *testing.T) {
	ctrl := gomock.NewController(t)
	mock := mocks.NewMockService(ctrl)

	tid := uuid.New()
	desc := "The butler"
	imgURL := "https://example.com/butler.png"
	mock.EXPECT().
		GetCharacters(gomock.Any(), gomock.Eq(tid)).
		Return([]theme.CharacterResponse{
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
		}, nil).Times(1)

	h := theme.NewHandler(mock)
	r := newThemeRouter(h)

	req := httptest.NewRequest(http.MethodGet, "/themes/"+tid.String()+"/characters", nil)
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d; body: %s", rec.Code, rec.Body.String())
	}

	raw := rec.Body.Bytes()

	var resp []theme.CharacterResponse
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
		if _, ok := entry["mystery_role"]; ok {
			t.Errorf("character %d: mystery_role should not be present in public API response", i)
		}
		if _, ok := entry["alias_rules"]; ok {
			t.Errorf("character %d: alias_rules should not be present in public API response", i)
		}
	}
}
