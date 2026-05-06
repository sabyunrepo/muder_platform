package editor_test

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
	"github.com/rs/zerolog"
	"go.uber.org/mock/gomock"

	"github.com/mmp-platform/server/internal/apperror"
	"github.com/mmp-platform/server/internal/auditlog"
	"github.com/mmp-platform/server/internal/domain/editor"
	"github.com/mmp-platform/server/internal/domain/editor/mocks"
	"github.com/mmp-platform/server/internal/middleware"
)

var (
	extCreatorID = uuid.MustParse("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa")
	extThemeID   = uuid.MustParse("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb")
	extCharID    = uuid.MustParse("cccccccc-cccc-cccc-cccc-cccccccccccc")
	extNow       = time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC)
)

func withExtAuth(r *http.Request) *http.Request {
	ctx := context.WithValue(r.Context(), middleware.UserIDKey, extCreatorID)
	ctx = context.WithValue(ctx, middleware.UserRoleKey, "CREATOR")
	return r.WithContext(ctx)
}

func extChiContext(r *http.Request, params map[string]string) *http.Request {
	rctx := chi.NewRouteContext()
	for k, v := range params {
		rctx.URLParams.Add(k, v)
	}
	return r.WithContext(context.WithValue(r.Context(), chi.RouteCtxKey, rctx))
}

func extSampleThemeResponse() *editor.ThemeResponse {
	desc := "A test theme"
	return &editor.ThemeResponse{
		ID:          extThemeID,
		Title:       "Test Theme",
		Slug:        "test-theme-ab12",
		Description: &desc,
		MinPlayers:  4,
		MaxPlayers:  8,
		DurationMin: 60,
		Price:       0,
		Status:      "DRAFT",
		Version:     1,
		CreatedAt:   extNow,
	}
}

func extSampleCharResponse() *editor.CharacterResponse {
	desc := "A detective"
	return &editor.CharacterResponse{
		ID:          extCharID,
		ThemeID:     extThemeID,
		Name:        "Detective",
		Description: &desc,
		IsCulprit:   false,
		SortOrder:   0,
	}
}

func TestListMyThemes(t *testing.T) {
	ctrl := gomock.NewController(t)
	mock := mocks.NewMockService(ctrl)

	mock.EXPECT().
		ListMyThemes(gomock.Any(), gomock.Eq(extCreatorID)).
		Return([]editor.ThemeSummary{
			{ID: extThemeID, Title: "T1", Status: "DRAFT", MinPlayers: 4, MaxPlayers: 8, Version: 1, CreatedAt: extNow},
		}, nil).Times(1)

	h := editor.NewHandler(mock, auditlog.NoOpLogger{}, zerolog.Nop())

	r := httptest.NewRequest(http.MethodGet, "/editor/themes", nil)
	r = withExtAuth(r)
	w := httptest.NewRecorder()

	h.ListMyThemes(w, r)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}
}

func TestCreateTheme_Success(t *testing.T) {
	ctrl := gomock.NewController(t)
	mock := mocks.NewMockService(ctrl)

	mock.EXPECT().
		CreateTheme(gomock.Any(), gomock.Any(), gomock.Any()).
		Return(extSampleThemeResponse(), nil).Times(1)

	h := editor.NewHandler(mock, auditlog.NoOpLogger{}, zerolog.Nop())

	body := `{"title":"Test Theme","min_players":4,"max_players":8,"duration_min":60,"price":0}`
	r := httptest.NewRequest(http.MethodPost, "/editor/themes", bytes.NewBufferString(body))
	r.Header.Set("Content-Type", "application/json")
	r = withExtAuth(r)
	w := httptest.NewRecorder()

	h.CreateTheme(w, r)

	if w.Code != http.StatusCreated {
		t.Fatalf("expected 201, got %d: %s", w.Code, w.Body.String())
	}
}

func TestCreateTheme_InvalidBody(t *testing.T) {
	ctrl := gomock.NewController(t)
	mock := mocks.NewMockService(ctrl)

	h := editor.NewHandler(mock, auditlog.NoOpLogger{}, zerolog.Nop())

	body := `{"title":"X"}`
	r := httptest.NewRequest(http.MethodPost, "/editor/themes", bytes.NewBufferString(body))
	r.Header.Set("Content-Type", "application/json")
	r = withExtAuth(r)
	w := httptest.NewRecorder()

	h.CreateTheme(w, r)

	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d: %s", w.Code, w.Body.String())
	}
}

func TestGetTheme_ByUUID(t *testing.T) {
	ctrl := gomock.NewController(t)
	mock := mocks.NewMockService(ctrl)

	mock.EXPECT().
		GetTheme(gomock.Any(), gomock.Eq(extCreatorID), gomock.Eq(extThemeID)).
		Return(extSampleThemeResponse(), nil).Times(1)

	h := editor.NewHandler(mock, auditlog.NoOpLogger{}, zerolog.Nop())

	r := httptest.NewRequest(http.MethodGet, "/editor/themes/"+extThemeID.String(), nil)
	r = withExtAuth(r)
	r = extChiContext(r, map[string]string{"id": extThemeID.String()})
	w := httptest.NewRecorder()

	h.GetTheme(w, r)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}
}

func TestGetTheme_BySlug(t *testing.T) {
	ctrl := gomock.NewController(t)
	mock := mocks.NewMockService(ctrl)

	mock.EXPECT().
		GetThemeBySlug(gomock.Any(), gomock.Eq(extCreatorID), gomock.Eq("e2e-test-theme")).
		Return(extSampleThemeResponse(), nil).Times(1)

	h := editor.NewHandler(mock, auditlog.NoOpLogger{}, zerolog.Nop())

	r := httptest.NewRequest(http.MethodGet, "/editor/themes/e2e-test-theme", nil)
	r = withExtAuth(r)
	r = extChiContext(r, map[string]string{"id": "e2e-test-theme"})
	w := httptest.NewRecorder()

	h.GetTheme(w, r)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}
}

func TestGetTheme_InvalidLocator(t *testing.T) {
	ctrl := gomock.NewController(t)
	mock := mocks.NewMockService(ctrl)
	h := editor.NewHandler(mock, auditlog.NoOpLogger{}, zerolog.Nop())

	r := httptest.NewRequest(http.MethodGet, "/editor/themes/not_a_slug", nil)
	r = withExtAuth(r)
	r = extChiContext(r, map[string]string{"id": "not_a_slug"})
	w := httptest.NewRecorder()

	h.GetTheme(w, r)

	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d: %s", w.Code, w.Body.String())
	}
}

func TestUpdateTheme_Success(t *testing.T) {
	ctrl := gomock.NewController(t)
	mock := mocks.NewMockService(ctrl)

	mock.EXPECT().
		UpdateTheme(gomock.Any(), gomock.Any(), gomock.Any(), gomock.Any()).
		Return(extSampleThemeResponse(), nil).Times(1)

	h := editor.NewHandler(mock, auditlog.NoOpLogger{}, zerolog.Nop())

	body := `{"title":"Updated Theme","min_players":4,"max_players":8,"duration_min":60,"price":0}`
	r := httptest.NewRequest(http.MethodPut, "/editor/themes/"+extThemeID.String(), bytes.NewBufferString(body))
	r.Header.Set("Content-Type", "application/json")
	r = withExtAuth(r)
	r = extChiContext(r, map[string]string{"id": extThemeID.String()})
	w := httptest.NewRecorder()

	h.UpdateTheme(w, r)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}
}

func TestDeleteTheme_Success(t *testing.T) {
	ctrl := gomock.NewController(t)
	mock := mocks.NewMockService(ctrl)

	mock.EXPECT().
		DeleteTheme(gomock.Any(), gomock.Any(), gomock.Any()).
		Return(nil).Times(1)

	h := editor.NewHandler(mock, auditlog.NoOpLogger{}, zerolog.Nop())

	r := httptest.NewRequest(http.MethodDelete, "/editor/themes/"+extThemeID.String(), nil)
	r = withExtAuth(r)
	r = extChiContext(r, map[string]string{"id": extThemeID.String()})
	w := httptest.NewRecorder()

	h.DeleteTheme(w, r)

	if w.Code != http.StatusNoContent {
		t.Fatalf("expected 204, got %d", w.Code)
	}
}

func TestDeleteTheme_Forbidden(t *testing.T) {
	ctrl := gomock.NewController(t)
	mock := mocks.NewMockService(ctrl)

	mock.EXPECT().
		DeleteTheme(gomock.Any(), gomock.Any(), gomock.Any()).
		Return(apperror.Forbidden("you do not own this theme")).Times(1)

	h := editor.NewHandler(mock, auditlog.NoOpLogger{}, zerolog.Nop())

	r := httptest.NewRequest(http.MethodDelete, "/editor/themes/"+extThemeID.String(), nil)
	r = withExtAuth(r)
	r = extChiContext(r, map[string]string{"id": extThemeID.String()})
	w := httptest.NewRecorder()

	h.DeleteTheme(w, r)

	if w.Code != http.StatusForbidden {
		t.Fatalf("expected 403, got %d: %s", w.Code, w.Body.String())
	}
}

func TestPublishTheme_Success(t *testing.T) {
	ctrl := gomock.NewController(t)
	mock := mocks.NewMockService(ctrl)

	resp := extSampleThemeResponse()
	resp.Status = "PUBLISHED"
	mock.EXPECT().
		PublishTheme(gomock.Any(), gomock.Any(), gomock.Any()).
		Return(resp, nil).Times(1)

	h := editor.NewHandler(mock, auditlog.NoOpLogger{}, zerolog.Nop())

	r := httptest.NewRequest(http.MethodPost, "/editor/themes/"+extThemeID.String()+"/publish", nil)
	r = withExtAuth(r)
	r = extChiContext(r, map[string]string{"id": extThemeID.String()})
	w := httptest.NewRecorder()

	h.PublishTheme(w, r)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}
}

func TestUnpublishTheme_Success(t *testing.T) {
	ctrl := gomock.NewController(t)
	mock := mocks.NewMockService(ctrl)

	mock.EXPECT().
		UnpublishTheme(gomock.Any(), gomock.Any(), gomock.Any()).
		Return(extSampleThemeResponse(), nil).Times(1)

	h := editor.NewHandler(mock, auditlog.NoOpLogger{}, zerolog.Nop())

	r := httptest.NewRequest(http.MethodPost, "/editor/themes/"+extThemeID.String()+"/unpublish", nil)
	r = withExtAuth(r)
	r = extChiContext(r, map[string]string{"id": extThemeID.String()})
	w := httptest.NewRecorder()

	h.UnpublishTheme(w, r)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}
}

func TestCreateCharacter_Success(t *testing.T) {
	ctrl := gomock.NewController(t)
	mock := mocks.NewMockService(ctrl)

	mock.EXPECT().
		CreateCharacter(gomock.Any(), gomock.Any(), gomock.Any(), gomock.Any()).
		Return(extSampleCharResponse(), nil).Times(1)

	h := editor.NewHandler(mock, auditlog.NoOpLogger{}, zerolog.Nop())

	body := `{"name":"Detective","description":"A detective","is_culprit":false,"sort_order":0}`
	r := httptest.NewRequest(http.MethodPost, "/editor/themes/"+extThemeID.String()+"/characters", bytes.NewBufferString(body))
	r.Header.Set("Content-Type", "application/json")
	r = withExtAuth(r)
	r = extChiContext(r, map[string]string{"id": extThemeID.String()})
	w := httptest.NewRecorder()

	h.CreateCharacter(w, r)

	if w.Code != http.StatusCreated {
		t.Fatalf("expected 201, got %d: %s", w.Code, w.Body.String())
	}
}

func TestUpdateCharacter_Success(t *testing.T) {
	ctrl := gomock.NewController(t)
	mock := mocks.NewMockService(ctrl)

	mock.EXPECT().
		UpdateCharacter(gomock.Any(), gomock.Any(), gomock.Any(), gomock.Any()).
		Return(extSampleCharResponse(), nil).Times(1)

	h := editor.NewHandler(mock, auditlog.NoOpLogger{}, zerolog.Nop())

	body := `{"name":"Detective Updated","is_culprit":false,"sort_order":1}`
	r := httptest.NewRequest(http.MethodPut, "/editor/characters/"+extCharID.String(), bytes.NewBufferString(body))
	r.Header.Set("Content-Type", "application/json")
	r = withExtAuth(r)
	r = extChiContext(r, map[string]string{"id": extCharID.String()})
	w := httptest.NewRecorder()

	h.UpdateCharacter(w, r)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}
}

func TestUpdateCharacter_AllowsEmptyEndcardImageURL(t *testing.T) {
	ctrl := gomock.NewController(t)
	mock := mocks.NewMockService(ctrl)

	mock.EXPECT().
		UpdateCharacter(gomock.Any(), gomock.Eq(extCreatorID), gomock.Eq(extCharID), gomock.Any()).
		DoAndReturn(func(_ context.Context, _ uuid.UUID, _ uuid.UUID, req editor.UpdateCharacterRequest) (*editor.CharacterResponse, error) {
			if req.EndcardImageURL == nil || *req.EndcardImageURL != "" {
				t.Fatalf("expected empty endcard image URL to reach service, got %+v", req.EndcardImageURL)
			}
			return extSampleCharResponse(), nil
		}).Times(1)

	h := editor.NewHandler(mock, auditlog.NoOpLogger{}, zerolog.Nop())

	body := `{"name":"Detective Updated","is_culprit":false,"sort_order":1,"endcard_image_url":""}`
	r := httptest.NewRequest(http.MethodPut, "/editor/characters/"+extCharID.String(), bytes.NewBufferString(body))
	r.Header.Set("Content-Type", "application/json")
	r = withExtAuth(r)
	r = extChiContext(r, map[string]string{"id": extCharID.String()})
	w := httptest.NewRecorder()

	h.UpdateCharacter(w, r)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}
}

func TestUpdateCharacter_AllowsEmptyImageURL(t *testing.T) {
	ctrl := gomock.NewController(t)
	mock := mocks.NewMockService(ctrl)

	mock.EXPECT().
		UpdateCharacter(gomock.Any(), gomock.Eq(extCreatorID), gomock.Eq(extCharID), gomock.Any()).
		DoAndReturn(func(_ context.Context, _ uuid.UUID, _ uuid.UUID, req editor.UpdateCharacterRequest) (*editor.CharacterResponse, error) {
			if req.ImageURL == nil || *req.ImageURL != "" {
				t.Fatalf("expected empty image URL to reach service, got %+v", req.ImageURL)
			}
			return extSampleCharResponse(), nil
		}).Times(1)

	h := editor.NewHandler(mock, auditlog.NoOpLogger{}, zerolog.Nop())

	body := `{"name":"Detective Updated","is_culprit":false,"sort_order":1,"image_url":""}`
	r := httptest.NewRequest(http.MethodPut, "/editor/characters/"+extCharID.String(), bytes.NewBufferString(body))
	r.Header.Set("Content-Type", "application/json")
	r = withExtAuth(r)
	r = extChiContext(r, map[string]string{"id": extCharID.String()})
	w := httptest.NewRecorder()

	h.UpdateCharacter(w, r)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}
}

func TestDeleteCharacter_Success(t *testing.T) {
	ctrl := gomock.NewController(t)
	mock := mocks.NewMockService(ctrl)

	mock.EXPECT().
		DeleteCharacter(gomock.Any(), gomock.Any(), gomock.Any()).
		Return(nil).Times(1)

	h := editor.NewHandler(mock, auditlog.NoOpLogger{}, zerolog.Nop())

	r := httptest.NewRequest(http.MethodDelete, "/editor/characters/"+extCharID.String(), nil)
	r = withExtAuth(r)
	r = extChiContext(r, map[string]string{"id": extCharID.String()})
	w := httptest.NewRecorder()

	h.DeleteCharacter(w, r)

	if w.Code != http.StatusNoContent {
		t.Fatalf("expected 204, got %d", w.Code)
	}
}

func TestUpdateConfigJson_Success(t *testing.T) {
	ctrl := gomock.NewController(t)
	mock := mocks.NewMockService(ctrl)

	resp := extSampleThemeResponse()
	resp.ConfigJson = json.RawMessage(`{"phases":["intro","discussion"]}`)
	mock.EXPECT().
		UpdateConfigJson(gomock.Any(), gomock.Any(), gomock.Any(), gomock.Any()).
		Return(resp, nil).Times(1)

	h := editor.NewHandler(mock, auditlog.NoOpLogger{}, zerolog.Nop())

	body := `{"phases":["intro","discussion"]}`
	r := httptest.NewRequest(http.MethodPut, "/editor/themes/"+extThemeID.String()+"/config", bytes.NewBufferString(body))
	r.Header.Set("Content-Type", "application/json")
	r = withExtAuth(r)
	r = extChiContext(r, map[string]string{"id": extThemeID.String()})
	w := httptest.NewRecorder()

	h.UpdateConfigJson(w, r)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}
}

func TestGetCharacterRoleSheet_Success(t *testing.T) {
	ctrl := gomock.NewController(t)
	mock := mocks.NewMockService(ctrl)

	resp := &editor.RoleSheetResponse{
		CharacterID: extCharID,
		ThemeID:     extThemeID,
		Format:      editor.RoleSheetFormatMarkdown,
		Markdown:    &editor.RoleSheetMarkdown{Body: "## 비밀"},
		UpdatedAt:   &extNow,
	}
	mock.EXPECT().
		GetCharacterRoleSheet(gomock.Any(), gomock.Eq(extCreatorID), gomock.Eq(extCharID)).
		Return(resp, nil).Times(1)

	h := editor.NewHandler(mock, auditlog.NoOpLogger{}, zerolog.Nop())

	r := httptest.NewRequest(http.MethodGet, "/editor/characters/"+extCharID.String()+"/role-sheet", nil)
	r = withExtAuth(r)
	r = extChiContext(r, map[string]string{"id": extCharID.String()})
	w := httptest.NewRecorder()

	h.GetCharacterRoleSheet(w, r)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}
	var got editor.RoleSheetResponse
	if err := json.Unmarshal(w.Body.Bytes(), &got); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if got.Format != editor.RoleSheetFormatMarkdown || got.Markdown == nil || got.Markdown.Body != "## 비밀" {
		t.Fatalf("unexpected role sheet response: %+v", got)
	}
}

func TestGetCharacterRoleSheet_InvalidCharacterID(t *testing.T) {
	ctrl := gomock.NewController(t)
	mock := mocks.NewMockService(ctrl)
	h := editor.NewHandler(mock, auditlog.NoOpLogger{}, zerolog.Nop())

	r := httptest.NewRequest(http.MethodGet, "/editor/characters/not-a-uuid/role-sheet", nil)
	r = withExtAuth(r)
	r = extChiContext(r, map[string]string{"id": "not-a-uuid"})
	w := httptest.NewRecorder()

	h.GetCharacterRoleSheet(w, r)

	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d: %s", w.Code, w.Body.String())
	}
}

func TestGetCharacterRoleSheet_ServiceError(t *testing.T) {
	ctrl := gomock.NewController(t)
	mock := mocks.NewMockService(ctrl)
	mock.EXPECT().
		GetCharacterRoleSheet(gomock.Any(), gomock.Eq(extCreatorID), gomock.Eq(extCharID)).
		Return(nil, apperror.Internal("boom")).Times(1)

	h := editor.NewHandler(mock, auditlog.NoOpLogger{}, zerolog.Nop())

	r := httptest.NewRequest(http.MethodGet, "/editor/characters/"+extCharID.String()+"/role-sheet", nil)
	r = withExtAuth(r)
	r = extChiContext(r, map[string]string{"id": extCharID.String()})
	w := httptest.NewRecorder()

	h.GetCharacterRoleSheet(w, r)

	if w.Code != http.StatusInternalServerError {
		t.Fatalf("expected 500, got %d: %s", w.Code, w.Body.String())
	}
}

func TestUpsertCharacterRoleSheet_Success(t *testing.T) {
	ctrl := gomock.NewController(t)
	mock := mocks.NewMockService(ctrl)

	resp := &editor.RoleSheetResponse{
		CharacterID: extCharID,
		ThemeID:     extThemeID,
		Format:      editor.RoleSheetFormatMarkdown,
		Markdown:    &editor.RoleSheetMarkdown{Body: "## 새 역할지"},
		UpdatedAt:   &extNow,
	}
	mock.EXPECT().
		UpsertCharacterRoleSheet(
			gomock.Any(),
			gomock.Eq(extCreatorID),
			gomock.Eq(extCharID),
			gomock.Eq(editor.UpsertRoleSheetRequest{Format: editor.RoleSheetFormatMarkdown, Markdown: &editor.RoleSheetMarkdown{Body: "## 새 역할지"}}),
		).
		Return(resp, nil).Times(1)

	h := editor.NewHandler(mock, auditlog.NoOpLogger{}, zerolog.Nop())

	body := `{"format":"markdown","markdown":{"body":"## 새 역할지"}}`
	r := httptest.NewRequest(http.MethodPut, "/editor/characters/"+extCharID.String()+"/role-sheet", bytes.NewBufferString(body))
	r.Header.Set("Content-Type", "application/json")
	r = withExtAuth(r)
	r = extChiContext(r, map[string]string{"id": extCharID.String()})
	w := httptest.NewRecorder()

	h.UpsertCharacterRoleSheet(w, r)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}
	var got editor.RoleSheetResponse
	if err := json.Unmarshal(w.Body.Bytes(), &got); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if got.Format != editor.RoleSheetFormatMarkdown || got.Markdown == nil || got.Markdown.Body != "## 새 역할지" {
		t.Fatalf("unexpected role sheet response: %+v", got)
	}
}

func TestUpsertCharacterRoleSheet_InvalidCharacterID(t *testing.T) {
	ctrl := gomock.NewController(t)
	mock := mocks.NewMockService(ctrl)
	h := editor.NewHandler(mock, auditlog.NoOpLogger{}, zerolog.Nop())

	r := httptest.NewRequest(http.MethodPut, "/editor/characters/not-a-uuid/role-sheet", bytes.NewBufferString(`{"format":"markdown"}`))
	r.Header.Set("Content-Type", "application/json")
	r = withExtAuth(r)
	r = extChiContext(r, map[string]string{"id": "not-a-uuid"})
	w := httptest.NewRecorder()

	h.UpsertCharacterRoleSheet(w, r)

	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d: %s", w.Code, w.Body.String())
	}
}

func TestUpsertCharacterRoleSheet_InvalidJSON(t *testing.T) {
	ctrl := gomock.NewController(t)
	mock := mocks.NewMockService(ctrl)
	h := editor.NewHandler(mock, auditlog.NoOpLogger{}, zerolog.Nop())

	r := httptest.NewRequest(http.MethodPut, "/editor/characters/"+extCharID.String()+"/role-sheet", bytes.NewBufferString(`{`))
	r.Header.Set("Content-Type", "application/json")
	r = withExtAuth(r)
	r = extChiContext(r, map[string]string{"id": extCharID.String()})
	w := httptest.NewRecorder()

	h.UpsertCharacterRoleSheet(w, r)

	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d: %s", w.Code, w.Body.String())
	}
}

func TestUpsertCharacterRoleSheet_ServiceError(t *testing.T) {
	ctrl := gomock.NewController(t)
	mock := mocks.NewMockService(ctrl)
	mock.EXPECT().
		UpsertCharacterRoleSheet(
			gomock.Any(),
			gomock.Eq(extCreatorID),
			gomock.Eq(extCharID),
			gomock.Eq(editor.UpsertRoleSheetRequest{Format: editor.RoleSheetFormatMarkdown, Markdown: &editor.RoleSheetMarkdown{Body: "boom"}}),
		).
		Return(nil, apperror.Internal("boom")).Times(1)

	h := editor.NewHandler(mock, auditlog.NoOpLogger{}, zerolog.Nop())

	r := httptest.NewRequest(http.MethodPut, "/editor/characters/"+extCharID.String()+"/role-sheet", bytes.NewBufferString(`{"format":"markdown","markdown":{"body":"boom"}}`))
	r.Header.Set("Content-Type", "application/json")
	r = withExtAuth(r)
	r = extChiContext(r, map[string]string{"id": extCharID.String()})
	w := httptest.NewRecorder()

	h.UpsertCharacterRoleSheet(w, r)

	if w.Code != http.StatusInternalServerError {
		t.Fatalf("expected 500, got %d: %s", w.Code, w.Body.String())
	}
}
