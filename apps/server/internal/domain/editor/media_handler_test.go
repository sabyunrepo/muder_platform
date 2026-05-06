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

	"github.com/mmp-platform/server/internal/apperror"
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

func TestMediaHandler_ListCategories(t *testing.T) {
	ctrl := gomock.NewController(t)
	mock := NewMockMediaService(ctrl)
	h := NewMediaHandler(mock)
	themeID := uuid.New()
	mock.EXPECT().
		ListCategories(gomock.Any(), gomock.Any(), themeID).
		Return([]MediaCategoryResponse{{ID: uuid.New(), ThemeID: themeID, Name: "배경", SortOrder: 1, CreatedAt: time.Now()}}, nil).
		Times(1)
	r := mediaHandlerRequest(http.MethodGet, "/editor/themes/"+themeID.String()+"/media/categories", nil, map[string]string{"id": themeID.String()})
	w := httptest.NewRecorder()

	h.ListCategories(w, r)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}
}

func TestMediaHandler_FileAndYouTubeMutations(t *testing.T) {
	ctrl := gomock.NewController(t)
	mock := NewMockMediaService(ctrl)
	h := NewMediaHandler(mock)
	themeID := uuid.New()
	mediaID := uuid.New()
	uploadID := uuid.New()
	mock.EXPECT().
		RequestUpload(gomock.Any(), gomock.Any(), themeID, RequestMediaUploadRequest{Name: "map", Type: MediaTypeImage, MimeType: "image/png", FileSize: 8}).
		Return(&UploadURLResponse{UploadID: uploadID, UploadURL: "https://upload.example/new", ExpiresAt: time.Now()}, nil).
		Times(1)
	mock.EXPECT().
		ConfirmUpload(gomock.Any(), gomock.Any(), themeID, ConfirmUploadRequest{UploadID: uploadID}).
		Return(&MediaResponse{ID: mediaID, ThemeID: themeID, Name: "map", Type: MediaTypeImage, SourceType: SourceTypeFile, Tags: []string{}, CreatedAt: time.Now()}, nil).
		Times(1)
	mock.EXPECT().
		CreateYouTube(gomock.Any(), gomock.Any(), themeID, CreateMediaYouTubeRequest{Name: "trailer", Type: MediaTypeVideo, URL: "https://youtu.be/dQw4w9WgXcQ"}).
		Return(&MediaResponse{ID: mediaID, ThemeID: themeID, Name: "trailer", Type: MediaTypeVideo, SourceType: SourceTypeYouTube, Tags: []string{}, CreatedAt: time.Now()}, nil).
		Times(1)
	mock.EXPECT().
		UpdateMedia(gomock.Any(), gomock.Any(), mediaID, UpdateMediaRequest{Name: "updated", Type: MediaTypeImage, SortOrder: 1}).
		Return(&MediaResponse{ID: mediaID, ThemeID: themeID, Name: "updated", Type: MediaTypeImage, SourceType: SourceTypeFile, Tags: []string{}, CreatedAt: time.Now()}, nil).
		Times(1)
	mock.EXPECT().
		DeleteMedia(gomock.Any(), gomock.Any(), mediaID).
		Return(nil).
		Times(1)
	mock.EXPECT().
		GetEditorMediaDownloadURL(gomock.Any(), gomock.Any(), mediaID).
		Return(&MediaDownloadURLResponse{URL: "https://download.example/media", ExpiresAt: time.Now()}, nil).
		Times(1)

	requestUpload := mediaHandlerRequest(http.MethodPost, "/editor/themes/"+themeID.String()+"/media/upload-url", []byte(`{"name":"map","type":"IMAGE","mime_type":"image/png","file_size":8}`), map[string]string{"id": themeID.String()})
	requestUploadW := httptest.NewRecorder()
	h.RequestUpload(requestUploadW, requestUpload)
	if requestUploadW.Code != http.StatusCreated {
		t.Fatalf("expected upload request 201, got %d: %s", requestUploadW.Code, requestUploadW.Body.String())
	}

	confirmUpload := mediaHandlerRequest(http.MethodPost, "/editor/themes/"+themeID.String()+"/media/confirm", []byte(`{"upload_id":"`+uploadID.String()+`"}`), map[string]string{"id": themeID.String()})
	confirmUploadW := httptest.NewRecorder()
	h.ConfirmUpload(confirmUploadW, confirmUpload)
	if confirmUploadW.Code != http.StatusOK {
		t.Fatalf("expected confirm upload 200, got %d: %s", confirmUploadW.Code, confirmUploadW.Body.String())
	}

	youtube := mediaHandlerRequest(http.MethodPost, "/editor/themes/"+themeID.String()+"/media/youtube", []byte(`{"name":"trailer","type":"VIDEO","url":"https://youtu.be/dQw4w9WgXcQ"}`), map[string]string{"id": themeID.String()})
	youtubeW := httptest.NewRecorder()
	h.CreateYouTube(youtubeW, youtube)
	if youtubeW.Code != http.StatusCreated {
		t.Fatalf("expected youtube 201, got %d: %s", youtubeW.Code, youtubeW.Body.String())
	}

	update := mediaHandlerRequest(http.MethodPatch, "/editor/media/"+mediaID.String(), []byte(`{"name":"updated","type":"IMAGE","sort_order":1}`), map[string]string{"id": mediaID.String()})
	updateW := httptest.NewRecorder()
	h.UpdateMedia(updateW, update)
	if updateW.Code != http.StatusOK {
		t.Fatalf("expected update 200, got %d: %s", updateW.Code, updateW.Body.String())
	}

	download := mediaHandlerRequest(http.MethodGet, "/editor/media/"+mediaID.String()+"/download-url", nil, map[string]string{"id": mediaID.String()})
	downloadW := httptest.NewRecorder()
	h.GetDownloadURL(downloadW, download)
	if downloadW.Code != http.StatusOK {
		t.Fatalf("expected download 200, got %d: %s", downloadW.Code, downloadW.Body.String())
	}

	deleteReq := mediaHandlerRequest(http.MethodDelete, "/editor/media/"+mediaID.String(), nil, map[string]string{"id": mediaID.String()})
	deleteW := httptest.NewRecorder()
	h.DeleteMedia(deleteW, deleteReq)
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

func TestMediaHandler_InvalidRouteIDs(t *testing.T) {
	ctrl := gomock.NewController(t)
	h := NewMediaHandler(NewMockMediaService(ctrl))
	tests := []struct {
		name    string
		handler func(http.ResponseWriter, *http.Request)
		method  string
		path    string
	}{
		{name: "list media", handler: h.ListMedia, method: http.MethodGet, path: "/editor/themes/bad/media"},
		{name: "list categories", handler: h.ListCategories, method: http.MethodGet, path: "/editor/themes/bad/media/categories"},
		{name: "create category", handler: h.CreateCategory, method: http.MethodPost, path: "/editor/themes/bad/media/categories"},
		{name: "update category", handler: h.UpdateCategory, method: http.MethodPatch, path: "/editor/media/categories/bad"},
		{name: "delete category", handler: h.DeleteCategory, method: http.MethodDelete, path: "/editor/media/categories/bad"},
		{name: "request upload", handler: h.RequestUpload, method: http.MethodPost, path: "/editor/themes/bad/media/upload-url"},
		{name: "confirm upload", handler: h.ConfirmUpload, method: http.MethodPost, path: "/editor/themes/bad/media/confirm"},
		{name: "create youtube", handler: h.CreateYouTube, method: http.MethodPost, path: "/editor/themes/bad/media/youtube"},
		{name: "update media", handler: h.UpdateMedia, method: http.MethodPatch, path: "/editor/media/bad"},
		{name: "delete media", handler: h.DeleteMedia, method: http.MethodDelete, path: "/editor/media/bad"},
		{name: "preview delete", handler: h.PreviewDeleteMedia, method: http.MethodGet, path: "/editor/media/bad/references"},
		{name: "request replacement", handler: h.RequestReplacementUpload, method: http.MethodPost, path: "/editor/media/bad/replace-upload-url"},
		{name: "confirm replacement", handler: h.ConfirmReplacementUpload, method: http.MethodPost, path: "/editor/media/bad/replace-confirm"},
		{name: "download", handler: h.GetDownloadURL, method: http.MethodGet, path: "/editor/media/bad/download-url"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			r := mediaHandlerRequest(tt.method, tt.path, []byte(`{}`), map[string]string{"id": "bad"})
			w := httptest.NewRecorder()

			tt.handler(w, r)

			if w.Code != http.StatusBadRequest {
				t.Fatalf("expected 400, got %d: %s", w.Code, w.Body.String())
			}
		})
	}
}

func TestMediaHandler_InvalidJSONBodies(t *testing.T) {
	ctrl := gomock.NewController(t)
	h := NewMediaHandler(NewMockMediaService(ctrl))
	themeID := uuid.New()
	mediaID := uuid.New()
	categoryID := uuid.New()
	tests := []struct {
		name    string
		handler func(http.ResponseWriter, *http.Request)
		method  string
		path    string
		id      uuid.UUID
	}{
		{name: "create category", handler: h.CreateCategory, method: http.MethodPost, path: "/editor/themes/" + themeID.String() + "/media/categories", id: themeID},
		{name: "update category", handler: h.UpdateCategory, method: http.MethodPatch, path: "/editor/media/categories/" + categoryID.String(), id: categoryID},
		{name: "request upload", handler: h.RequestUpload, method: http.MethodPost, path: "/editor/themes/" + themeID.String() + "/media/upload-url", id: themeID},
		{name: "confirm upload", handler: h.ConfirmUpload, method: http.MethodPost, path: "/editor/themes/" + themeID.String() + "/media/confirm", id: themeID},
		{name: "create youtube", handler: h.CreateYouTube, method: http.MethodPost, path: "/editor/themes/" + themeID.String() + "/media/youtube", id: themeID},
		{name: "update media", handler: h.UpdateMedia, method: http.MethodPatch, path: "/editor/media/" + mediaID.String(), id: mediaID},
		{name: "request replacement", handler: h.RequestReplacementUpload, method: http.MethodPost, path: "/editor/media/" + mediaID.String() + "/replace-upload-url", id: mediaID},
		{name: "confirm replacement", handler: h.ConfirmReplacementUpload, method: http.MethodPost, path: "/editor/media/" + mediaID.String() + "/replace-confirm", id: mediaID},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			r := mediaHandlerRequest(tt.method, tt.path, []byte(`{"broken"`), map[string]string{"id": tt.id.String()})
			w := httptest.NewRecorder()

			tt.handler(w, r)

			if w.Code != http.StatusBadRequest {
				t.Fatalf("expected 400, got %d: %s", w.Code, w.Body.String())
			}
		})
	}
}

func TestMediaHandler_ServiceErrors(t *testing.T) {
	ctrl := gomock.NewController(t)
	mock := NewMockMediaService(ctrl)
	h := NewMediaHandler(mock)
	themeID := uuid.New()
	mediaID := uuid.New()
	categoryID := uuid.New()
	uploadID := uuid.New()
	serviceErr := apperror.Internal("service failed")
	tests := []struct {
		name    string
		handler func(http.ResponseWriter, *http.Request)
		method  string
		path    string
		id      uuid.UUID
		body    string
		expect  func()
	}{
		{
			name:    "list media",
			handler: h.ListMedia,
			method:  http.MethodGet,
			path:    "/editor/themes/" + themeID.String() + "/media",
			id:      themeID,
			expect: func() {
				mock.EXPECT().ListMedia(gomock.Any(), gomock.Any(), themeID, "", (*uuid.UUID)(nil)).Return(nil, serviceErr)
			},
		},
		{
			name:    "list categories",
			handler: h.ListCategories,
			method:  http.MethodGet,
			path:    "/editor/themes/" + themeID.String() + "/media/categories",
			id:      themeID,
			expect: func() {
				mock.EXPECT().ListCategories(gomock.Any(), gomock.Any(), themeID).Return(nil, serviceErr)
			},
		},
		{
			name:    "create category",
			handler: h.CreateCategory,
			method:  http.MethodPost,
			path:    "/editor/themes/" + themeID.String() + "/media/categories",
			id:      themeID,
			body:    `{"name":"배경"}`,
			expect: func() {
				mock.EXPECT().CreateCategory(gomock.Any(), gomock.Any(), themeID, MediaCategoryRequest{Name: "배경"}).Return(nil, serviceErr)
			},
		},
		{
			name:    "update category",
			handler: h.UpdateCategory,
			method:  http.MethodPatch,
			path:    "/editor/media/categories/" + categoryID.String(),
			id:      categoryID,
			body:    `{"name":"전경"}`,
			expect: func() {
				mock.EXPECT().UpdateCategory(gomock.Any(), gomock.Any(), categoryID, MediaCategoryRequest{Name: "전경"}).Return(nil, serviceErr)
			},
		},
		{
			name:    "delete category",
			handler: h.DeleteCategory,
			method:  http.MethodDelete,
			path:    "/editor/media/categories/" + categoryID.String(),
			id:      categoryID,
			expect: func() {
				mock.EXPECT().DeleteCategory(gomock.Any(), gomock.Any(), categoryID).Return(serviceErr)
			},
		},
		{
			name:    "request upload",
			handler: h.RequestUpload,
			method:  http.MethodPost,
			path:    "/editor/themes/" + themeID.String() + "/media/upload-url",
			id:      themeID,
			body:    `{"name":"map","type":"IMAGE","mime_type":"image/png","file_size":8}`,
			expect: func() {
				mock.EXPECT().RequestUpload(gomock.Any(), gomock.Any(), themeID, RequestMediaUploadRequest{Name: "map", Type: MediaTypeImage, MimeType: "image/png", FileSize: 8}).Return(nil, serviceErr)
			},
		},
		{
			name:    "confirm upload",
			handler: h.ConfirmUpload,
			method:  http.MethodPost,
			path:    "/editor/themes/" + themeID.String() + "/media/confirm",
			id:      themeID,
			body:    `{"upload_id":"` + uploadID.String() + `"}`,
			expect: func() {
				mock.EXPECT().ConfirmUpload(gomock.Any(), gomock.Any(), themeID, ConfirmUploadRequest{UploadID: uploadID}).Return(nil, serviceErr)
			},
		},
		{
			name:    "create youtube",
			handler: h.CreateYouTube,
			method:  http.MethodPost,
			path:    "/editor/themes/" + themeID.String() + "/media/youtube",
			id:      themeID,
			body:    `{"name":"trailer","type":"VIDEO","url":"https://youtu.be/dQw4w9WgXcQ"}`,
			expect: func() {
				mock.EXPECT().CreateYouTube(gomock.Any(), gomock.Any(), themeID, CreateMediaYouTubeRequest{Name: "trailer", Type: MediaTypeVideo, URL: "https://youtu.be/dQw4w9WgXcQ"}).Return(nil, serviceErr)
			},
		},
		{
			name:    "update media",
			handler: h.UpdateMedia,
			method:  http.MethodPatch,
			path:    "/editor/media/" + mediaID.String(),
			id:      mediaID,
			body:    `{"name":"updated","type":"IMAGE"}`,
			expect: func() {
				mock.EXPECT().UpdateMedia(gomock.Any(), gomock.Any(), mediaID, UpdateMediaRequest{Name: "updated", Type: MediaTypeImage}).Return(nil, serviceErr)
			},
		},
		{
			name:    "delete media",
			handler: h.DeleteMedia,
			method:  http.MethodDelete,
			path:    "/editor/media/" + mediaID.String(),
			id:      mediaID,
			expect: func() {
				mock.EXPECT().DeleteMedia(gomock.Any(), gomock.Any(), mediaID).Return(serviceErr)
			},
		},
		{
			name:    "preview delete",
			handler: h.PreviewDeleteMedia,
			method:  http.MethodGet,
			path:    "/editor/media/" + mediaID.String() + "/references",
			id:      mediaID,
			expect: func() {
				mock.EXPECT().PreviewDeleteMedia(gomock.Any(), gomock.Any(), mediaID).Return(nil, serviceErr)
			},
		},
		{
			name:    "request replacement",
			handler: h.RequestReplacementUpload,
			method:  http.MethodPost,
			path:    "/editor/media/" + mediaID.String() + "/replace-upload-url",
			id:      mediaID,
			body:    `{"mime_type":"image/png","file_size":8}`,
			expect: func() {
				mock.EXPECT().RequestReplacementUpload(gomock.Any(), gomock.Any(), mediaID, RequestMediaReplacementUploadRequest{MimeType: "image/png", FileSize: 8}).Return(nil, serviceErr)
			},
		},
		{
			name:    "confirm replacement",
			handler: h.ConfirmReplacementUpload,
			method:  http.MethodPost,
			path:    "/editor/media/" + mediaID.String() + "/replace-confirm",
			id:      mediaID,
			body:    `{"upload_id":"` + uploadID.String() + `"}`,
			expect: func() {
				mock.EXPECT().ConfirmReplacementUpload(gomock.Any(), gomock.Any(), mediaID, ConfirmUploadRequest{UploadID: uploadID}).Return(nil, serviceErr)
			},
		},
		{
			name:    "download",
			handler: h.GetDownloadURL,
			method:  http.MethodGet,
			path:    "/editor/media/" + mediaID.String() + "/download-url",
			id:      mediaID,
			expect: func() {
				mock.EXPECT().GetEditorMediaDownloadURL(gomock.Any(), gomock.Any(), mediaID).Return(nil, serviceErr)
			},
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			tt.expect()
			body := []byte(tt.body)
			if body == nil {
				body = []byte(`{}`)
			}
			r := mediaHandlerRequest(tt.method, tt.path, body, map[string]string{"id": tt.id.String()})
			w := httptest.NewRecorder()

			tt.handler(w, r)

			if w.Code != http.StatusInternalServerError {
				t.Fatalf("expected 500, got %d: %s", w.Code, w.Body.String())
			}
		})
	}
}
