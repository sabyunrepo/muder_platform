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
	categories    map[uuid.UUID]db.ThemeMediaCategory
	replacements  map[uuid.UUID]db.ThemeMediaReplacementUpload
	maps          map[uuid.UUID]db.ThemeMap
	sessions      map[uuid.UUID]db.GameSession
	sections      map[uuid.UUID]db.ReadingSection
	roleSheetRefs map[uuid.UUID][]db.FindRoleSheetReferencesForMediaRow
}

func newFakeMediaQueries() *fakeMediaQueries {
	return &fakeMediaQueries{
		themes:        make(map[uuid.UUID]db.Theme),
		media:         make(map[uuid.UUID]db.ThemeMedium),
		categories:    make(map[uuid.UUID]db.ThemeMediaCategory),
		replacements:  make(map[uuid.UUID]db.ThemeMediaReplacementUpload),
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

func (f *fakeMediaQueries) ListMediaByThemeAndCategory(_ context.Context, arg db.ListMediaByThemeAndCategoryParams) ([]db.ThemeMedium, error) {
	out := []db.ThemeMedium{}
	for _, m := range f.media {
		if m.ThemeID == arg.ThemeID && m.CategoryID.Valid && m.CategoryID.Bytes == arg.CategoryID.Bytes {
			out = append(out, m)
		}
	}
	return out, nil
}

func (f *fakeMediaQueries) ListMediaByThemeTypeAndCategory(_ context.Context, arg db.ListMediaByThemeTypeAndCategoryParams) ([]db.ThemeMedium, error) {
	out := []db.ThemeMedium{}
	for _, m := range f.media {
		if m.ThemeID == arg.ThemeID && m.Type == arg.Type && m.CategoryID.Valid && m.CategoryID.Bytes == arg.CategoryID.Bytes {
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
		CategoryID: arg.CategoryID,
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
	m.CategoryID = arg.CategoryID
	f.media[arg.ID] = m
	return m, nil
}

func (f *fakeMediaQueries) UpdateMediaFileWithOwner(_ context.Context, arg db.UpdateMediaFileWithOwnerParams) (db.ThemeMedium, error) {
	m, ok := f.media[arg.ID]
	if !ok {
		return db.ThemeMedium{}, pgx.ErrNoRows
	}
	t, ok := f.themes[m.ThemeID]
	if !ok || t.CreatorID != arg.CreatorID {
		return db.ThemeMedium{}, pgx.ErrNoRows
	}
	m.SourceType = SourceTypeFile
	m.Url = pgtype.Text{}
	m.StorageKey = arg.StorageKey
	m.FileSize = arg.FileSize
	m.MimeType = arg.MimeType
	m.Duration = pgtype.Int4{}
	f.media[arg.ID] = m
	return m, nil
}

func (f *fakeMediaQueries) ListMediaCategoriesByTheme(_ context.Context, themeID uuid.UUID) ([]db.ThemeMediaCategory, error) {
	out := []db.ThemeMediaCategory{}
	for _, c := range f.categories {
		if c.ThemeID == themeID {
			out = append(out, c)
		}
	}
	return out, nil
}

func (f *fakeMediaQueries) GetMediaCategoryWithOwner(_ context.Context, arg db.GetMediaCategoryWithOwnerParams) (db.ThemeMediaCategory, error) {
	c, ok := f.categories[arg.ID]
	if !ok {
		return db.ThemeMediaCategory{}, pgx.ErrNoRows
	}
	t, ok := f.themes[c.ThemeID]
	if !ok || t.CreatorID != arg.CreatorID {
		return db.ThemeMediaCategory{}, pgx.ErrNoRows
	}
	return c, nil
}

func (f *fakeMediaQueries) CreateMediaCategory(_ context.Context, arg db.CreateMediaCategoryParams) (db.ThemeMediaCategory, error) {
	t, ok := f.themes[arg.ThemeID]
	if !ok || t.CreatorID != arg.CreatorID {
		return db.ThemeMediaCategory{}, pgx.ErrNoRows
	}
	c := db.ThemeMediaCategory{ID: uuid.New(), ThemeID: arg.ThemeID, Name: arg.Name, SortOrder: arg.SortOrder, CreatedAt: time.Now()}
	f.categories[c.ID] = c
	return c, nil
}

func (f *fakeMediaQueries) UpdateMediaCategory(_ context.Context, arg db.UpdateMediaCategoryParams) (db.ThemeMediaCategory, error) {
	c, err := f.GetMediaCategoryWithOwner(context.Background(), db.GetMediaCategoryWithOwnerParams{ID: arg.ID, CreatorID: arg.CreatorID})
	if err != nil {
		return db.ThemeMediaCategory{}, err
	}
	c.Name = arg.Name
	c.SortOrder = arg.SortOrder
	f.categories[arg.ID] = c
	return c, nil
}

func (f *fakeMediaQueries) DeleteMediaCategoryWithOwner(_ context.Context, arg db.DeleteMediaCategoryWithOwnerParams) (int64, error) {
	c, err := f.GetMediaCategoryWithOwner(context.Background(), db.GetMediaCategoryWithOwnerParams{ID: arg.ID, CreatorID: arg.CreatorID})
	if err != nil {
		return 0, nil
	}
	delete(f.categories, c.ID)
	for id, m := range f.media {
		if m.CategoryID.Valid && m.CategoryID.Bytes == c.ID {
			m.CategoryID = pgtype.UUID{}
			f.media[id] = m
		}
	}
	return 1, nil
}

func (f *fakeMediaQueries) CreateMediaReplacementUpload(_ context.Context, arg db.CreateMediaReplacementUploadParams) (db.ThemeMediaReplacementUpload, error) {
	if _, err := f.GetMediaWithOwner(context.Background(), db.GetMediaWithOwnerParams{ID: arg.MediaID, CreatorID: arg.CreatorID}); err != nil {
		return db.ThemeMediaReplacementUpload{}, err
	}
	r := db.ThemeMediaReplacementUpload{ID: uuid.New(), MediaID: arg.MediaID, StorageKey: arg.StorageKey, FileSize: arg.FileSize, MimeType: arg.MimeType, CreatedAt: time.Now()}
	f.replacements[r.ID] = r
	return r, nil
}

func (f *fakeMediaQueries) GetMediaReplacementUploadWithOwner(_ context.Context, arg db.GetMediaReplacementUploadWithOwnerParams) (db.ThemeMediaReplacementUpload, error) {
	r, ok := f.replacements[arg.ID]
	if !ok {
		return db.ThemeMediaReplacementUpload{}, pgx.ErrNoRows
	}
	if _, err := f.GetMediaWithOwner(context.Background(), db.GetMediaWithOwnerParams{ID: r.MediaID, CreatorID: arg.CreatorID}); err != nil {
		return db.ThemeMediaReplacementUpload{}, pgx.ErrNoRows
	}
	return r, nil
}

func (f *fakeMediaQueries) DeleteMediaReplacementUpload(_ context.Context, id uuid.UUID) error {
	delete(f.replacements, id)
	return nil
}

func (f *fakeMediaQueries) UpdateThemeConfigJsonWithOwner(_ context.Context, arg db.UpdateThemeConfigJsonWithOwnerParams) (db.Theme, error) {
	t, ok := f.themes[arg.ID]
	if !ok || t.CreatorID != arg.CreatorID {
		return db.Theme{}, pgx.ErrNoRows
	}
	t.ConfigJson = arg.ConfigJson
	f.themes[arg.ID] = t
	return t, nil
}

func (f *fakeMediaQueries) ClearReadingSectionMediaReferencesWithOwner(_ context.Context, arg db.ClearReadingSectionMediaReferencesWithOwnerParams) (int64, error) {
	var rows int64
	for id, s := range f.sections {
		if s.ThemeID != arg.ThemeID {
			continue
		}
		changed := false
		if s.BgmMediaID.Valid && uuid.UUID(s.BgmMediaID.Bytes) == arg.MediaID {
			s.BgmMediaID = pgtype.UUID{}
			changed = true
		}
		var lines []map[string]any
		if len(s.Lines) > 0 && json.Unmarshal(s.Lines, &lines) == nil {
			for _, line := range lines {
				if line["VoiceMediaID"] == arg.MediaID.String() {
					delete(line, "VoiceMediaID")
					changed = true
				}
				if line["ImageMediaID"] == arg.MediaID.String() {
					delete(line, "ImageMediaID")
					changed = true
				}
			}
			if changed {
				s.Lines, _ = json.Marshal(lines)
			}
		}
		if changed {
			f.sections[id] = s
			rows++
		}
	}
	return rows, nil
}

func (f *fakeMediaQueries) ClearRoleSheetMediaReferencesWithOwner(_ context.Context, arg db.ClearRoleSheetMediaReferencesWithOwnerParams) (int64, error) {
	delete(f.roleSheetRefs, uuid.MustParse(arg.MediaID))
	return 1, nil
}

func (f *fakeMediaQueries) ClearThemeCoverMediaReferencesWithOwner(_ context.Context, arg db.ClearThemeCoverMediaReferencesWithOwnerParams) (int64, error) {
	if !arg.MediaID.Valid {
		return 0, nil
	}
	t, ok := f.themes[arg.ThemeID]
	if !ok || t.CreatorID != arg.CreatorID || !t.CoverImageMediaID.Valid || t.CoverImageMediaID.Bytes != arg.MediaID.Bytes {
		return 0, nil
	}
	t.CoverImageMediaID = pgtype.UUID{}
	f.themes[arg.ThemeID] = t
	return 1, nil
}

func (f *fakeMediaQueries) ClearMapMediaReferencesWithOwner(_ context.Context, arg db.ClearMapMediaReferencesWithOwnerParams) (int64, error) {
	if !arg.MediaID.Valid {
		return 0, nil
	}
	var rows int64
	theme, ok := f.themes[arg.ThemeID]
	if !ok || theme.CreatorID != arg.CreatorID {
		return 0, nil
	}
	for id, m := range f.maps {
		if m.ThemeID == arg.ThemeID && m.ImageMediaID.Valid && m.ImageMediaID.Bytes == arg.MediaID.Bytes {
			m.ImageMediaID = pgtype.UUID{}
			f.maps[id] = m
			rows++
		}
	}
	return rows, nil
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

func TestMediaService_PreviewDelete_ReportsBgmReference(t *testing.T) {
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

	preview, err := svc.PreviewDeleteMedia(context.Background(), creatorID, bgmID)
	if err != nil {
		t.Fatalf("PreviewDeleteMedia: %v", err)
	}
	refs := preview.References
	if len(refs) != 1 || refs[0].ID != sectionID.String() || refs[0].Name != "Intro" || refs[0].Type != "reading_section" {
		t.Fatalf("unexpected reference shape: %#v", refs)
	}
	if _, ok := q.media[bgmID]; !ok {
		t.Fatalf("preview must not delete media")
	}
}

func TestMediaService_PreviewDelete_ReportsVoiceReference(t *testing.T) {
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

	preview, err := svc.PreviewDeleteMedia(context.Background(), creatorID, voiceID)
	if err != nil {
		t.Fatalf("PreviewDeleteMedia: %v", err)
	}
	refs := preview.References
	if len(refs) != 1 || refs[0].ID != sectionID.String() {
		t.Fatalf("unexpected references: %#v", refs)
	}
}

func TestMediaService_PreviewDelete_ReportsReadingImageReference(t *testing.T) {
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

	preview, err := svc.PreviewDeleteMedia(context.Background(), creatorID, imageID)
	if err != nil {
		t.Fatalf("PreviewDeleteMedia: %v", err)
	}
	refs := preview.References
	if len(refs) != 1 || refs[0].ID != sectionID.String() || refs[0].Type != "reading_section" || refs[0].Name != "Image cue" {
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
	svc := NewMediaService(fixture.q, nil, nil, zerolog.Nop())

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

			preview, err := svc.PreviewDeleteMedia(ctx, creatorID, tt.mediaID)
			if err != nil {
				t.Fatalf("PreviewDeleteMedia: %v", err)
			}
			references := preview.References
			if len(references) != 1 {
				t.Fatalf("expected references with 1 entry, got %#v", references)
			}
			if references[0].Type != "reading_section" || references[0].ID != section.ID.String() || references[0].Name != "JSONB refs" {
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

func TestMediaService_PreviewDelete_ReportsThemeCoverReference(t *testing.T) {
	svc, q, creatorID, themeID := newMediaTestService(t)
	mediaID := seedMedia(q, themeID, MediaTypeImage)
	theme := q.themes[themeID]
	theme.Title = "저택 살인사건"
	theme.CoverImageMediaID = pgtype.UUID{Bytes: mediaID, Valid: true}
	q.themes[themeID] = theme

	preview, err := svc.PreviewDeleteMedia(context.Background(), creatorID, mediaID)
	if err != nil {
		t.Fatalf("PreviewDeleteMedia: %v", err)
	}
	refs := preview.References
	if len(refs) != 1 || refs[0].Type != "theme_cover" || refs[0].ID != themeID.String() || refs[0].Name != "저택 살인사건" {
		t.Fatalf("unexpected theme cover references: %#v", refs)
	}
}

func TestMediaService_PreviewDelete_ReportsMapImageReference(t *testing.T) {
	svc, q, creatorID, themeID := newMediaTestService(t)
	mediaID := seedMedia(q, themeID, MediaTypeImage)
	mapID := uuid.New()
	q.maps[mapID] = db.ThemeMap{
		ID:           mapID,
		ThemeID:      themeID,
		Name:         "1층 지도",
		ImageMediaID: pgtype.UUID{Bytes: mediaID, Valid: true},
	}

	preview, err := svc.PreviewDeleteMedia(context.Background(), creatorID, mediaID)
	if err != nil {
		t.Fatalf("PreviewDeleteMedia: %v", err)
	}
	refs := preview.References
	if len(refs) != 1 || refs[0].Type != "map" || refs[0].ID != mapID.String() || refs[0].Name != "1층 지도" {
		t.Fatalf("unexpected map references: %#v", refs)
	}
}

func TestMediaService_PreviewDelete_ReportsRoleSheetReference(t *testing.T) {
	svc, q, creatorID, themeID := newMediaTestService(t)
	mediaID := seedMedia(q, themeID, MediaTypeDocument)
	q.roleSheetRefs[mediaID] = []db.FindRoleSheetReferencesForMediaRow{
		{ID: uuid.New(), Key: "role_sheet:char-1"},
	}

	preview, err := svc.PreviewDeleteMedia(context.Background(), creatorID, mediaID)
	if err != nil {
		t.Fatalf("PreviewDeleteMedia: %v", err)
	}
	refs := preview.References
	if len(refs) != 1 || refs[0].Type != "role_sheet" || refs[0].ID != "role_sheet:char-1" {
		t.Fatalf("unexpected role sheet references: %#v", refs)
	}
	if _, ok := q.media[mediaID]; !ok {
		t.Fatalf("media should not have been deleted")
	}
}

func TestMediaService_PreviewDelete_ReportsPhaseOnEnterMediaReference(t *testing.T) {
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

	preview, err := svc.PreviewDeleteMedia(context.Background(), creatorID, mediaID)
	if err != nil {
		t.Fatalf("PreviewDeleteMedia: %v", err)
	}
	refs := preview.References
	if len(refs) != 1 {
		t.Fatalf("expected one phase reference, got %#v", refs)
	}
	if refs[0].Type != "phase_action" || refs[0].ID != "investigation:onEnter:bgm" {
		t.Fatalf("unexpected phase reference: %#v", refs[0])
	}
	if !strings.Contains(refs[0].Name, "조사 단계 시작 트리거") || !strings.Contains(refs[0].Name, "BGM") {
		t.Fatalf("unexpected creator label: %#v", refs[0])
	}
	if _, ok := q.media[mediaID]; !ok {
		t.Fatalf("media should not have been deleted")
	}
}

func TestMediaService_PreviewDelete_ReportsPhaseOnExitMediaReference(t *testing.T) {
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

	preview, err := svc.PreviewDeleteMedia(context.Background(), creatorID, mediaID)
	if err != nil {
		t.Fatalf("PreviewDeleteMedia: %v", err)
	}
	refs := preview.References
	if len(refs) != 1 || refs[0].Type != "phase_action" || refs[0].ID != "debate:onExit:sfx" {
		t.Fatalf("unexpected phase reference: %#v", refs)
	}
	if !strings.Contains(refs[0].Name, "토론 단계 종료 트리거") || !strings.Contains(refs[0].Name, "효과음") {
		t.Fatalf("unexpected creator label: %#v", refs[0])
	}
}

func TestMediaService_PreviewDelete_ReportsEventProgressionTriggerMediaReference(t *testing.T) {
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

	preview, err := svc.PreviewDeleteMedia(context.Background(), creatorID, mediaID)
	if err != nil {
		t.Fatalf("PreviewDeleteMedia: %v", err)
	}
	refs := preview.References
	if len(refs) != 1 || refs[0].Type != "event_progression_trigger_action" || refs[0].ID != "reveal-room:bg" {
		t.Fatalf("unexpected event trigger reference: %#v", refs)
	}
	if !strings.Contains(refs[0].Name, "비밀 토론방 공개 실행 결과") || !strings.Contains(refs[0].Name, "배경 이미지") {
		t.Fatalf("unexpected creator label: %#v", refs[0])
	}
}

func TestMediaService_PreviewDelete_LabelsMultipleActionReferencesByActionPurpose(t *testing.T) {
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

	preview, err := svc.PreviewDeleteMedia(context.Background(), creatorID, mediaID)
	if err != nil {
		t.Fatalf("PreviewDeleteMedia: %v", err)
	}
	refs := preview.References
	if len(refs) != 2 {
		t.Fatalf("expected two phase references, got %#v", refs)
	}
	if !strings.Contains(refs[0].Name, "배경 이미지") {
		t.Fatalf("first reference should use background label: %#v", refs[0])
	}
	if !strings.Contains(refs[1].Name, "영상") {
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

func TestMediaService_CategoryCRUDAndFiltering(t *testing.T) {
	svc, q, creatorID, themeID := newMediaTestService(t)

	category, err := svc.CreateCategory(context.Background(), creatorID, themeID, MediaCategoryRequest{
		Name:      "전경",
		SortOrder: 1,
	})
	if err != nil {
		t.Fatalf("CreateCategory: %v", err)
	}
	mediaID := seedMedia(q, themeID, MediaTypeImage)
	media := q.media[mediaID]
	media.CategoryID = pgtype.UUID{Bytes: category.ID, Valid: true}
	q.media[mediaID] = media

	filtered, err := svc.ListMedia(context.Background(), creatorID, themeID, MediaTypeImage, &category.ID)
	if err != nil {
		t.Fatalf("ListMedia filtered: %v", err)
	}
	if len(filtered) != 1 || filtered[0].ID != mediaID || filtered[0].CategoryID == nil || *filtered[0].CategoryID != category.ID {
		t.Fatalf("unexpected filtered media: %#v", filtered)
	}

	updated, err := svc.UpdateCategory(context.Background(), creatorID, category.ID, MediaCategoryRequest{Name: "배경", SortOrder: 2})
	if err != nil {
		t.Fatalf("UpdateCategory: %v", err)
	}
	if updated.Name != "배경" || updated.SortOrder != 2 {
		t.Fatalf("unexpected updated category: %#v", updated)
	}

	if err := svc.DeleteCategory(context.Background(), creatorID, category.ID); err != nil {
		t.Fatalf("DeleteCategory: %v", err)
	}
	if q.media[mediaID].CategoryID.Valid {
		t.Fatalf("deleting category should unassign media category")
	}
}

func TestMediaService_Delete_CleansReadingAndConfigReferences(t *testing.T) {
	svc, q, creatorID, themeID := newMediaTestService(t)
	mediaID := seedMedia(q, themeID, MediaTypeImage)
	sectionID := uuid.New()
	linesJSON, _ := json.Marshal([]map[string]any{
		{"Index": 0, "Text": "사진 공개", "ImageMediaID": mediaID.String(), "VoiceMediaID": mediaID.String()},
	})
	q.sections[sectionID] = db.ReadingSection{ID: sectionID, ThemeID: themeID, Name: "이미지 읽기", Lines: linesJSON}
	theme := q.themes[themeID]
	theme.CoverImageMediaID = pgtype.UUID{Bytes: mediaID, Valid: true}
	theme.ConfigJson = json.RawMessage(fmt.Sprintf(`{
		"phases": [{"id":"intro","onEnter":[{"id":"bg","type":"SET_BACKGROUND","params":{"mediaId":%q,"keep":"x"}}]}],
		"modules": {}
	}`, mediaID.String()))
	q.themes[themeID] = theme
	mapID := uuid.New()
	q.maps[mapID] = db.ThemeMap{
		ID:           mapID,
		ThemeID:      themeID,
		Name:         "사건 현장",
		ImageMediaID: pgtype.UUID{Bytes: mediaID, Valid: true},
	}

	if err := svc.DeleteMedia(context.Background(), creatorID, mediaID); err != nil {
		t.Fatalf("DeleteMedia: %v", err)
	}
	if _, ok := q.media[mediaID]; ok {
		t.Fatalf("media should be deleted")
	}
	var lines []map[string]any
	if err := json.Unmarshal(q.sections[sectionID].Lines, &lines); err != nil {
		t.Fatalf("unmarshal cleaned lines: %v", err)
	}
	if _, ok := lines[0]["ImageMediaID"]; ok {
		t.Fatalf("ImageMediaID should be removed: %#v", lines[0])
	}
	if _, ok := lines[0]["VoiceMediaID"]; ok {
		t.Fatalf("VoiceMediaID should be removed: %#v", lines[0])
	}
	if strings.Contains(string(q.themes[themeID].ConfigJson), mediaID.String()) {
		t.Fatalf("config mediaId should be removed: %s", string(q.themes[themeID].ConfigJson))
	}
	if !strings.Contains(string(q.themes[themeID].ConfigJson), `"keep":"x"`) {
		t.Fatalf("non-media action params should remain: %s", string(q.themes[themeID].ConfigJson))
	}
	if q.themes[themeID].CoverImageMediaID.Valid {
		t.Fatalf("theme cover media reference should be cleared")
	}
	if q.maps[mapID].ImageMediaID.Valid {
		t.Fatalf("map image media reference should be cleared")
	}
}

func TestMediaService_ReplacementUpload_PreservesMediaIDAndDeletesOldObject(t *testing.T) {
	svc, q, creatorID, themeID := newMediaTestService(t)
	st := newFakeStorageProvider()
	svc.storage = st
	mediaID := seedFileMedia(q, themeID, MediaTypeImage)
	oldKey := q.media[mediaID].StorageKey.String
	media := q.media[mediaID]
	media.Duration = pgtype.Int4{Int32: 123, Valid: true}
	q.media[mediaID] = media
	st.objects[oldKey] = []byte{0x89, 'P', 'N', 'G', 0x0D, 0x0A, 0x1A, 0x0A}

	upload, err := svc.RequestReplacementUpload(context.Background(), creatorID, mediaID, RequestMediaReplacementUploadRequest{
		MimeType: "image/png",
		FileSize: 8,
	})
	if err != nil {
		t.Fatalf("RequestReplacementUpload: %v", err)
	}
	pending := q.replacements[upload.UploadID]
	st.objects[pending.StorageKey] = []byte{0x89, 'P', 'N', 'G', 0x0D, 0x0A, 0x1A, 0x0A}

	resp, err := svc.ConfirmReplacementUpload(context.Background(), creatorID, mediaID, ConfirmUploadRequest{UploadID: upload.UploadID})
	if err != nil {
		t.Fatalf("ConfirmReplacementUpload: %v", err)
	}
	if resp.ID != mediaID {
		t.Fatalf("replacement must preserve media id: got %s want %s", resp.ID, mediaID)
	}
	if q.media[mediaID].StorageKey.String != pending.StorageKey {
		t.Fatalf("storage key was not replaced")
	}
	if q.media[mediaID].Duration.Valid {
		t.Fatalf("replacement should clear stale duration metadata")
	}
	if _, ok := st.objects[oldKey]; ok {
		t.Fatalf("old object should be deleted")
	}
	if _, ok := q.replacements[upload.UploadID]; ok {
		t.Fatalf("pending replacement should be deleted")
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
