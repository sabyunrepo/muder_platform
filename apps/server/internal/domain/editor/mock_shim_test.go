package editor

// mock_shim_test.go provides a hand-rolled mockService shim and test helpers
// used by clue_edge_handler_test.go, clue_edge_audit_test.go, and other
// white-box test files that require package-internal access. These cannot use
// gomock because they live in package editor and rely on unexported symbols.
//
// TODO(phase-19-residual PR-5a): white-box 테스트가 black-box 로 전환되거나
// Service interface 가 sub-package 로 분리되어 import cycle 이 해소되면
// 이 파일을 제거하고 mocks/mock_service.go 만 사용. PR-5d PoC 에서 재평가.
// editor 는 212 LOC 로 가장 큼 — 성장 시 우선 분리 대상.

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	"github.com/mmp-platform/server/internal/middleware"
)

var (
	testCreatorID = uuid.MustParse("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa")
	testThemeID   = uuid.MustParse("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb")
	testCharID    = uuid.MustParse("cccccccc-cccc-cccc-cccc-cccccccccccc")
	testNow       = time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC)
)

// mockService is a hand-rolled stub for the editor.Service interface.
type mockService struct {
	createThemeFn      func(ctx context.Context, creatorID uuid.UUID, req CreateThemeRequest) (*ThemeResponse, error)
	updateThemeFn      func(ctx context.Context, creatorID, themeID uuid.UUID, req UpdateThemeRequest) (*ThemeResponse, error)
	deleteThemeFn      func(ctx context.Context, creatorID, themeID uuid.UUID) error
	listMyThemesFn     func(ctx context.Context, creatorID uuid.UUID) ([]ThemeSummary, error)
	getThemeBySlugFn   func(ctx context.Context, creatorID uuid.UUID, slug string) (*ThemeResponse, error)
	publishThemeFn     func(ctx context.Context, creatorID, themeID uuid.UUID) (*ThemeResponse, error)
	unpublishThemeFn   func(ctx context.Context, creatorID, themeID uuid.UUID) (*ThemeResponse, error)
	createCharFn       func(ctx context.Context, creatorID, themeID uuid.UUID, req CreateCharacterRequest) (*CharacterResponse, error)
	updateCharFn       func(ctx context.Context, creatorID, charID uuid.UUID, req UpdateCharacterRequest) (*CharacterResponse, error)
	deleteCharFn       func(ctx context.Context, creatorID, charID uuid.UUID) error
	updateConfigFn     func(ctx context.Context, creatorID, themeID uuid.UUID, config json.RawMessage) (*ThemeResponse, error)
	getClueEdgesFn     func(ctx context.Context, creatorID, themeID uuid.UUID) ([]ClueEdgeGroupResponse, error)
	replaceClueEdgesFn func(ctx context.Context, creatorID, themeID uuid.UUID, reqs []ClueEdgeGroupRequest) ([]ClueEdgeGroupResponse, error)
}

func (m *mockService) CreateTheme(ctx context.Context, creatorID uuid.UUID, req CreateThemeRequest) (*ThemeResponse, error) {
	if m.createThemeFn != nil {
		return m.createThemeFn(ctx, creatorID, req)
	}
	return nil, nil
}
func (m *mockService) UpdateTheme(ctx context.Context, creatorID, themeID uuid.UUID, req UpdateThemeRequest) (*ThemeResponse, error) {
	if m.updateThemeFn != nil {
		return m.updateThemeFn(ctx, creatorID, themeID, req)
	}
	return nil, nil
}
func (m *mockService) DeleteTheme(ctx context.Context, creatorID, themeID uuid.UUID) error {
	if m.deleteThemeFn != nil {
		return m.deleteThemeFn(ctx, creatorID, themeID)
	}
	return nil
}
func (m *mockService) ListMyThemes(ctx context.Context, creatorID uuid.UUID) ([]ThemeSummary, error) {
	if m.listMyThemesFn != nil {
		return m.listMyThemesFn(ctx, creatorID)
	}
	return nil, nil
}
func (m *mockService) PublishTheme(ctx context.Context, creatorID, themeID uuid.UUID) (*ThemeResponse, error) {
	if m.publishThemeFn != nil {
		return m.publishThemeFn(ctx, creatorID, themeID)
	}
	return nil, nil
}
func (m *mockService) UnpublishTheme(ctx context.Context, creatorID, themeID uuid.UUID) (*ThemeResponse, error) {
	if m.unpublishThemeFn != nil {
		return m.unpublishThemeFn(ctx, creatorID, themeID)
	}
	return nil, nil
}
func (m *mockService) CreateCharacter(ctx context.Context, creatorID, themeID uuid.UUID, req CreateCharacterRequest) (*CharacterResponse, error) {
	if m.createCharFn != nil {
		return m.createCharFn(ctx, creatorID, themeID, req)
	}
	return nil, nil
}
func (m *mockService) UpdateCharacter(ctx context.Context, creatorID, charID uuid.UUID, req UpdateCharacterRequest) (*CharacterResponse, error) {
	if m.updateCharFn != nil {
		return m.updateCharFn(ctx, creatorID, charID, req)
	}
	return nil, nil
}
func (m *mockService) DeleteCharacter(ctx context.Context, creatorID, charID uuid.UUID) error {
	if m.deleteCharFn != nil {
		return m.deleteCharFn(ctx, creatorID, charID)
	}
	return nil
}
func (m *mockService) UpdateConfigJson(ctx context.Context, creatorID, themeID uuid.UUID, config json.RawMessage) (*ThemeResponse, error) {
	if m.updateConfigFn != nil {
		return m.updateConfigFn(ctx, creatorID, themeID, config)
	}
	return nil, nil
}
func (m *mockService) ListCharacters(ctx context.Context, creatorID, themeID uuid.UUID) ([]CharacterResponse, error) {
	return nil, nil
}
func (m *mockService) GetTheme(ctx context.Context, creatorID, themeID uuid.UUID) (*ThemeResponse, error) {
	return nil, nil
}
func (m *mockService) GetThemeBySlug(ctx context.Context, creatorID uuid.UUID, slug string) (*ThemeResponse, error) {
	if m.getThemeBySlugFn != nil {
		return m.getThemeBySlugFn(ctx, creatorID, slug)
	}
	return nil, nil
}
func (m *mockService) CreateMap(ctx context.Context, creatorID, themeID uuid.UUID, req CreateMapRequest) (*MapResponse, error) {
	return nil, nil
}
func (m *mockService) UpdateMap(ctx context.Context, creatorID, mapID uuid.UUID, req UpdateMapRequest) (*MapResponse, error) {
	return nil, nil
}
func (m *mockService) DeleteMap(ctx context.Context, creatorID, mapID uuid.UUID) error { return nil }
func (m *mockService) ListMaps(ctx context.Context, creatorID, themeID uuid.UUID) ([]MapResponse, error) {
	return nil, nil
}
func (m *mockService) CreateLocation(ctx context.Context, creatorID, themeID, mapID uuid.UUID, req CreateLocationRequest) (*LocationResponse, error) {
	return nil, nil
}
func (m *mockService) UpdateLocation(ctx context.Context, creatorID, locID uuid.UUID, req UpdateLocationRequest) (*LocationResponse, error) {
	return nil, nil
}
func (m *mockService) DeleteLocation(ctx context.Context, creatorID, locID uuid.UUID) error {
	return nil
}
func (m *mockService) ListLocations(ctx context.Context, creatorID, themeID uuid.UUID) ([]LocationResponse, error) {
	return nil, nil
}
func (m *mockService) CreateClue(ctx context.Context, creatorID, themeID uuid.UUID, req CreateClueRequest) (*ClueResponse, error) {
	return nil, nil
}
func (m *mockService) UpdateClue(ctx context.Context, creatorID, clueID uuid.UUID, req UpdateClueRequest) (*ClueResponse, error) {
	return nil, nil
}
func (m *mockService) DeleteClue(ctx context.Context, creatorID, clueID uuid.UUID) error { return nil }
func (m *mockService) ListClues(ctx context.Context, creatorID, themeID uuid.UUID) ([]ClueResponse, error) {
	return nil, nil
}
func (m *mockService) SubmitForReview(ctx context.Context, userID, themeID uuid.UUID) (*ThemeResponse, error) {
	return nil, nil
}
func (m *mockService) GetModuleSchemas(ctx context.Context) (map[string]json.RawMessage, error) {
	return nil, nil
}
func (m *mockService) GetClueEdges(ctx context.Context, creatorID, themeID uuid.UUID) ([]ClueEdgeGroupResponse, error) {
	if m.getClueEdgesFn != nil {
		return m.getClueEdgesFn(ctx, creatorID, themeID)
	}
	return []ClueEdgeGroupResponse{}, nil
}
func (m *mockService) ReplaceClueEdges(ctx context.Context, creatorID, themeID uuid.UUID, reqs []ClueEdgeGroupRequest) ([]ClueEdgeGroupResponse, error) {
	if m.replaceClueEdgesFn != nil {
		return m.replaceClueEdgesFn(ctx, creatorID, themeID, reqs)
	}
	return []ClueEdgeGroupResponse{}, nil
}
func (m *mockService) GetContent(ctx context.Context, creatorID, themeID uuid.UUID, key string) (*ContentResponse, error) {
	return nil, nil
}
func (m *mockService) UpsertContent(ctx context.Context, creatorID, themeID uuid.UUID, key string, body string) (*ContentResponse, error) {
	return nil, nil
}
func (m *mockService) ValidateTheme(ctx context.Context, creatorID, themeID uuid.UUID) (*ValidationResponse, error) {
	return nil, nil
}
func (m *mockService) GetCharacterRoleSheet(ctx context.Context, creatorID, charID uuid.UUID) (*RoleSheetResponse, error) {
	return nil, errors.New("mockService.GetCharacterRoleSheet not configured")
}
func (m *mockService) UpsertCharacterRoleSheet(ctx context.Context, creatorID, charID uuid.UUID, req UpsertRoleSheetRequest) (*RoleSheetResponse, error) {
	return nil, errors.New("mockService.UpsertCharacterRoleSheet not configured")
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
