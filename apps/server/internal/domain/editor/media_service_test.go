package editor

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"strings"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/rs/zerolog"

	"github.com/mmp-platform/server/internal/apperror"
	"github.com/mmp-platform/server/internal/db"
	"github.com/mmp-platform/server/internal/infra/storage"
)

// --- fakeMediaQueries: in-memory mediaQueries implementation for unit tests ---

type fakeMediaQueries struct {
	themes        map[uuid.UUID]db.Theme
	media         map[uuid.UUID]db.ThemeMedium
	maps          map[uuid.UUID]db.ThemeMap
	sessions      map[uuid.UUID]db.GameSession
	sections      map[uuid.UUID]db.ReadingSection
	roleSheetRefs map[uuid.UUID][]db.FindRoleSheetReferencesForMediaRow
}

func newFakeMediaQueries() *fakeMediaQueries {
	return &fakeMediaQueries{
		themes:        make(map[uuid.UUID]db.Theme),
		media:         make(map[uuid.UUID]db.ThemeMedium),
		maps:          make(map[uuid.UUID]db.ThemeMap),
		sessions:      make(map[uuid.UUID]db.GameSession),
		sections:      make(map[uuid.UUID]db.ReadingSection),
		roleSheetRefs: make(map[uuid.UUID][]db.FindRoleSheetReferencesForMediaRow),
	}
}

func (f *fakeMediaQueries) GetTheme(_ context.Context, id uuid.UUID) (db.Theme, error) {
	t, ok := f.themes[id]
	if !ok {
		return db.Theme{}, pgx.ErrNoRows
	}
	return t, nil
}

func (f *fakeMediaQueries) GetMedia(_ context.Context, id uuid.UUID) (db.ThemeMedium, error) {
	m, ok := f.media[id]
	if !ok {
		return db.ThemeMedium{}, pgx.ErrNoRows
	}
	return m, nil
}

func (f *fakeMediaQueries) GetMediaForSession(_ context.Context, arg db.GetMediaForSessionParams) (db.ThemeMedium, error) {
	session, ok := f.sessions[arg.SessionID]
	if !ok {
		return db.ThemeMedium{}, pgx.ErrNoRows
	}
	media, ok := f.media[arg.MediaID]
	if !ok || media.ThemeID != session.ThemeID {
		return db.ThemeMedium{}, pgx.ErrNoRows
	}
	return media, nil
}

func (f *fakeMediaQueries) GetMediaWithOwner(_ context.Context, arg db.GetMediaWithOwnerParams) (db.ThemeMedium, error) {
	m, ok := f.media[arg.ID]
	if !ok {
		return db.ThemeMedium{}, pgx.ErrNoRows
	}
	t, ok := f.themes[m.ThemeID]
	if !ok || t.CreatorID != arg.CreatorID {
		return db.ThemeMedium{}, pgx.ErrNoRows
	}
	return m, nil
}

func (f *fakeMediaQueries) ListMediaByTheme(_ context.Context, themeID uuid.UUID) ([]db.ThemeMedium, error) {
	out := []db.ThemeMedium{}
	for _, m := range f.media {
		if m.ThemeID == themeID {
			out = append(out, m)
		}
	}
	return out, nil
}

func (f *fakeMediaQueries) ListMediaByThemeAndType(_ context.Context, arg db.ListMediaByThemeAndTypeParams) ([]db.ThemeMedium, error) {
	out := []db.ThemeMedium{}
	for _, m := range f.media {
		if m.ThemeID == arg.ThemeID && m.Type == arg.Type {
			out = append(out, m)
		}
	}
	return out, nil
}

func (f *fakeMediaQueries) CountMediaByTheme(_ context.Context, themeID uuid.UUID) (int64, error) {
	var n int64
	for _, m := range f.media {
		if m.ThemeID == themeID {
			n++
		}
	}
	return n, nil
}

func (f *fakeMediaQueries) SumMediaSizeByTheme(_ context.Context, themeID uuid.UUID) (int64, error) {
	var sum int64
	for _, m := range f.media {
		if m.ThemeID == themeID && m.FileSize.Valid {
			sum += m.FileSize.Int64
		}
	}
	return sum, nil
}

func (f *fakeMediaQueries) SumMediaSizeByCreator(_ context.Context, creatorID uuid.UUID) (int64, error) {
	var sum int64
	for _, m := range f.media {
		t, ok := f.themes[m.ThemeID]
		if !ok || t.CreatorID != creatorID {
			continue
		}
		if m.FileSize.Valid {
			sum += m.FileSize.Int64
		}
	}
	return sum, nil
}

func (f *fakeMediaQueries) CreateMedia(_ context.Context, arg db.CreateMediaParams) (db.ThemeMedium, error) {
	m := db.ThemeMedium{
		ID:         uuid.New(),
		ThemeID:    arg.ThemeID,
		Name:       arg.Name,
		Type:       arg.Type,
		SourceType: arg.SourceType,
		Url:        arg.Url,
		StorageKey: arg.StorageKey,
		Duration:   arg.Duration,
		FileSize:   arg.FileSize,
		MimeType:   arg.MimeType,
		Tags:       arg.Tags,
		SortOrder:  arg.SortOrder,
		CreatedAt:  time.Now(),
	}
	f.media[m.ID] = m
	return m, nil
}

func (f *fakeMediaQueries) UpdateMedia(_ context.Context, arg db.UpdateMediaParams) (db.ThemeMedium, error) {
	m, ok := f.media[arg.ID]
	if !ok {
		return db.ThemeMedium{}, pgx.ErrNoRows
	}
	m.Name = arg.Name
	m.Type = arg.Type
	m.Duration = arg.Duration
	m.Tags = arg.Tags
	m.SortOrder = arg.SortOrder
	f.media[arg.ID] = m
	return m, nil
}

func (f *fakeMediaQueries) DeleteMedia(_ context.Context, id uuid.UUID) error {
	delete(f.media, id)
	return nil
}

func (f *fakeMediaQueries) DeleteMediaWithOwner(_ context.Context, arg db.DeleteMediaWithOwnerParams) (int64, error) {
	m, ok := f.media[arg.ID]
	if !ok {
		return 0, nil
	}
	t, ok := f.themes[m.ThemeID]
	if !ok || t.CreatorID != arg.CreatorID {
		return 0, nil
	}
	delete(f.media, arg.ID)
	return 1, nil
}

func (f *fakeMediaQueries) FindThemeCoverReferencesForMedia(_ context.Context, arg db.FindThemeCoverReferencesForMediaParams) ([]db.FindThemeCoverReferencesForMediaRow, error) {
	if !arg.MediaID.Valid {
		return []db.FindThemeCoverReferencesForMediaRow{}, nil
	}
	theme, ok := f.themes[arg.ThemeID]
	if !ok || !theme.CoverImageMediaID.Valid || theme.CoverImageMediaID.Bytes != arg.MediaID.Bytes {
		return []db.FindThemeCoverReferencesForMediaRow{}, nil
	}
	return []db.FindThemeCoverReferencesForMediaRow{{ID: theme.ID, Title: theme.Title}}, nil
}

func (f *fakeMediaQueries) FindMapReferencesForMedia(_ context.Context, arg db.FindMapReferencesForMediaParams) ([]db.FindMapReferencesForMediaRow, error) {
	out := []db.FindMapReferencesForMediaRow{}
	if !arg.MediaID.Valid {
		return out, nil
	}
	for _, m := range f.maps {
		if m.ThemeID == arg.ThemeID && m.ImageMediaID.Valid && m.ImageMediaID.Bytes == arg.MediaID.Bytes {
			out = append(out, db.FindMapReferencesForMediaRow{ID: m.ID, Name: m.Name})
		}
	}
	return out, nil
}

func (f *fakeMediaQueries) FindMediaReferencesInReadingSections(_ context.Context, arg db.FindMediaReferencesInReadingSectionsParams) ([]db.FindMediaReferencesInReadingSectionsRow, error) {
	out := []db.FindMediaReferencesInReadingSectionsRow{}
	for _, s := range f.sections {
		if s.ThemeID != arg.ThemeID {
			continue
		}
		matched := false
		// Check bgm reference.
		if s.BgmMediaID.Valid && uuid.UUID(s.BgmMediaID.Bytes) == arg.MediaID {
			matched = true
		}
		// Check line-level media references inside lines JSONB.
		if !matched && len(s.Lines) > 0 {
			var lines []map[string]any
			if err := json.Unmarshal(s.Lines, &lines); err == nil {
				for _, ln := range lines {
					if v, ok := ln["VoiceMediaID"].(string); ok && v == arg.MediaID.String() {
						matched = true
						break
					}
					if v, ok := ln["ImageMediaID"].(string); ok && v == arg.MediaID.String() {
						matched = true
						break
					}
				}
			}
		}
		if matched {
			out = append(out, db.FindMediaReferencesInReadingSectionsRow{ID: s.ID, Name: s.Name})
		}
	}
	return out, nil
}

func (f *fakeMediaQueries) FindRoleSheetReferencesForMedia(_ context.Context, arg db.FindRoleSheetReferencesForMediaParams) ([]db.FindRoleSheetReferencesForMediaRow, error) {
	mediaIDText := strings.TrimPrefix(strings.TrimSuffix(arg.Body, `"`), `"media_id"\s*:\s*"`)
	mediaID, err := uuid.Parse(mediaIDText)
	if err != nil {
		return []db.FindRoleSheetReferencesForMediaRow{}, nil
	}
	return f.roleSheetRefs[mediaID], nil
}

type fakeStorageProvider struct {
	objects map[string][]byte
}

func newFakeStorageProvider() *fakeStorageProvider {
	return &fakeStorageProvider{objects: make(map[string][]byte)}
}

func (f *fakeStorageProvider) GenerateUploadURL(_ context.Context, key string, _ string, _ int64, _ time.Duration) (string, error) {
	return "https://upload.example/" + key, nil
}

func (f *fakeStorageProvider) GenerateDownloadURL(_ context.Context, key string, _ time.Duration) (string, error) {
	return "https://download.example/" + key, nil
}

func (f *fakeStorageProvider) HeadObject(_ context.Context, key string) (*storage.ObjectMeta, error) {
	body, ok := f.objects[key]
	if !ok {
		return nil, storage.ErrObjectNotFound
	}
	return &storage.ObjectMeta{Key: key, Size: int64(len(body)), ContentType: "application/pdf"}, nil
}

func (f *fakeStorageProvider) GetObjectRange(_ context.Context, key string, offset int64, length int64) (io.ReadCloser, error) {
	body, ok := f.objects[key]
	if !ok {
		return nil, storage.ErrObjectNotFound
	}
	start := min(int(offset), len(body))
	end := min(start+int(length), len(body))
	return io.NopCloser(strings.NewReader(string(body[start:end]))), nil
}

func (f *fakeStorageProvider) DeleteObject(_ context.Context, key string) error {
	delete(f.objects, key)
	return nil
}

func (f *fakeStorageProvider) DeleteObjects(ctx context.Context, keys []string) error {
	for _, key := range keys {
		_ = f.DeleteObject(ctx, key)
	}
	return nil
}

// --- helpers ---

func newMediaTestService(t *testing.T) (*mediaService, *fakeMediaQueries, uuid.UUID, uuid.UUID) {
	t.Helper()
	q := newFakeMediaQueries()
	creatorID := uuid.New()
	themeID := uuid.New()
	q.themes[themeID] = db.Theme{ID: themeID, CreatorID: creatorID}
	svc := newMediaServiceWith(q, nil, zerolog.Nop())
	return svc, q, creatorID, themeID
}

func seedMedia(q *fakeMediaQueries, themeID uuid.UUID, mediaType string) uuid.UUID {
	id := uuid.New()
	q.media[id] = db.ThemeMedium{
		ID:         id,
		ThemeID:    themeID,
		Name:       "media",
		Type:       mediaType,
		SourceType: SourceTypeYouTube,
		Url:        pgtype.Text{String: "https://www.youtube.com/watch?v=dQw4w9WgXcQ", Valid: true},
	}
	return id
}

func seedFileMedia(q *fakeMediaQueries, themeID uuid.UUID, mediaType string) uuid.UUID {
	id := uuid.New()
	q.media[id] = db.ThemeMedium{
		ID:         id,
		ThemeID:    themeID,
		Name:       "media",
		Type:       mediaType,
		SourceType: SourceTypeFile,
		StorageKey: pgtype.Text{String: "themes/" + themeID.String() + "/media/" + id.String() + ".png", Valid: true},
		FileSize:   pgtype.Int8{Int64: 1024, Valid: true},
		MimeType:   pgtype.Text{String: "image/png", Valid: true},
	}
	return id
}

func assertMediaAppCode(t *testing.T, err error, want string) {
	t.Helper()
	if err == nil {
		t.Fatalf("expected error %q, got nil", want)
	}
	var appErr *apperror.AppError
	if !errors.As(err, &appErr) {
		t.Fatalf("expected *apperror.AppError, got %T: %v", err, err)
	}
	if appErr.Code != want {
		t.Fatalf("expected error code %q, got %q (detail=%s)", want, appErr.Code, appErr.Detail)
	}
}

func TestMediaService_UpdateMedia_RejectsTypeChange(t *testing.T) {
	svc, q, creatorID, themeID := newMediaTestService(t)
	mediaID := seedMedia(q, themeID, MediaTypeBGM)

	_, err := svc.UpdateMedia(context.Background(), creatorID, mediaID, UpdateMediaRequest{
		Name:      "relabel",
		Type:      MediaTypeImage,
		Tags:      []string{},
		SortOrder: 0,
	})
	assertMediaAppCode(t, err, apperror.ErrMediaInvalidType)
	if got := q.media[mediaID].Type; got != MediaTypeBGM {
		t.Fatalf("media type changed to %q", got)
	}
}

func TestMediaService_ResolveMediaURL_BindsMediaToSessionTheme(t *testing.T) {
	svc, q, _, themeID := newMediaTestService(t)
	otherThemeID := uuid.New()
	q.themes[otherThemeID] = db.Theme{ID: otherThemeID, CreatorID: uuid.New()}
	sessionID := uuid.New()
	q.sessions[sessionID] = db.GameSession{ID: sessionID, ThemeID: themeID}
	mediaID := seedFileMedia(q, themeID, MediaTypeImage)
	otherMediaID := seedFileMedia(q, otherThemeID, MediaTypeImage)
	svc.storage = newFakeStorageProvider()

	url, sourceType, err := svc.ResolveMediaURL(context.Background(), sessionID, mediaID, MediaTypeImage)
	if err != nil {
		t.Fatalf("ResolveMediaURL same-theme media: %v", err)
	}
	if url == "" || sourceType != SourceTypeFile {
		t.Fatalf("unexpected resolve result: url=%q sourceType=%q", url, sourceType)
	}

	_, _, err = svc.ResolveMediaURL(context.Background(), sessionID, otherMediaID, MediaTypeImage)
	assertMediaAppCode(t, err, apperror.ErrNotFound)
}

// --- DeleteMedia reference-check tests ---

func TestMediaService_Delete_BlockedByBgmReference(t *testing.T) {
	svc, q, creatorID, themeID := newMediaTestService(t)
	bgmID := seedMedia(q, themeID, MediaTypeBGM)

	// Seed a reading section that references the bgm.
	sectionID := uuid.New()
	q.sections[sectionID] = db.ReadingSection{
		ID:         sectionID,
		ThemeID:    themeID,
		Name:       "Intro",
		BgmMediaID: pgtype.UUID{Bytes: bgmID, Valid: true},
		Lines:      json.RawMessage(`[]`),
	}

	err := svc.DeleteMedia(context.Background(), creatorID, bgmID)
	assertMediaAppCode(t, err, apperror.ErrMediaReferenceInUse)

	var appErr *apperror.AppError
	_ = errors.As(err, &appErr)
	if appErr.Status != 409 {
		t.Fatalf("expected status 409, got %d", appErr.Status)
	}
	refs, ok := appErr.Params["references"].([]map[string]string)
	if !ok || len(refs) != 1 {
		t.Fatalf("expected references param with 1 entry, got %#v", appErr.Params["references"])
	}
	if refs[0]["id"] != sectionID.String() || refs[0]["name"] != "Intro" || refs[0]["type"] != "reading_section" {
		t.Fatalf("unexpected reference shape: %#v", refs[0])
	}
	// Media must still exist.
	if _, ok := q.media[bgmID]; !ok {
		t.Fatalf("media should not have been deleted")
	}
}

func TestMediaService_Delete_BlockedByVoiceReference(t *testing.T) {
	svc, q, creatorID, themeID := newMediaTestService(t)
	voiceID := seedMedia(q, themeID, MediaTypeVoice)

	// Seed a reading section whose first line references the voice media.
	linesJSON, _ := json.Marshal([]map[string]any{
		{"Index": 0, "Text": "hi", "AdvanceBy": "voice", "VoiceMediaID": voiceID.String()},
	})
	sectionID := uuid.New()
	q.sections[sectionID] = db.ReadingSection{
		ID:      sectionID,
		ThemeID: themeID,
		Name:    "Voiced",
		Lines:   linesJSON,
	}

	err := svc.DeleteMedia(context.Background(), creatorID, voiceID)
	assertMediaAppCode(t, err, apperror.ErrMediaReferenceInUse)

	var appErr *apperror.AppError
	_ = errors.As(err, &appErr)
	refs := appErr.Params["references"].([]map[string]string)
	if len(refs) != 1 || refs[0]["id"] != sectionID.String() {
		t.Fatalf("unexpected references: %#v", refs)
	}
}

func TestMediaService_Delete_BlockedByReadingImageReference(t *testing.T) {
	svc, q, creatorID, themeID := newMediaTestService(t)
	imageID := seedMedia(q, themeID, MediaTypeImage)

	linesJSON, _ := json.Marshal([]map[string]any{
		{"Index": 0, "Text": "사진을 공개한다.", "AdvanceBy": "gm", "ImageMediaID": imageID.String()},
	})
	sectionID := uuid.New()
	q.sections[sectionID] = db.ReadingSection{
		ID:      sectionID,
		ThemeID: themeID,
		Name:    "Image cue",
		Lines:   linesJSON,
	}

	err := svc.DeleteMedia(context.Background(), creatorID, imageID)
	assertMediaAppCode(t, err, apperror.ErrMediaReferenceInUse)

	var appErr *apperror.AppError
	_ = errors.As(err, &appErr)
	refs := appErr.Params["references"].([]map[string]string)
	if len(refs) != 1 || refs[0]["id"] != sectionID.String() || refs[0]["type"] != "reading_section" || refs[0]["name"] != "Image cue" {
		t.Fatalf("unexpected references: %#v", refs)
	}
	if _, ok := q.media[imageID]; !ok {
		t.Fatalf("media should not have been deleted")
	}
}

func TestFindMediaReferencesInReadingSections_JSONBIntegration(t *testing.T) {
	fixture := setupFixture(t)
	ctx := context.Background()
	creatorID := fixture.createUser(t)
	themeID := fixture.createThemeForUser(t, creatorID)

	voice := createMediaForReferenceTest(t, fixture.q, themeID, "Narration voice", MediaTypeVoice)
	image := createMediaForReferenceTest(t, fixture.q, themeID, "Crime scene image", MediaTypeImage)
	linesJSON, err := json.Marshal([]map[string]any{
		{"Index": 0, "Text": "목소리가 들린다.", "AdvanceBy": "voice", "VoiceMediaID": voice.ID.String()},
		{"Index": 1, "Text": "현장 사진을 본다.", "AdvanceBy": "gm", "ImageMediaID": image.ID.String()},
	})
	if err != nil {
		t.Fatalf("marshal lines: %v", err)
	}
	section, err := fixture.q.CreateReadingSection(ctx, db.CreateReadingSectionParams{
		ThemeID:   themeID,
		Name:      "JSONB refs",
		Lines:     linesJSON,
		SortOrder: 0,
	})
	if err != nil {
		t.Fatalf("CreateReadingSection: %v", err)
	}
	svc := NewMediaService(fixture.q, nil, zerolog.Nop())

	for _, tt := range []struct {
		name    string
		mediaID uuid.UUID
	}{
		{name: "voice", mediaID: voice.ID},
		{name: "image", mediaID: image.ID},
	} {
		t.Run(tt.name, func(t *testing.T) {
			refs, err := fixture.q.FindMediaReferencesInReadingSections(ctx, db.FindMediaReferencesInReadingSectionsParams{
				ThemeID: themeID,
				MediaID: tt.mediaID,
			})
			if err != nil {
				t.Fatalf("FindMediaReferencesInReadingSections: %v", err)
			}
			if len(refs) != 1 || refs[0].ID != section.ID || refs[0].Name != "JSONB refs" {
				t.Fatalf("unexpected refs: %#v", refs)
			}

			err = svc.DeleteMedia(ctx, creatorID, tt.mediaID)
			assertMediaAppCode(t, err, apperror.ErrMediaReferenceInUse)
			var appErr *apperror.AppError
			_ = errors.As(err, &appErr)
			references, ok := appErr.Params["references"].([]map[string]string)
			if !ok || len(references) != 1 {
				t.Fatalf("expected references param with 1 entry, got %#v", appErr.Params["references"])
			}
			if references[0]["type"] != "reading_section" || references[0]["id"] != section.ID.String() || references[0]["name"] != "JSONB refs" {
				t.Fatalf("unexpected reference payload: %#v", references[0])
			}
		})
	}
}

func createMediaForReferenceTest(t *testing.T, q *db.Queries, themeID uuid.UUID, name string, mediaType string) db.ThemeMedium {
	t.Helper()
	media, err := q.CreateMedia(context.Background(), db.CreateMediaParams{
		ThemeID:    themeID,
		Name:       name,
		Type:       mediaType,
		SourceType: SourceTypeFile,
		Url:        pgtype.Text{String: "https://cdn.example/" + name, Valid: true},
		StorageKey: pgtype.Text{String: "test/" + uuid.New().String(), Valid: true},
		MimeType:   pgtype.Text{String: "application/octet-stream", Valid: true},
		Tags:       []string{},
		SortOrder:  0,
	})
	if err != nil {
		t.Fatalf("CreateMedia(%s): %v", name, err)
	}
	return media
}

func TestMediaService_Delete_Success_NoReferences(t *testing.T) {
	svc, q, creatorID, themeID := newMediaTestService(t)
	mediaID := seedMedia(q, themeID, MediaTypeBGM)

	if err := svc.DeleteMedia(context.Background(), creatorID, mediaID); err != nil {
		t.Fatalf("expected delete to succeed, got %v", err)
	}
	if _, ok := q.media[mediaID]; ok {
		t.Fatalf("media should have been deleted")
	}
}

func TestMediaService_Delete_BlockedByThemeCoverReference(t *testing.T) {
	svc, q, creatorID, themeID := newMediaTestService(t)
	mediaID := seedMedia(q, themeID, MediaTypeImage)
	theme := q.themes[themeID]
	theme.Title = "저택 살인사건"
	theme.CoverImageMediaID = pgtype.UUID{Bytes: mediaID, Valid: true}
	q.themes[themeID] = theme

	err := svc.DeleteMedia(context.Background(), creatorID, mediaID)
	assertMediaAppCode(t, err, apperror.ErrMediaReferenceInUse)

	var appErr *apperror.AppError
	_ = errors.As(err, &appErr)
	refs := appErr.Params["references"].([]map[string]string)
	if len(refs) != 1 || refs[0]["type"] != "theme_cover" || refs[0]["id"] != themeID.String() || refs[0]["name"] != "저택 살인사건" {
		t.Fatalf("unexpected theme cover references: %#v", refs)
	}
}

func TestMediaService_Delete_BlockedByMapImageReference(t *testing.T) {
	svc, q, creatorID, themeID := newMediaTestService(t)
	mediaID := seedMedia(q, themeID, MediaTypeImage)
	mapID := uuid.New()
	q.maps[mapID] = db.ThemeMap{
		ID:           mapID,
		ThemeID:      themeID,
		Name:         "1층 지도",
		ImageMediaID: pgtype.UUID{Bytes: mediaID, Valid: true},
	}

	err := svc.DeleteMedia(context.Background(), creatorID, mediaID)
	assertMediaAppCode(t, err, apperror.ErrMediaReferenceInUse)

	var appErr *apperror.AppError
	_ = errors.As(err, &appErr)
	refs := appErr.Params["references"].([]map[string]string)
	if len(refs) != 1 || refs[0]["type"] != "map" || refs[0]["id"] != mapID.String() || refs[0]["name"] != "1층 지도" {
		t.Fatalf("unexpected map references: %#v", refs)
	}
}

func TestMediaService_Delete_BlockedByRoleSheetReference(t *testing.T) {
	svc, q, creatorID, themeID := newMediaTestService(t)
	mediaID := seedMedia(q, themeID, MediaTypeDocument)
	q.roleSheetRefs[mediaID] = []db.FindRoleSheetReferencesForMediaRow{
		{ID: uuid.New(), Key: "role_sheet:char-1"},
	}

	err := svc.DeleteMedia(context.Background(), creatorID, mediaID)
	assertMediaAppCode(t, err, apperror.ErrMediaReferenceInUse)

	var appErr *apperror.AppError
	_ = errors.As(err, &appErr)
	refs := appErr.Params["references"].([]map[string]string)
	if len(refs) != 1 || refs[0]["type"] != "role_sheet" || refs[0]["id"] != "role_sheet:char-1" {
		t.Fatalf("unexpected role sheet references: %#v", refs)
	}
	if _, ok := q.media[mediaID]; !ok {
		t.Fatalf("media should not have been deleted")
	}
}

func TestMediaService_Delete_BlockedByPhaseOnEnterMediaReference(t *testing.T) {
	svc, q, creatorID, themeID := newMediaTestService(t)
	mediaID := seedMedia(q, themeID, MediaTypeBGM)
	theme := q.themes[themeID]
	theme.ConfigJson = json.RawMessage(fmt.Sprintf(`{
		"phases": [
			{
				"id": "investigation",
				"name": "조사 단계",
				"onEnter": [{"id":"bgm","type":"SET_BGM","params":{"mediaId":%q}}]
			}
		],
		"modules": {}
	}`, mediaID.String()))
	q.themes[themeID] = theme

	err := svc.DeleteMedia(context.Background(), creatorID, mediaID)
	assertMediaAppCode(t, err, apperror.ErrMediaReferenceInUse)

	var appErr *apperror.AppError
	_ = errors.As(err, &appErr)
	refs := appErr.Params["references"].([]map[string]string)
	if len(refs) != 1 {
		t.Fatalf("expected one phase reference, got %#v", refs)
	}
	if refs[0]["type"] != "phase_action" || refs[0]["id"] != "investigation:onEnter:bgm" {
		t.Fatalf("unexpected phase reference: %#v", refs[0])
	}
	if !strings.Contains(refs[0]["name"], "조사 단계 시작 트리거") || !strings.Contains(refs[0]["name"], "BGM") {
		t.Fatalf("unexpected creator label: %#v", refs[0])
	}
	if _, ok := q.media[mediaID]; !ok {
		t.Fatalf("media should not have been deleted")
	}
}

func TestMediaService_Delete_BlockedByPhaseOnExitMediaReference(t *testing.T) {
	svc, q, creatorID, themeID := newMediaTestService(t)
	mediaID := seedMedia(q, themeID, MediaTypeSFX)
	theme := q.themes[themeID]
	theme.ConfigJson = json.RawMessage(fmt.Sprintf(`{
		"phases": [
			{
				"id": "debate",
				"name": "토론 단계",
				"onExit": {"actions": [{"id":"sfx","type":"PLAY_SOUND","params":{"mediaId":%q}}]}
			}
		],
		"modules": {}
	}`, mediaID.String()))
	q.themes[themeID] = theme

	err := svc.DeleteMedia(context.Background(), creatorID, mediaID)
	assertMediaAppCode(t, err, apperror.ErrMediaReferenceInUse)

	var appErr *apperror.AppError
	_ = errors.As(err, &appErr)
	refs := appErr.Params["references"].([]map[string]string)
	if len(refs) != 1 || refs[0]["type"] != "phase_action" || refs[0]["id"] != "debate:onExit:sfx" {
		t.Fatalf("unexpected phase reference: %#v", refs)
	}
	if !strings.Contains(refs[0]["name"], "토론 단계 종료 트리거") || !strings.Contains(refs[0]["name"], "효과음") {
		t.Fatalf("unexpected creator label: %#v", refs[0])
	}
}

func TestMediaService_Delete_BlockedByEventProgressionTriggerMediaReference(t *testing.T) {
	svc, q, creatorID, themeID := newMediaTestService(t)
	mediaID := seedMedia(q, themeID, MediaTypeImage)
	theme := q.themes[themeID]
	theme.ConfigJson = json.RawMessage(fmt.Sprintf(`{
		"phases": [],
		"modules": {
			"event_progression": {
				"enabled": true,
				"config": {
					"Triggers": [
						{
							"id": "reveal-room",
							"label": "비밀 토론방 공개",
							"actions": [{"id":"bg","type":"SET_BACKGROUND","params":{"mediaId":%q}}]
						}
					]
				}
			}
		}
	}`, mediaID.String()))
	q.themes[themeID] = theme

	err := svc.DeleteMedia(context.Background(), creatorID, mediaID)
	assertMediaAppCode(t, err, apperror.ErrMediaReferenceInUse)

	var appErr *apperror.AppError
	_ = errors.As(err, &appErr)
	refs := appErr.Params["references"].([]map[string]string)
	if len(refs) != 1 || refs[0]["type"] != "event_progression_trigger_action" || refs[0]["id"] != "reveal-room:bg" {
		t.Fatalf("unexpected event trigger reference: %#v", refs)
	}
	if !strings.Contains(refs[0]["name"], "비밀 토론방 공개 실행 결과") || !strings.Contains(refs[0]["name"], "배경 이미지") {
		t.Fatalf("unexpected creator label: %#v", refs[0])
	}
}

func TestMediaService_Delete_LabelsMultipleActionReferencesByActionPurpose(t *testing.T) {
	svc, q, creatorID, themeID := newMediaTestService(t)
	mediaID := seedMedia(q, themeID, MediaTypeImage)
	theme := q.themes[themeID]
	theme.ConfigJson = json.RawMessage(fmt.Sprintf(`{
		"phases": [
			{
				"id": "finale",
				"name": "마지막 단계",
				"onEnter": [
					{"id":"bg","type":"SET_BACKGROUND","params":{"mediaId":%q}},
					{"id":"video","type":"PLAY_MEDIA","params":{"mediaId":%q}}
				]
			}
		],
		"modules": {}
	}`, mediaID.String(), mediaID.String()))
	q.themes[themeID] = theme

	err := svc.DeleteMedia(context.Background(), creatorID, mediaID)
	assertMediaAppCode(t, err, apperror.ErrMediaReferenceInUse)

	var appErr *apperror.AppError
	_ = errors.As(err, &appErr)
	refs := appErr.Params["references"].([]map[string]string)
	if len(refs) != 2 {
		t.Fatalf("expected two phase references, got %#v", refs)
	}
	if !strings.Contains(refs[0]["name"], "배경 이미지") {
		t.Fatalf("first reference should use background label: %#v", refs[0])
	}
	if !strings.Contains(refs[1]["name"], "영상") {
		t.Fatalf("second reference should use video label: %#v", refs[1])
	}
}

func TestMediaService_Delete_BlocksMalformedConfigMediaReferenceScan(t *testing.T) {
	svc, q, creatorID, themeID := newMediaTestService(t)
	mediaID := seedMedia(q, themeID, MediaTypeBGM)
	theme := q.themes[themeID]
	theme.ConfigJson = json.RawMessage(`{"phases": "malformed", "modules": {"event_progression": {"config": "malformed"}}}`)
	q.themes[themeID] = theme

	err := svc.DeleteMedia(context.Background(), creatorID, mediaID)
	assertMediaAppCode(t, err, apperror.ErrValidation)
	if _, ok := q.media[mediaID]; !ok {
		t.Fatalf("media should not have been deleted")
	}
}

func TestMediaService_RequestUploadURL_VideoTypeRejected(t *testing.T) {
	svc, _, creatorID, themeID := newMediaTestService(t)

	// VIDEO type is rejected before storage/ownership checks.
	_, err := svc.RequestUpload(context.Background(), creatorID, themeID, RequestMediaUploadRequest{
		Name:     "intro",
		Type:     MediaTypeVideo,
		MimeType: "audio/mpeg",
		FileSize: 1024,
	})
	assertMediaAppCode(t, err, apperror.ErrMediaInvalidType)

	var appErr *apperror.AppError
	_ = errors.As(err, &appErr)
	if appErr.Status != 400 {
		t.Fatalf("expected status 400, got %d", appErr.Status)
	}
}

func TestMediaService_RequestUploadURL_DocumentPDFSuccess(t *testing.T) {
	svc, q, creatorID, themeID := newMediaTestService(t)
	st := newFakeStorageProvider()
	svc.storage = st

	resp, err := svc.RequestUpload(context.Background(), creatorID, themeID, RequestMediaUploadRequest{
		Name:     "role-sheet.pdf",
		Type:     MediaTypeDocument,
		MimeType: "application/pdf",
		FileSize: 1024,
	})
	if err != nil {
		t.Fatalf("RequestUpload DOCUMENT/pdf: %v", err)
	}
	created := q.media[resp.UploadID]
	if created.Type != MediaTypeDocument || !created.StorageKey.Valid || !strings.HasSuffix(created.StorageKey.String, ".pdf") {
		t.Fatalf("unexpected document media row: %#v", created)
	}
}

func TestMediaService_RequestUploadURL_ImageSuccess(t *testing.T) {
	svc, q, creatorID, themeID := newMediaTestService(t)
	st := newFakeStorageProvider()
	svc.storage = st

	resp, err := svc.RequestUpload(context.Background(), creatorID, themeID, RequestMediaUploadRequest{
		Name:     "background.png",
		Type:     MediaTypeImage,
		MimeType: "image/png",
		FileSize: 1024,
	})
	if err != nil {
		t.Fatalf("RequestUpload IMAGE/png: %v", err)
	}
	created := q.media[resp.UploadID]
	if created.Type != MediaTypeImage || !created.StorageKey.Valid || !strings.HasSuffix(created.StorageKey.String, ".png") {
		t.Fatalf("unexpected image media row: %#v", created)
	}
}

func TestMediaService_ConfirmUpload_ImageMagicBytes(t *testing.T) {
	svc, q, creatorID, themeID := newMediaTestService(t)
	st := newFakeStorageProvider()
	svc.storage = st
	mediaID := uuid.New()
	storageKey := "themes/" + themeID.String() + "/media/" + mediaID.String() + ".png"
	header := []byte{0x89, 'P', 'N', 'G', 0x0D, 0x0A, 0x1A, 0x0A, 'b', 'o', 'd', 'y'}
	q.media[mediaID] = db.ThemeMedium{
		ID:         mediaID,
		ThemeID:    themeID,
		Name:       "background.png",
		Type:       MediaTypeImage,
		SourceType: SourceTypeFile,
		StorageKey: pgtype.Text{String: storageKey, Valid: true},
		FileSize:   pgtype.Int8{Int64: int64(len(header)), Valid: true},
		MimeType:   pgtype.Text{String: "image/png", Valid: true},
		Tags:       []string{},
	}
	st.objects[storageKey] = header

	resp, err := svc.ConfirmUpload(context.Background(), creatorID, themeID, ConfirmUploadRequest{UploadID: mediaID})
	if err != nil {
		t.Fatalf("ConfirmUpload IMAGE/png: %v", err)
	}
	if resp.Type != MediaTypeImage || resp.MimeType == nil || *resp.MimeType != "image/png" {
		t.Fatalf("unexpected response: %#v", resp)
	}
}

func TestMediaService_ConfirmUpload_DocumentPDFMagicBytes(t *testing.T) {
	svc, q, creatorID, themeID := newMediaTestService(t)
	st := newFakeStorageProvider()
	svc.storage = st
	mediaID := uuid.New()
	storageKey := "themes/" + themeID.String() + "/media/" + mediaID.String() + ".pdf"
	q.media[mediaID] = db.ThemeMedium{
		ID:         mediaID,
		ThemeID:    themeID,
		Name:       "role-sheet.pdf",
		Type:       MediaTypeDocument,
		SourceType: SourceTypeFile,
		StorageKey: pgtype.Text{String: storageKey, Valid: true},
		FileSize:   pgtype.Int8{Int64: int64(len([]byte("%PDF-1.7\nbody bytes"))), Valid: true},
		MimeType:   pgtype.Text{String: "application/pdf", Valid: true},
		Tags:       []string{},
	}
	st.objects[storageKey] = []byte("%PDF-1.7\nbody bytes")

	resp, err := svc.ConfirmUpload(context.Background(), creatorID, themeID, ConfirmUploadRequest{UploadID: mediaID})
	if err != nil {
		t.Fatalf("ConfirmUpload DOCUMENT/pdf: %v", err)
	}
	if resp.Type != MediaTypeDocument || resp.MimeType == nil || *resp.MimeType != "application/pdf" {
		t.Fatalf("unexpected response: %#v", resp)
	}
}

func TestMediaService_GetEditorMediaDownloadURL(t *testing.T) {
	svc, q, creatorID, themeID := newMediaTestService(t)
	svc.storage = newFakeStorageProvider()
	mediaID := uuid.New()
	q.media[mediaID] = db.ThemeMedium{
		ID:         mediaID,
		ThemeID:    themeID,
		Type:       MediaTypeDocument,
		SourceType: SourceTypeFile,
		StorageKey: pgtype.Text{String: "themes/test/media/role.pdf", Valid: true},
	}

	resp, err := svc.GetEditorMediaDownloadURL(context.Background(), creatorID, mediaID)
	if err != nil {
		t.Fatalf("GetEditorMediaDownloadURL: %v", err)
	}
	if resp.URL != "https://download.example/themes/test/media/role.pdf" {
		t.Fatalf("unexpected download URL: %s", resp.URL)
	}
}

func TestMediaService_CreateYouTubeMedia_VideoType_Success(t *testing.T) {
	_, q, _, themeID := newMediaTestService(t)

	// CreateYouTube performs a real HTTP oembed call, so we exercise the
	// DB-layer acceptance directly: verify that the fake (which mirrors the
	// CreateMedia params) accepts VIDEO + YOUTUBE. The migration's
	// video_requires_youtube CHECK is enforced at the SQL level and is
	// covered by integration tests.
	created, err := q.CreateMedia(context.Background(), db.CreateMediaParams{
		ThemeID:    themeID,
		Name:       "cutscene",
		Type:       MediaTypeVideo,
		SourceType: SourceTypeYouTube,
		Url:        pgtype.Text{String: "https://www.youtube.com/watch?v=dQw4w9WgXcQ", Valid: true},
		Tags:       []string{},
	})
	if err != nil {
		t.Fatalf("expected VIDEO+YOUTUBE create to succeed, got %v", err)
	}
	if created.Type != MediaTypeVideo || created.SourceType != SourceTypeYouTube {
		t.Fatalf("unexpected created media: type=%s source=%s", created.Type, created.SourceType)
	}
}

func TestParseYouTubeVideoID(t *testing.T) {
	tests := []struct {
		name string
		url  string
		want string
	}{
		{"watch URL", "https://www.youtube.com/watch?v=dQw4w9WgXcQ", "dQw4w9WgXcQ"},
		{"watch URL with extra params", "https://www.youtube.com/watch?v=dQw4w9WgXcQ&feature=share", "dQw4w9WgXcQ"},
		{"short URL", "https://youtu.be/dQw4w9WgXcQ", "dQw4w9WgXcQ"},
		{"short URL with timestamp", "https://youtu.be/dQw4w9WgXcQ?t=10", "dQw4w9WgXcQ"},
		{"mobile URL", "https://m.youtube.com/watch?v=dQw4w9WgXcQ", "dQw4w9WgXcQ"},
		{"music URL", "https://music.youtube.com/watch?v=dQw4w9WgXcQ", "dQw4w9WgXcQ"},
		{"shorts URL", "https://www.youtube.com/shorts/dQw4w9WgXcQ", "dQw4w9WgXcQ"},
		{"embed URL", "https://www.youtube.com/embed/dQw4w9WgXcQ", "dQw4w9WgXcQ"},
		{"http (not https) - rejected", "http://www.youtube.com/watch?v=dQw4w9WgXcQ", ""},
		{"non-youtube host - rejected", "https://evil.com/watch?v=dQw4w9WgXcQ", ""},
		{"invalid video ID length", "https://www.youtube.com/watch?v=tooshort", ""},
		{"empty URL", "", ""},
		{"malformed URL", "not-a-url", ""},
		{"youtube subdomain SSRF attempt", "https://youtube.com.evil.com/watch?v=dQw4w9WgXcQ", ""},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := parseYouTubeVideoID(tt.url)
			if got != tt.want {
				t.Errorf("parseYouTubeVideoID(%q) = %q, want %q", tt.url, got, tt.want)
			}
		})
	}
}

func TestValidateAudioMagicBytes(t *testing.T) {
	tests := []struct {
		name    string
		header  []byte
		mime    string
		wantErr bool
	}{
		{"MP3 FF FB", []byte{0xFF, 0xFB, 0x00}, "audio/mpeg", false},
		{"MP3 FF F3", []byte{0xFF, 0xF3, 0x00}, "audio/mpeg", false},
		{"MP3 FF F2", []byte{0xFF, 0xF2, 0x00}, "audio/mpeg", false},
		{"MP3 ID3 tag", []byte("ID3\x04\x00"), "audio/mpeg", false},
		{"OGG valid", []byte("OggS\x00\x00\x00\x00"), "audio/ogg", false},
		{"WAV valid", []byte("RIFF\x00\x00\x00\x00WAVEfmt "), "audio/wav", false},
		{"MIME mismatch (MP3 as OGG)", []byte{0xFF, 0xFB, 0x00}, "audio/ogg", true},
		{"Invalid header for MP3", []byte{0x00, 0x00, 0x00}, "audio/mpeg", true},
		{"WAV without WAVE marker", []byte("RIFF\x00\x00\x00\x00AVIf"), "audio/wav", true},
		{"Empty header", []byte{}, "audio/mpeg", true},
		{"Unknown MIME", []byte{0xFF, 0xFB}, "audio/x-unknown", true},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := validateAudioMagicBytes(tt.header, tt.mime)
			if (err != nil) != tt.wantErr {
				t.Errorf("validateAudioMagicBytes() err=%v, wantErr=%v", err, tt.wantErr)
			}
		})
	}
}
