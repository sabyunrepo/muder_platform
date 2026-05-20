package main

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/rs/zerolog"
	"go.uber.org/mock/gomock"

	"github.com/mmp-platform/server/internal/auditlog"
	"github.com/mmp-platform/server/internal/domain/editor"
	editormocks "github.com/mmp-platform/server/internal/domain/editor/mocks"
	"github.com/mmp-platform/server/internal/middleware"
)

func TestRegisterEditorThemeRoutes_PublishTheme(t *testing.T) {
	ctrl := gomock.NewController(t)
	mock := editormocks.NewMockService(ctrl)

	creatorID := uuid.MustParse("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa")
	themeID := uuid.MustParse("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb")
	mock.EXPECT().
		PublishTheme(gomock.Any(), creatorID, themeID).
		Return(&editor.ThemeResponse{
			ID:          themeID,
			Title:       "Publishable Theme",
			Slug:        "publishable-theme-ab12",
			MinPlayers:  4,
			MaxPlayers:  8,
			DurationMin: 60,
			Status:      "PUBLISHED",
			Version:     2,
			CreatedAt:   time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC),
		}, nil).
		Times(1)

	handler := editor.NewHandler(mock, auditlog.NoOpLogger{}, zerolog.Nop())
	router := chi.NewRouter()
	router.Route("/editor", func(r chi.Router) {
		registerEditorThemeRoutes(r, authedDeps{editor: handler})
	})

	req := httptest.NewRequest(http.MethodPost, "/editor/themes/"+themeID.String()+"/publish", nil)
	ctx := context.WithValue(req.Context(), middleware.UserIDKey, creatorID)
	ctx = context.WithValue(ctx, middleware.UserRoleKey, "CREATOR")
	req = req.WithContext(ctx)
	rec := httptest.NewRecorder()

	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected publish route to return 200, got %d: %s", rec.Code, rec.Body.String())
	}
}
