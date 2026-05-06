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
	"go.uber.org/mock/gomock"

	"github.com/mmp-platform/server/internal/middleware"
)

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
	ctrl := gomock.NewController(t)
	mock := NewMockMediaService(ctrl)
	h := NewMediaHandler(mock)
	themeID := uuid.New()
	categoryID := uuid.New()
	mock.EXPECT().
		ListMedia(gomock.Any(), gomock.Any(), themeID, MediaTypeImage, gomock.Any()).
		DoAndReturn(func(_ context.Context, _ uuid.UUID, gotThemeID uuid.UUID, gotType string, gotCategoryID *uuid.UUID) ([]MediaResponse, error) {
			if gotThemeID != themeID || gotType != MediaTypeImage || gotCategoryID == nil || *gotCategoryID != categoryID {
				t.Fatalf("unexpected list filters: theme=%s type=%s category=%v", gotThemeID, gotType, gotCategoryID)
			}
			return []MediaResponse{{ID: uuid.New(), ThemeID: themeID, Name: "map", Type: MediaTypeImage, SourceType: SourceTypeFile, Tags: []string{}, CreatedAt: time.Now()}}, nil
		}).
		Times(1)
	r := mediaHandlerRequest(http.MethodGet, "/editor/themes/"+themeID.String()+"/media?type=IMAGE&category_id="+categoryID.String(), nil, map[string]string{"id": themeID.String()})
	w := httptest.NewRecorder()

	h.ListMedia(w, r)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}
}

func TestMediaHandler_ListMedia_InvalidCategoryID(t *testing.T) {
	ctrl := gomock.NewController(t)
	mock := NewMockMediaService(ctrl)
	h := NewMediaHandler(mock)
	themeID := uuid.New()
	r := mediaHandlerRequest(http.MethodGet, "/editor/themes/"+themeID.String()+"/media?category_id=bad", nil, map[string]string{"id": themeID.String()})
	w := httptest.NewRecorder()

	h.ListMedia(w, r)

	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d: %s", w.Code, w.Body.String())
	}
}

func TestMediaHandler_CategoryCRUD(t *testing.T) {
	ctrl := gomock.NewController(t)
	mock := NewMockMediaService(ctrl)
	h := NewMediaHandler(mock)
	themeID := uuid.New()
	categoryID := uuid.New()
	mock.EXPECT().
		CreateCategory(gomock.Any(), gomock.Any(), themeID, MediaCategoryRequest{Name: " 배경 ", SortOrder: 2}).
		Return(&MediaCategoryResponse{ID: categoryID, ThemeID: themeID, Name: " 배경 ", SortOrder: 2, CreatedAt: time.Now()}, nil).
		Times(1)
	mock.EXPECT().
		UpdateCategory(gomock.Any(), gomock.Any(), categoryID, MediaCategoryRequest{Name: "현장", SortOrder: 3}).
		Return(&MediaCategoryResponse{ID: categoryID, ThemeID: themeID, Name: "현장", SortOrder: 3, CreatedAt: time.Now()}, nil).
		Times(1)
	mock.EXPECT().
		DeleteCategory(gomock.Any(), gomock.Any(), categoryID).
		Return(nil).
		Times(1)

	create := mediaHandlerRequest(http.MethodPost, "/editor/themes/"+themeID.String()+"/media/categories", []byte(`{"name":" 배경 ","sort_order":2}`), map[string]string{"id": themeID.String()})
	createW := httptest.NewRecorder()
	h.CreateCategory(createW, create)
	if createW.Code != http.StatusCreated {
		t.Fatalf("expected create 201, got %d: %s", createW.Code, createW.Body.String())
	}

	update := mediaHandlerRequest(http.MethodPatch, "/editor/media/categories/"+categoryID.String(), []byte(`{"name":"현장","sort_order":3}`), map[string]string{"id": categoryID.String()})
	updateW := httptest.NewRecorder()
	h.UpdateCategory(updateW, update)
	if updateW.Code != http.StatusOK {
		t.Fatalf("expected update 200, got %d: %s", updateW.Code, updateW.Body.String())
	}

	deleteReq := mediaHandlerRequest(http.MethodDelete, "/editor/media/categories/"+categoryID.String(), nil, map[string]string{"id": categoryID.String()})
	deleteW := httptest.NewRecorder()
	h.DeleteCategory(deleteW, deleteReq)
	if deleteW.Code != http.StatusNoContent {
		t.Fatalf("expected delete 204, got %d: %s", deleteW.Code, deleteW.Body.String())
	}
}

func TestMediaHandler_DeletePreviewAndReplacementUpload(t *testing.T) {
	ctrl := gomock.NewController(t)
	mock := NewMockMediaService(ctrl)
	h := NewMediaHandler(mock)
	mediaID := uuid.New()
	uploadID := uuid.New()
	mock.EXPECT().
		PreviewDeleteMedia(gomock.Any(), gomock.Any(), mediaID).
		Return(&MediaDeletePreviewResponse{References: []MediaReferenceResponse{{Type: "map", ID: mediaID.String(), Name: "1층 지도"}}}, nil).
		Times(1)
	mock.EXPECT().
		RequestReplacementUpload(gomock.Any(), gomock.Any(), mediaID, RequestMediaReplacementUploadRequest{MimeType: "image/png", FileSize: 8}).
		Return(&UploadURLResponse{UploadID: uploadID, UploadURL: "https://upload.example/replacement", ExpiresAt: time.Now()}, nil).
		Times(1)
	mock.EXPECT().
		ConfirmReplacementUpload(gomock.Any(), gomock.Any(), mediaID, ConfirmUploadRequest{UploadID: uploadID}).
		Return(&MediaResponse{ID: mediaID, ThemeID: uuid.New(), Name: "replaced", Type: MediaTypeImage, SourceType: SourceTypeFile, Tags: []string{}, CreatedAt: time.Now()}, nil).
		Times(1)

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

	confirm := mediaHandlerRequest(http.MethodPost, "/editor/media/"+mediaID.String()+"/replace-confirm", []byte(`{"upload_id":"`+uploadID.String()+`"}`), map[string]string{"id": mediaID.String()})
	confirmW := httptest.NewRecorder()
	h.ConfirmReplacementUpload(confirmW, confirm)
	if confirmW.Code != http.StatusOK {
		t.Fatalf("expected confirm 200, got %d: %s", confirmW.Code, confirmW.Body.String())
	}
}
