package editor

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/google/uuid"
	"github.com/rs/zerolog"
	"go.uber.org/mock/gomock"

	"github.com/mmp-platform/server/internal/apperror"
	"github.com/mmp-platform/server/internal/auditlog"
)

type failingStoryInfoAuditLogger struct{}

func (failingStoryInfoAuditLogger) Append(context.Context, auditlog.AuditEvent) error {
	return errors.New("audit append failed")
}

func newStoryInfoHandlerMock(t *testing.T, audit auditlog.Logger) (*StoryInfoHandler, *MockStoryInfoService) {
	t.Helper()
	ctrl := gomock.NewController(t)
	mock := NewMockStoryInfoService(ctrl)
	return NewStoryInfoHandler(mock, audit, zerolog.Nop()), mock
}

func TestStoryInfoHandler_List_UsesCreatorAndTheme(t *testing.T) {
	infoID := uuid.New()
	h, svc := newStoryInfoHandlerMock(t, auditlog.NoOpLogger{})
	svc.EXPECT().
		List(gomock.Any(), testCreatorID, testThemeID).
		DoAndReturn(func(_ context.Context, creatorID, themeID uuid.UUID) ([]StoryInfoResponse, error) {
			if creatorID != testCreatorID || themeID != testThemeID {
				t.Fatalf("unexpected owner scope: creator=%s theme=%s", creatorID, themeID)
			}
			return []StoryInfoResponse{{ID: infoID, ThemeID: themeID, Title: "공개 정보"}}, nil
		})
	req := httptest.NewRequest(http.MethodGet, "/editor/themes/"+testThemeID.String()+"/story-infos", nil)
	req = withAuth(req)
	req = chiContext(req, map[string]string{"id": testThemeID.String()})
	rec := httptest.NewRecorder()

	h.ListStoryInfos(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rec.Code, rec.Body.String())
	}
	var got []StoryInfoResponse
	if err := json.Unmarshal(rec.Body.Bytes(), &got); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if len(got) != 1 || got[0].ID != infoID {
		t.Fatalf("unexpected response: %+v", got)
	}
}

func TestStoryInfoHandler_List_RejectsInvalidThemeID(t *testing.T) {
	h, _ := newStoryInfoHandlerMock(t, auditlog.NoOpLogger{})
	req := httptest.NewRequest(http.MethodGet, "/editor/themes/not-a-uuid/story-infos", nil)
	req = withAuth(req)
	req = chiContext(req, map[string]string{"id": "not-a-uuid"})
	rec := httptest.NewRecorder()

	h.ListStoryInfos(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d: %s", rec.Code, rec.Body.String())
	}
}

func TestStoryInfoHandler_List_WritesServiceError(t *testing.T) {
	h, svc := newStoryInfoHandlerMock(t, auditlog.NoOpLogger{})
	svc.EXPECT().
		List(gomock.Any(), testCreatorID, testThemeID).
		Return(nil, apperror.NotFound("theme not found"))
	req := httptest.NewRequest(http.MethodGet, "/editor/themes/"+testThemeID.String()+"/story-infos", nil)
	req = withAuth(req)
	req = chiContext(req, map[string]string{"id": testThemeID.String()})
	rec := httptest.NewRecorder()

	h.ListStoryInfos(rec, req)

	if rec.Code != http.StatusNotFound {
		t.Fatalf("expected 404, got %d: %s", rec.Code, rec.Body.String())
	}
}

func TestStoryInfoHandler_Create_AuditsWrite(t *testing.T) {
	capture := auditlog.NewCapturingLogger()
	infoID := uuid.New()
	h, svc := newStoryInfoHandlerMock(t, capture)
	svc.EXPECT().
		Create(gomock.Any(), testCreatorID, testThemeID, gomock.Any()).
		DoAndReturn(func(_ context.Context, creatorID, themeID uuid.UUID, req CreateStoryInfoRequest) (*StoryInfoResponse, error) {
			if creatorID != testCreatorID || themeID != testThemeID || req.Title != "새 정보" {
				t.Fatalf("unexpected create request: creator=%s theme=%s req=%+v", creatorID, themeID, req)
			}
			return &StoryInfoResponse{ID: infoID, ThemeID: themeID, Title: req.Title}, nil
		})
	body, _ := json.Marshal(CreateStoryInfoRequest{Title: "새 정보"})
	req := httptest.NewRequest(http.MethodPost, "/editor/themes/"+testThemeID.String()+"/story-infos", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	req = withAuth(req)
	req = chiContext(req, map[string]string{"id": testThemeID.String()})
	rec := httptest.NewRecorder()

	h.CreateStoryInfo(rec, req)

	if rec.Code != http.StatusCreated {
		t.Fatalf("expected 201, got %d: %s", rec.Code, rec.Body.String())
	}
	assertStoryInfoAudit(t, capture, auditlog.ActionEditorStoryInfoCreate, testThemeID, infoID)
}

func TestStoryInfoHandler_Create_RejectsInvalidJSON(t *testing.T) {
	h, _ := newStoryInfoHandlerMock(t, auditlog.NoOpLogger{})
	req := httptest.NewRequest(http.MethodPost, "/editor/themes/not-a-uuid/story-infos", nil)
	req = withAuth(req)
	req = chiContext(req, map[string]string{"id": "not-a-uuid"})
	rec := httptest.NewRecorder()

	h.CreateStoryInfo(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Fatalf("expected invalid theme 400, got %d: %s", rec.Code, rec.Body.String())
	}

	req = httptest.NewRequest(http.MethodPost, "/editor/themes/"+testThemeID.String()+"/story-infos", bytes.NewReader([]byte("{")))
	req.Header.Set("Content-Type", "application/json")
	req = withAuth(req)
	req = chiContext(req, map[string]string{"id": testThemeID.String()})
	rec = httptest.NewRecorder()

	h.CreateStoryInfo(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d: %s", rec.Code, rec.Body.String())
	}
}

func TestStoryInfoHandler_Create_WritesServiceErrorWithoutAudit(t *testing.T) {
	capture := auditlog.NewCapturingLogger()
	h, svc := newStoryInfoHandlerMock(t, capture)
	svc.EXPECT().
		Create(gomock.Any(), testCreatorID, testThemeID, gomock.Any()).
		Return(nil, apperror.New(apperror.ErrValidation, http.StatusUnprocessableEntity, "story info title is required"))
	body, _ := json.Marshal(CreateStoryInfoRequest{Title: ""})
	req := httptest.NewRequest(http.MethodPost, "/editor/themes/"+testThemeID.String()+"/story-infos", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	req = withAuth(req)
	req = chiContext(req, map[string]string{"id": testThemeID.String()})
	rec := httptest.NewRecorder()

	h.CreateStoryInfo(rec, req)

	if rec.Code != http.StatusUnprocessableEntity {
		t.Fatalf("expected 422, got %d: %s", rec.Code, rec.Body.String())
	}
	if len(capture.Entries()) != 0 {
		t.Fatalf("expected no audit entry, got %+v", capture.Entries())
	}
}

func TestStoryInfoHandler_Update_AuditsWrite(t *testing.T) {
	capture := auditlog.NewCapturingLogger()
	infoID := uuid.New()
	title := "수정 정보"
	h, svc := newStoryInfoHandlerMock(t, capture)
	svc.EXPECT().
		Update(gomock.Any(), testCreatorID, infoID, gomock.Any()).
		DoAndReturn(func(_ context.Context, creatorID, gotInfoID uuid.UUID, req UpdateStoryInfoRequest) (*StoryInfoResponse, error) {
			if creatorID != testCreatorID || gotInfoID != infoID || req.Title == nil || *req.Title != title {
				t.Fatalf("unexpected update request: creator=%s info=%s req=%+v", creatorID, gotInfoID, req)
			}
			return &StoryInfoResponse{ID: infoID, ThemeID: testThemeID, Title: title, Version: req.Version + 1}, nil
		})
	body, _ := json.Marshal(UpdateStoryInfoRequest{Title: &title, Version: 3})
	req := httptest.NewRequest(http.MethodPatch, "/editor/story-infos/"+infoID.String(), bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	req = withAuth(req)
	req = chiContext(req, map[string]string{"id": infoID.String()})
	rec := httptest.NewRecorder()

	h.UpdateStoryInfo(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rec.Code, rec.Body.String())
	}
	assertStoryInfoAudit(t, capture, auditlog.ActionEditorStoryInfoUpdate, testThemeID, infoID)
}

func TestStoryInfoHandler_Update_RejectsInvalidIDAndJSON(t *testing.T) {
	h, _ := newStoryInfoHandlerMock(t, auditlog.NoOpLogger{})
	req := httptest.NewRequest(http.MethodPatch, "/editor/story-infos/not-a-uuid", nil)
	req = withAuth(req)
	req = chiContext(req, map[string]string{"id": "not-a-uuid"})
	rec := httptest.NewRecorder()

	h.UpdateStoryInfo(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Fatalf("expected invalid id 400, got %d: %s", rec.Code, rec.Body.String())
	}

	req = httptest.NewRequest(http.MethodPatch, "/editor/story-infos/"+uuid.New().String(), bytes.NewReader([]byte("{")))
	req.Header.Set("Content-Type", "application/json")
	req = withAuth(req)
	req = chiContext(req, map[string]string{"id": uuid.New().String()})
	rec = httptest.NewRecorder()

	h.UpdateStoryInfo(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Fatalf("expected invalid json 400, got %d: %s", rec.Code, rec.Body.String())
	}
}

func TestStoryInfoHandler_Update_WritesConflictWithoutAudit(t *testing.T) {
	capture := auditlog.NewCapturingLogger()
	infoID := uuid.New()
	h, svc := newStoryInfoHandlerMock(t, capture)
	svc.EXPECT().
		Update(gomock.Any(), testCreatorID, infoID, gomock.Any()).
		Return(nil, apperror.Conflict("version mismatch"))
	body, _ := json.Marshal(UpdateStoryInfoRequest{Version: 1})
	req := httptest.NewRequest(http.MethodPatch, "/editor/story-infos/"+infoID.String(), bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	req = withAuth(req)
	req = chiContext(req, map[string]string{"id": infoID.String()})
	rec := httptest.NewRecorder()

	h.UpdateStoryInfo(rec, req)

	if rec.Code != http.StatusConflict {
		t.Fatalf("expected 409, got %d: %s", rec.Code, rec.Body.String())
	}
	if len(capture.Entries()) != 0 {
		t.Fatalf("expected no audit entry, got %+v", capture.Entries())
	}
}

func TestStoryInfoHandler_Delete_AuditsThemeAndInfo(t *testing.T) {
	capture := auditlog.NewCapturingLogger()
	infoID := uuid.New()
	h, svc := newStoryInfoHandlerMock(t, capture)
	svc.EXPECT().
		Delete(gomock.Any(), testCreatorID, infoID).
		DoAndReturn(func(_ context.Context, creatorID, gotInfoID uuid.UUID) (uuid.UUID, error) {
			if creatorID != testCreatorID || gotInfoID != infoID {
				t.Fatalf("unexpected delete request: creator=%s info=%s", creatorID, gotInfoID)
			}
			return testThemeID, nil
		})
	req := httptest.NewRequest(http.MethodDelete, "/editor/story-infos/"+infoID.String(), nil)
	req = withAuth(req)
	req = chiContext(req, map[string]string{"id": infoID.String()})
	rec := httptest.NewRecorder()

	h.DeleteStoryInfo(rec, req)

	if rec.Code != http.StatusNoContent {
		t.Fatalf("expected 204, got %d: %s", rec.Code, rec.Body.String())
	}
	assertStoryInfoAudit(t, capture, auditlog.ActionEditorStoryInfoDelete, testThemeID, infoID)
}

func TestStoryInfoHandler_Delete_RejectsInvalidIDAndWritesServiceError(t *testing.T) {
	h, _ := newStoryInfoHandlerMock(t, auditlog.NoOpLogger{})
	req := httptest.NewRequest(http.MethodDelete, "/editor/story-infos/not-a-uuid", nil)
	req = withAuth(req)
	req = chiContext(req, map[string]string{"id": "not-a-uuid"})
	rec := httptest.NewRecorder()

	h.DeleteStoryInfo(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Fatalf("expected invalid id 400, got %d: %s", rec.Code, rec.Body.String())
	}

	infoID := uuid.New()
	h, svc := newStoryInfoHandlerMock(t, auditlog.NoOpLogger{})
	svc.EXPECT().
		Delete(gomock.Any(), testCreatorID, infoID).
		Return(uuid.Nil, apperror.NotFound("story info not found"))
	req = httptest.NewRequest(http.MethodDelete, "/editor/story-infos/"+infoID.String(), nil)
	req = withAuth(req)
	req = chiContext(req, map[string]string{"id": infoID.String()})
	rec = httptest.NewRecorder()

	h.DeleteStoryInfo(rec, req)

	if rec.Code != http.StatusNotFound {
		t.Fatalf("expected service error 404, got %d: %s", rec.Code, rec.Body.String())
	}
}

func TestStoryInfoHandler_RecordAudit_IgnoresNilActorMarshalAndAppendFailures(t *testing.T) {
	capture := auditlog.NewCapturingLogger()
	h, _ := newStoryInfoHandlerMock(t, capture)
	h.recordAudit(context.Background(), auditlog.ActionEditorStoryInfoCreate, uuid.Nil, map[string]any{"story_info_id": uuid.New().String()})
	if len(capture.Entries()) != 0 {
		t.Fatalf("expected nil actor to skip audit, got %+v", capture.Entries())
	}

	h.recordAudit(context.Background(), auditlog.ActionEditorStoryInfoCreate, testCreatorID, map[string]any{"bad": func() {}})
	if len(capture.Entries()) != 0 {
		t.Fatalf("expected marshal failure to skip audit, got %+v", capture.Entries())
	}

	h, _ = newStoryInfoHandlerMock(t, failingStoryInfoAuditLogger{})
	h.recordAudit(context.Background(), auditlog.ActionEditorStoryInfoCreate, testCreatorID, map[string]any{"story_info_id": uuid.New().String()})

	h, _ = newStoryInfoHandlerMock(t, nil)
	h.recordAudit(context.Background(), auditlog.ActionEditorStoryInfoCreate, testCreatorID, nil)
}

func assertStoryInfoAudit(t *testing.T, capture *auditlog.CapturingLogger, want auditlog.AuditAction, themeID, infoID uuid.UUID) {
	t.Helper()
	entries := capture.Entries()
	if len(entries) != 1 {
		t.Fatalf("expected 1 audit entry, got %d", len(entries))
	}
	entry := entries[0]
	if entry.Action != want {
		t.Fatalf("action: want %q, got %q", want, entry.Action)
	}
	if entry.ActorID == nil || *entry.ActorID != testCreatorID {
		t.Fatalf("ActorID: want %s, got %v", testCreatorID, entry.ActorID)
	}
	var payload map[string]string
	if err := json.Unmarshal(entry.Payload, &payload); err != nil {
		t.Fatalf("payload decode: %v", err)
	}
	if payload["theme_id"] != themeID.String() || payload["story_info_id"] != infoID.String() {
		t.Fatalf("unexpected payload: %+v", payload)
	}
}
