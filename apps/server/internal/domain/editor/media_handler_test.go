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

	"github.com/mmp-platform/server/internal/middleware"
)

type stubMediaService struct {
	listMediaCategoryID *uuid.UUID
	listMediaType       string
	listMediaThemeID    uuid.UUID
	categoryReq         MediaCategoryRequest
	replacementReq      RequestMediaReplacementUploadRequest
	confirmReq          ConfirmUploadRequest
	deletedCategoryID   uuid.UUID
	deletedMediaID      uuid.UUID
}

func (s *stubMediaService) ListMedia(_ context.Context, _ uuid.UUID, themeID uuid.UUID, mediaType string, categoryID *uuid.UUID) ([]MediaResponse, error) {
	s.listMediaThemeID = themeID
	s.listMediaType = mediaType
	s.listMediaCategoryID = categoryID
	return []MediaResponse{{ID: uuid.New(), ThemeID: themeID, Name: "map", Type: MediaTypeImage, SourceType: SourceTypeFile, Tags: []string{}, CreatedAt: time.Now()}}, nil
}

func (s *stubMediaService) ListCategories(_ context.Context, _ uuid.UUID, themeID uuid.UUID) ([]MediaCategoryResponse, error) {
	return []MediaCategoryResponse{{ID: uuid.New(), ThemeID: themeID, Name: "배경", SortOrder: 1, CreatedAt: time.Now()}}, nil
}

func (s *stubMediaService) CreateCategory(_ context.Context, _ uuid.UUID, themeID uuid.UUID, req MediaCategoryRequest) (*MediaCategoryResponse, error) {
	s.categoryReq = req
	return &MediaCategoryResponse{ID: uuid.New(), ThemeID: themeID, Name: req.Name, SortOrder: req.SortOrder, CreatedAt: time.Now()}, nil
}

func (s *stubMediaService) UpdateCategory(_ context.Context, _ uuid.UUID, categoryID uuid.UUID, req MediaCategoryRequest) (*MediaCategoryResponse, error) {
	s.categoryReq = req
	return &MediaCategoryResponse{ID: categoryID, ThemeID: uuid.New(), Name: req.Name, SortOrder: req.SortOrder, CreatedAt: time.Now()}, nil
}

func (s *stubMediaService) DeleteCategory(_ context.Context, _ uuid.UUID, categoryID uuid.UUID) error {
	s.deletedCategoryID = categoryID
	return nil
}

func (s *stubMediaService) RequestUpload(context.Context, uuid.UUID, uuid.UUID, RequestMediaUploadRequest) (*UploadURLResponse, error) {
	return &UploadURLResponse{UploadID: uuid.New(), UploadURL: "https://upload.example/new", ExpiresAt: time.Now()}, nil
}

func (s *stubMediaService) ConfirmUpload(context.Context, uuid.UUID, uuid.UUID, ConfirmUploadRequest) (*MediaResponse, error) {
	return &MediaResponse{ID: uuid.New(), ThemeID: uuid.New(), Name: "media", Type: MediaTypeImage, SourceType: SourceTypeFile, Tags: []string{}, CreatedAt: time.Now()}, nil
}

func (s *stubMediaService) CreateYouTube(context.Context, uuid.UUID, uuid.UUID, CreateMediaYouTubeRequest) (*MediaResponse, error) {
	return &MediaResponse{ID: uuid.New(), ThemeID: uuid.New(), Name: "video", Type: MediaTypeVideo, SourceType: SourceTypeYouTube, Tags: []string{}, CreatedAt: time.Now()}, nil
}

func (s *stubMediaService) UpdateMedia(context.Context, uuid.UUID, uuid.UUID, UpdateMediaRequest) (*MediaResponse, error) {
	return &MediaResponse{ID: uuid.New(), ThemeID: uuid.New(), Name: "updated", Type: MediaTypeImage, SourceType: SourceTypeFile, Tags: []string{}, CreatedAt: time.Now()}, nil
}

func (s *stubMediaService) PreviewDeleteMedia(_ context.Context, _ uuid.UUID, mediaID uuid.UUID) (*MediaDeletePreviewResponse, error) {
	return &MediaDeletePreviewResponse{References: []MediaReferenceResponse{{Type: "map", ID: mediaID.String(), Name: "1층 지도"}}}, nil
}

func (s *stubMediaService) DeleteMedia(_ context.Context, _ uuid.UUID, mediaID uuid.UUID) error {
	s.deletedMediaID = mediaID
	return nil
}

func (s *stubMediaService) RequestReplacementUpload(_ context.Context, _ uuid.UUID, _ uuid.UUID, req RequestMediaReplacementUploadRequest) (*UploadURLResponse, error) {
	s.replacementReq = req
	return &UploadURLResponse{UploadID: uuid.New(), UploadURL: "https://upload.example/replacement", ExpiresAt: time.Now()}, nil
}

func (s *stubMediaService) ConfirmReplacementUpload(_ context.Context, _ uuid.UUID, _ uuid.UUID, req ConfirmUploadRequest) (*MediaResponse, error) {
	s.confirmReq = req
	return &MediaResponse{ID: uuid.New(), ThemeID: uuid.New(), Name: "replaced", Type: MediaTypeImage, SourceType: SourceTypeFile, Tags: []string{}, CreatedAt: time.Now()}, nil
}

func (s *stubMediaService) GetEditorMediaDownloadURL(context.Context, uuid.UUID, uuid.UUID) (*MediaDownloadURLResponse, error) {
	return &MediaDownloadURLResponse{URL: "https://download.example/media", ExpiresAt: time.Now()}, nil
}

func (s *stubMediaService) GetMediaPlayURL(context.Context, uuid.UUID, uuid.UUID) (string, error) {
	return "https://play.example/media", nil
}

func (s *stubMediaService) ResolveMediaURL(context.Context, uuid.UUID, uuid.UUID, ...string) (string, string, error) {
	return "https://play.example/media", MediaTypeImage, nil
}

func mediaHandlerRequest(method, path string, body []byte, params map[string]string) *http.Request {
	r := httptest.NewRequest(method, path, bytes.NewReader(body))
	r.Header.Set("Content-Type", "application/json")
	ctx := context.WithValue(r.Context(), middleware.UserIDKey, uuid.MustParse("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"))
	rctx := chi.NewRouteContext()
	for key, value := range params {
		rctx.URLParams.Add(key, value)
	}
	ctx = context.WithValue(ctx, chi.RouteCtxKey, rctx)
	return r.WithContext(ctx)
}

func TestMediaHandler_ListMedia_ParsesCategoryFilter(t *testing.T) {
	svc := &stubMediaService{}
	h := NewMediaHandler(svc)
	themeID := uuid.New()
	categoryID := uuid.New()
	r := mediaHandlerRequest(http.MethodGet, "/editor/themes/"+themeID.String()+"/media?type=IMAGE&category_id="+categoryID.String(), nil, map[string]string{"id": themeID.String()})
	w := httptest.NewRecorder()

	h.ListMedia(w, r)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}
	if svc.listMediaThemeID != themeID || svc.listMediaType != MediaTypeImage || svc.listMediaCategoryID == nil || *svc.listMediaCategoryID != categoryID {
		t.Fatalf("handler did not forward list filters: %#v", svc)
	}
}

func TestMediaHandler_ListMedia_InvalidCategoryID(t *testing.T) {
	h := NewMediaHandler(&stubMediaService{})
	themeID := uuid.New()
	r := mediaHandlerRequest(http.MethodGet, "/editor/themes/"+themeID.String()+"/media?category_id=bad", nil, map[string]string{"id": themeID.String()})
	w := httptest.NewRecorder()

	h.ListMedia(w, r)

	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d: %s", w.Code, w.Body.String())
	}
}

func TestMediaHandler_CategoryCRUD(t *testing.T) {
	svc := &stubMediaService{}
	h := NewMediaHandler(svc)
	themeID := uuid.New()
	categoryID := uuid.New()

	create := mediaHandlerRequest(http.MethodPost, "/editor/themes/"+themeID.String()+"/media/categories", []byte(`{"name":" 배경 ","sort_order":2}`), map[string]string{"id": themeID.String()})
	createW := httptest.NewRecorder()
	h.CreateCategory(createW, create)
	if createW.Code != http.StatusCreated {
		t.Fatalf("expected create 201, got %d: %s", createW.Code, createW.Body.String())
	}
	if svc.categoryReq.Name != " 배경 " || svc.categoryReq.SortOrder != 2 {
		t.Fatalf("unexpected create request: %#v", svc.categoryReq)
	}

	update := mediaHandlerRequest(http.MethodPatch, "/editor/media/categories/"+categoryID.String(), []byte(`{"name":"현장","sort_order":3}`), map[string]string{"id": categoryID.String()})
	updateW := httptest.NewRecorder()
	h.UpdateCategory(updateW, update)
	if updateW.Code != http.StatusOK {
		t.Fatalf("expected update 200, got %d: %s", updateW.Code, updateW.Body.String())
	}
	if svc.categoryReq.Name != "현장" || svc.categoryReq.SortOrder != 3 {
		t.Fatalf("unexpected update request: %#v", svc.categoryReq)
	}

	deleteReq := mediaHandlerRequest(http.MethodDelete, "/editor/media/categories/"+categoryID.String(), nil, map[string]string{"id": categoryID.String()})
	deleteW := httptest.NewRecorder()
	h.DeleteCategory(deleteW, deleteReq)
	if deleteW.Code != http.StatusNoContent || svc.deletedCategoryID != categoryID {
		t.Fatalf("delete category failed: code=%d id=%s", deleteW.Code, svc.deletedCategoryID)
	}
}

func TestMediaHandler_DeletePreviewAndReplacementUpload(t *testing.T) {
	svc := &stubMediaService{}
	h := NewMediaHandler(svc)
	mediaID := uuid.New()

	preview := mediaHandlerRequest(http.MethodGet, "/editor/media/"+mediaID.String()+"/references", nil, map[string]string{"id": mediaID.String()})
	previewW := httptest.NewRecorder()
	h.PreviewDeleteMedia(previewW, preview)
	if previewW.Code != http.StatusOK {
		t.Fatalf("expected preview 200, got %d: %s", previewW.Code, previewW.Body.String())
	}
	var previewBody MediaDeletePreviewResponse
	if err := json.Unmarshal(previewW.Body.Bytes(), &previewBody); err != nil || len(previewBody.References) != 1 {
		t.Fatalf("unexpected preview body err=%v body=%s", err, previewW.Body.String())
	}

	replace := mediaHandlerRequest(http.MethodPost, "/editor/media/"+mediaID.String()+"/replace-upload-url", []byte(`{"mime_type":"image/png","file_size":8}`), map[string]string{"id": mediaID.String()})
	replaceW := httptest.NewRecorder()
	h.RequestReplacementUpload(replaceW, replace)
	if replaceW.Code != http.StatusCreated {
		t.Fatalf("expected replacement request 201, got %d: %s", replaceW.Code, replaceW.Body.String())
	}
	if svc.replacementReq.MimeType != "image/png" || svc.replacementReq.FileSize != 8 {
		t.Fatalf("unexpected replacement request: %#v", svc.replacementReq)
	}

	uploadID := uuid.New()
	confirm := mediaHandlerRequest(http.MethodPost, "/editor/media/"+mediaID.String()+"/replace-confirm", []byte(`{"upload_id":"`+uploadID.String()+`"}`), map[string]string{"id": mediaID.String()})
	confirmW := httptest.NewRecorder()
	h.ConfirmReplacementUpload(confirmW, confirm)
	if confirmW.Code != http.StatusOK {
		t.Fatalf("expected confirm 200, got %d: %s", confirmW.Code, confirmW.Body.String())
	}
	if svc.confirmReq.UploadID != uploadID {
		t.Fatalf("unexpected confirm request: %#v", svc.confirmReq)
	}
}
