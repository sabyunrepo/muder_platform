package editor

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"image"
	"image/color"
	"image/png"
	"io"
	"strings"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/rs/zerolog"
	"go.uber.org/mock/gomock"

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
	clues         map[uuid.UUID]db.ThemeClue
	locations     map[uuid.UUID]db.ThemeLocation
	characters    map[uuid.UUID]db.ThemeCharacter
	sessions      map[uuid.UUID]db.GameSession
	sections      map[uuid.UUID]db.ReadingSection
	roleSheetRefs map[uuid.UUID][]db.FindRoleSheetReferencesForMediaRow
	aliasIconRefs map[uuid.UUID][]db.FindCharacterAliasIconReferencesForMediaRow
	storyInfoRefs map[uuid.UUID][]db.FindStoryInfoReferencesForMediaRow
}

func newFakeMediaQueries() *fakeMediaQueries {
	return &fakeMediaQueries{
		themes:        make(map[uuid.UUID]db.Theme),
		media:         make(map[uuid.UUID]db.ThemeMedium),
		categories:    make(map[uuid.UUID]db.ThemeMediaCategory),
		replacements:  make(map[uuid.UUID]db.ThemeMediaReplacementUpload),
		maps:          make(map[uuid.UUID]db.ThemeMap),
		clues:         make(map[uuid.UUID]db.ThemeClue),
		locations:     make(map[uuid.UUID]db.ThemeLocation),
		characters:    make(map[uuid.UUID]db.ThemeCharacter),
		sessions:      make(map[uuid.UUID]db.GameSession),
		sections:      make(map[uuid.UUID]db.ReadingSection),
		roleSheetRefs: make(map[uuid.UUID][]db.FindRoleSheetReferencesForMediaRow),
		aliasIconRefs: make(map[uuid.UUID][]db.FindCharacterAliasIconReferencesForMediaRow),
		storyInfoRefs: make(map[uuid.UUID][]db.FindStoryInfoReferencesForMediaRow),
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
				if line["MediaID"] == arg.MediaID.String() {
					delete(line, "MediaID")
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

func (f *fakeMediaQueries) ClearCharacterAliasIconMediaReferencesWithOwner(_ context.Context, arg db.ClearCharacterAliasIconMediaReferencesWithOwnerParams) (int64, error) {
	delete(f.aliasIconRefs, uuid.MustParse(arg.MediaID))
	return 1, nil
}

func (f *fakeMediaQueries) ClearCharacterImageMediaReferencesWithOwner(_ context.Context, arg db.ClearCharacterImageMediaReferencesWithOwnerParams) (int64, error) {
	var rows int64
	theme, ok := f.themes[arg.ThemeID]
	if !ok || theme.CreatorID != arg.CreatorID {
		return 0, nil
	}
	for id, character := range f.characters {
		if character.ThemeID != arg.ThemeID {
			continue
		}
		changed := false
		if character.ImageMediaID.Valid && character.ImageMediaID.Bytes == arg.MediaID {
			character.ImageMediaID = pgtype.UUID{}
			changed = true
		}
		if character.EndcardImageMediaID.Valid && character.EndcardImageMediaID.Bytes == arg.MediaID {
			character.EndcardImageMediaID = pgtype.UUID{}
			changed = true
		}
		if changed {
			f.characters[id] = character
			rows++
		}
	}
	return rows, nil
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

func (f *fakeMediaQueries) ClearClueMediaReferencesWithOwner(_ context.Context, arg db.ClearClueMediaReferencesWithOwnerParams) (int64, error) {
	if !arg.MediaID.Valid {
		return 0, nil
	}
	var rows int64
	theme, ok := f.themes[arg.ThemeID]
	if !ok || theme.CreatorID != arg.CreatorID {
		return 0, nil
	}
	for id, clue := range f.clues {
		if clue.ThemeID == arg.ThemeID && clue.ImageMediaID.Valid && clue.ImageMediaID.Bytes == arg.MediaID.Bytes {
			clue.ImageMediaID = pgtype.UUID{}
			f.clues[id] = clue
			rows++
		}
	}
	return rows, nil
}

func (f *fakeMediaQueries) ClearLocationMediaReferencesWithOwner(_ context.Context, arg db.ClearLocationMediaReferencesWithOwnerParams) (int64, error) {
	if !arg.MediaID.Valid {
		return 0, nil
	}
	var rows int64
	theme, ok := f.themes[arg.ThemeID]
	if !ok || theme.CreatorID != arg.CreatorID {
		return 0, nil
	}
	for id, location := range f.locations {
		if location.ThemeID == arg.ThemeID && location.ImageMediaID.Valid && location.ImageMediaID.Bytes == arg.MediaID.Bytes {
			location.ImageMediaID = pgtype.UUID{}
			f.locations[id] = location
			rows++
		}
	}
	return rows, nil
}

func (f *fakeMediaQueries) ClearStoryInfoMediaReferencesWithOwner(_ context.Context, arg db.ClearStoryInfoMediaReferencesWithOwnerParams) (int64, error) {
	return int64(len(f.storyInfoRefs[arg.MediaID])), nil
}

func (f *fakeMediaQueries) DeleteStoryInfoMediaRefsForMediaWithOwner(_ context.Context, arg db.DeleteStoryInfoMediaRefsForMediaWithOwnerParams) (int64, error) {
	rows := int64(len(f.storyInfoRefs[arg.MediaID]))
	delete(f.storyInfoRefs, arg.MediaID)
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

func (f *fakeMediaQueries) FindClueReferencesForMedia(_ context.Context, arg db.FindClueReferencesForMediaParams) ([]db.FindClueReferencesForMediaRow, error) {
	out := []db.FindClueReferencesForMediaRow{}
	if !arg.MediaID.Valid {
		return out, nil
	}
	for _, clue := range f.clues {
		if clue.ThemeID == arg.ThemeID && clue.ImageMediaID.Valid && clue.ImageMediaID.Bytes == arg.MediaID.Bytes {
			out = append(out, db.FindClueReferencesForMediaRow{ID: clue.ID, Name: clue.Name})
		}
	}
	return out, nil
}

func (f *fakeMediaQueries) FindLocationReferencesForMedia(_ context.Context, arg db.FindLocationReferencesForMediaParams) ([]db.FindLocationReferencesForMediaRow, error) {
	out := []db.FindLocationReferencesForMediaRow{}
	if !arg.MediaID.Valid {
		return out, nil
	}
	for _, location := range f.locations {
		if location.ThemeID == arg.ThemeID && location.ImageMediaID.Valid && location.ImageMediaID.Bytes == arg.MediaID.Bytes {
			out = append(out, db.FindLocationReferencesForMediaRow{ID: location.ID, Name: location.Name})
		}
	}
	return out, nil
}

func (f *fakeMediaQueries) FindStoryInfoReferencesForMedia(_ context.Context, arg db.FindStoryInfoReferencesForMediaParams) ([]db.FindStoryInfoReferencesForMediaRow, error) {
	return f.storyInfoRefs[arg.MediaID], nil
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
					if v, ok := ln["MediaID"].(string); ok && v == arg.MediaID.String() {
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
	mediaID, err := uuid.Parse(arg.Body)
	if err != nil {
		return []db.FindRoleSheetReferencesForMediaRow{}, nil
	}
	return f.roleSheetRefs[mediaID], nil
}

func (f *fakeMediaQueries) FindCharacterAliasIconReferencesForMedia(_ context.Context, arg db.FindCharacterAliasIconReferencesForMediaParams) ([]db.FindCharacterAliasIconReferencesForMediaRow, error) {
	mediaID, err := uuid.Parse(arg.MediaID)
	if err != nil {
		return []db.FindCharacterAliasIconReferencesForMediaRow{}, nil
	}
	return f.aliasIconRefs[mediaID], nil
}

func (f *fakeMediaQueries) FindCharacterImageReferencesForMedia(_ context.Context, arg db.FindCharacterImageReferencesForMediaParams) ([]db.FindCharacterImageReferencesForMediaRow, error) {
	out := []db.FindCharacterImageReferencesForMediaRow{}
	for _, character := range f.characters {
		if character.ThemeID != arg.ThemeID {
			continue
		}
		if character.ImageMediaID.Valid && character.ImageMediaID.Bytes == arg.MediaID {
			out = append(out, db.FindCharacterImageReferencesForMediaRow{ID: character.ID, Name: character.Name, Usage: "profile"})
		}
		if character.EndcardImageMediaID.Valid && character.EndcardImageMediaID.Bytes == arg.MediaID {
			out = append(out, db.FindCharacterImageReferencesForMediaRow{ID: character.ID, Name: character.Name, Usage: "endcard"})
		}
	}
	return out, nil
}

type fakeStorageProvider struct {
	objects             map[string][]byte
	generateUploadErr   error
	generateDownloadErr error
	deleteObjectsErr    error
	headErr             error
	rangeErr            error
	putErrKeyContains   string
	putErr              error
}

func newFakeStorageProvider() *fakeStorageProvider {
	return &fakeStorageProvider{objects: make(map[string][]byte)}
}

func tinyPNG(t *testing.T) []byte {
	t.Helper()
	img := image.NewRGBA(image.Rect(0, 0, 2, 2))
	img.Set(0, 0, color.RGBA{R: 255, A: 255})
	img.Set(1, 0, color.RGBA{G: 255, A: 255})
	img.Set(0, 1, color.RGBA{B: 255, A: 255})
	img.Set(1, 1, color.RGBA{R: 255, G: 255, B: 255, A: 255})
	var buf bytes.Buffer
	if err := png.Encode(&buf, img); err != nil {
		t.Fatalf("encode tiny png: %v", err)
	}
	return buf.Bytes()
}

func (f *fakeStorageProvider) GenerateUploadURL(_ context.Context, key string, _ string, _ int64, _ time.Duration) (string, error) {
	if f.generateUploadErr != nil {
		return "", f.generateUploadErr
	}
	return "https://upload.example/" + key, nil
}

func (f *fakeStorageProvider) GenerateDownloadURL(_ context.Context, key string, _ time.Duration) (string, error) {
	if f.generateDownloadErr != nil {
		return "", f.generateDownloadErr
	}
	return "https://download.example/" + key, nil
}

func (f *fakeStorageProvider) PutObject(_ context.Context, key string, body io.Reader, _ string, _ int64) error {
	if f.putErr != nil && (f.putErrKeyContains == "" || strings.Contains(key, f.putErrKeyContains)) {
		return f.putErr
	}
	b, err := io.ReadAll(body)
	if err != nil {
		return err
	}
	f.objects[key] = b
	return nil
}

func (f *fakeStorageProvider) HeadObject(_ context.Context, key string) (*storage.ObjectMeta, error) {
	if f.headErr != nil {
		return nil, f.headErr
	}
	body, ok := f.objects[key]
	if !ok {
		return nil, storage.ErrObjectNotFound
	}
	return &storage.ObjectMeta{Key: key, Size: int64(len(body)), ContentType: "application/pdf"}, nil
}

func (f *fakeStorageProvider) GetObjectRange(_ context.Context, key string, offset int64, length int64) (io.ReadCloser, error) {
	if f.rangeErr != nil {
		return nil, f.rangeErr
	}
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
	if f.deleteObjectsErr != nil {
		return f.deleteObjectsErr
	}
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

func expectEmptyMediaReferenceCollection(q *MockmediaQueries, themeID uuid.UUID) {
	expectEmptyMediaReferenceCollectionWithConfig(q, themeID, json.RawMessage(`{"phases":[],"modules":{}}`))
}

func expectEmptyMediaReferenceCollectionWithConfig(q *MockmediaQueries, themeID uuid.UUID, cfg json.RawMessage) {
	q.EXPECT().FindMediaReferencesInReadingSections(gomock.Any(), gomock.Any()).Return(nil, nil)
	q.EXPECT().FindThemeCoverReferencesForMedia(gomock.Any(), gomock.Any()).Return(nil, nil)
	q.EXPECT().FindMapReferencesForMedia(gomock.Any(), gomock.Any()).Return(nil, nil)
	q.EXPECT().FindClueReferencesForMedia(gomock.Any(), gomock.Any()).Return(nil, nil)
	q.EXPECT().FindLocationReferencesForMedia(gomock.Any(), gomock.Any()).Return(nil, nil)
	q.EXPECT().FindCharacterImageReferencesForMedia(gomock.Any(), gomock.Any()).Return(nil, nil)
	q.EXPECT().FindStoryInfoReferencesForMedia(gomock.Any(), gomock.Any()).Return(nil, nil)
	q.EXPECT().FindRoleSheetReferencesForMedia(gomock.Any(), gomock.Any()).Return(nil, nil)
	q.EXPECT().FindCharacterAliasIconReferencesForMedia(gomock.Any(), gomock.Any()).Return(nil, nil)
	q.EXPECT().GetTheme(gomock.Any(), themeID).Return(db.Theme{ID: themeID, ConfigJson: cfg}, nil)
}

func expectSuccessfulMediaReferenceClears(q *MockmediaQueries) {
	q.EXPECT().ClearReadingSectionMediaReferencesWithOwner(gomock.Any(), gomock.Any()).Return(int64(0), nil)
	q.EXPECT().ClearRoleSheetMediaReferencesWithOwner(gomock.Any(), gomock.Any()).Return(int64(0), nil)
	q.EXPECT().ClearCharacterAliasIconMediaReferencesWithOwner(gomock.Any(), gomock.Any()).Return(int64(0), nil)
	q.EXPECT().ClearCharacterImageMediaReferencesWithOwner(gomock.Any(), gomock.Any()).Return(int64(0), nil)
	q.EXPECT().ClearThemeCoverMediaReferencesWithOwner(gomock.Any(), gomock.Any()).Return(int64(0), nil)
	q.EXPECT().ClearMapMediaReferencesWithOwner(gomock.Any(), gomock.Any()).Return(int64(0), nil)
	q.EXPECT().ClearClueMediaReferencesWithOwner(gomock.Any(), gomock.Any()).Return(int64(0), nil)
	q.EXPECT().ClearLocationMediaReferencesWithOwner(gomock.Any(), gomock.Any()).Return(int64(0), nil)
	q.EXPECT().ClearStoryInfoMediaReferencesWithOwner(gomock.Any(), gomock.Any()).Return(int64(0), nil)
	q.EXPECT().DeleteStoryInfoMediaRefsForMediaWithOwner(gomock.Any(), gomock.Any()).Return(int64(0), nil)
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

func TestMediaService_UpdateMedia_AllowsAudioTypeChange(t *testing.T) {
	svc, q, creatorID, themeID := newMediaTestService(t)
	mediaID := seedMedia(q, themeID, MediaTypeBGM)

	resp, err := svc.UpdateMedia(context.Background(), creatorID, mediaID, UpdateMediaRequest{
		Name:      "relabel",
		Type:      MediaTypeSFX,
		Tags:      []string{},
		SortOrder: 0,
	})
	if err != nil {
		t.Fatalf("UpdateMedia audio type change: %v", err)
	}
	if resp.Type != MediaTypeSFX || q.media[mediaID].Type != MediaTypeSFX {
		t.Fatalf("media type not changed to SFX: resp=%q stored=%q", resp.Type, q.media[mediaID].Type)
	}
}

func TestMediaService_UpdateMedia_RejectsCrossGroupTypeChange(t *testing.T) {
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

func TestMediaService_ResolveMediaURL_UsesImagePreviewVariant(t *testing.T) {
	svc, q, _, themeID := newMediaTestService(t)
	st := newFakeStorageProvider()
	svc.storage = st
	sessionID := uuid.New()
	q.sessions[sessionID] = db.GameSession{ID: sessionID, ThemeID: themeID}
	mediaID := seedFileMedia(q, themeID, MediaTypeImage)
	media := q.media[mediaID]
	media.StorageKey = pgtype.Text{String: mediaImageVariantKey(themeID, mediaID, imageVariantMaster), Valid: true}
	q.media[mediaID] = media
	st.objects[media.StorageKey.String] = []byte("master")
	previewKey := mediaImageVariantKey(themeID, mediaID, imageVariantPreview)
	st.objects[previewKey] = []byte("preview")

	url, sourceType, err := svc.ResolveMediaURL(context.Background(), sessionID, mediaID, MediaTypeImage)
	if err != nil {
		t.Fatalf("ResolveMediaURL image preview: %v", err)
	}
	if sourceType != SourceTypeFile || !strings.Contains(url, previewKey) {
		t.Fatalf("expected preview variant URL, got url=%q source=%q", url, sourceType)
	}
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

func TestMediaService_PreviewDelete_ReportsReadingBlockMediaReference(t *testing.T) {
	svc, q, creatorID, themeID := newMediaTestService(t)
	imageID := seedMedia(q, themeID, MediaTypeImage)

	linesJSON, _ := json.Marshal([]map[string]any{
		{"Index": 0, "Type": "image", "MediaID": imageID.String(), "AdvanceBy": "gm"},
	})
	sectionID := uuid.New()
	q.sections[sectionID] = db.ReadingSection{
		ID:      sectionID,
		ThemeID: themeID,
		Name:    "Image block",
		Lines:   linesJSON,
	}

	preview, err := svc.PreviewDeleteMedia(context.Background(), creatorID, imageID)
	if err != nil {
		t.Fatalf("PreviewDeleteMedia: %v", err)
	}
	refs := preview.References
	if len(refs) != 1 || refs[0].ID != sectionID.String() || refs[0].Type != "reading_section" || refs[0].Name != "Image block" {
		t.Fatalf("unexpected references: %#v", refs)
	}
}

func TestFindMediaReferencesInReadingSections_JSONBIntegration(t *testing.T) {
	fixture := setupFixture(t)
	ctx := context.Background()
	creatorID := fixture.createUser(t)
	themeID := fixture.createThemeForUser(t, creatorID)

	voice := createMediaForReferenceTest(t, fixture.q, themeID, "Narration voice", MediaTypeVoice)
	image := createMediaForReferenceTest(t, fixture.q, themeID, "Crime scene image", MediaTypeImage)
	blockImage := createMediaForReferenceTest(t, fixture.q, themeID, "Projected image", MediaTypeImage)
	linesJSON, err := json.Marshal([]map[string]any{
		{"Index": 0, "Text": "목소리가 들린다.", "AdvanceBy": "voice", "VoiceMediaID": voice.ID.String()},
		{"Index": 1, "Text": "현장 사진을 본다.", "AdvanceBy": "gm", "ImageMediaID": image.ID.String()},
		{"Index": 2, "Type": "image", "MediaID": blockImage.ID.String(), "AdvanceBy": "gm"},
	})
	if err != nil {
		t.Fatalf("marshal lines: %v", err)
	}
	section, err := fixture.q.CreateReadingSection(ctx, db.CreateReadingSectionParams{
		ThemeID:   themeID,
		Name:      "JSONB refs",
		BgmMode:   ReadingBGMModeLoop,
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
		{name: "block image", mediaID: blockImage.ID},
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

func TestMediaSQLContract_CategoryReplacementAndReferenceCleanupIntegration(t *testing.T) {
	fixture := setupFixture(t)
	ctx := context.Background()
	creatorID := fixture.createUser(t)
	themeID := fixture.createThemeForUser(t, creatorID)

	category, err := fixture.q.CreateMediaCategory(ctx, db.CreateMediaCategoryParams{
		ThemeID:   themeID,
		Name:      "배경",
		SortOrder: 2,
		CreatorID: creatorID,
	})
	if err != nil {
		t.Fatalf("CreateMediaCategory: %v", err)
	}
	if _, err := fixture.q.GetMediaCategoryWithOwner(ctx, db.GetMediaCategoryWithOwnerParams{ID: category.ID, CreatorID: creatorID}); err != nil {
		t.Fatalf("GetMediaCategoryWithOwner: %v", err)
	}
	if _, err := fixture.q.UpdateMediaCategory(ctx, db.UpdateMediaCategoryParams{
		ID:        category.ID,
		Name:      "전경",
		SortOrder: 3,
		CreatorID: creatorID,
	}); err != nil {
		t.Fatalf("UpdateMediaCategory: %v", err)
	}
	categories, err := fixture.q.ListMediaCategoriesByTheme(ctx, themeID)
	if err != nil {
		t.Fatalf("ListMediaCategoriesByTheme: %v", err)
	}
	if len(categories) != 1 || categories[0].Name != "전경" {
		t.Fatalf("unexpected categories: %#v", categories)
	}

	image := createMediaForReferenceTest(t, fixture.q, themeID, "crime-scene", MediaTypeImage)
	bgm := createMediaForReferenceTest(t, fixture.q, themeID, "theme-bgm", MediaTypeBGM)
	updatedImage, err := fixture.q.UpdateMedia(ctx, db.UpdateMediaParams{
		ID:         image.ID,
		Name:       "사건 현장",
		Type:       MediaTypeImage,
		Duration:   pgtype.Int4{},
		Tags:       []string{"scene"},
		SortOrder:  4,
		CategoryID: pgtype.UUID{Bytes: category.ID, Valid: true},
	})
	if err != nil {
		t.Fatalf("UpdateMedia: %v", err)
	}
	if !updatedImage.CategoryID.Valid || updatedImage.CategoryID.Bytes != category.ID {
		t.Fatalf("category was not assigned: %#v", updatedImage)
	}
	if rows, err := fixture.q.ListMediaByThemeTypeAndCategory(ctx, db.ListMediaByThemeTypeAndCategoryParams{
		ThemeID:    themeID,
		Type:       MediaTypeImage,
		CategoryID: pgtype.UUID{Bytes: category.ID, Valid: true},
	}); err != nil || len(rows) != 1 || rows[0].ID != image.ID {
		t.Fatalf("ListMediaByThemeTypeAndCategory err=%v rows=%#v", err, rows)
	}
	if rows, err := fixture.q.ListMediaByThemeAndCategory(ctx, db.ListMediaByThemeAndCategoryParams{
		ThemeID:    themeID,
		CategoryID: pgtype.UUID{Bytes: category.ID, Valid: true},
	}); err != nil || len(rows) != 1 || rows[0].ID != image.ID {
		t.Fatalf("ListMediaByThemeAndCategory err=%v rows=%#v", err, rows)
	}

	pending, err := fixture.q.CreateMediaReplacementUpload(ctx, db.CreateMediaReplacementUploadParams{
		MediaID:    image.ID,
		StorageKey: "themes/" + themeID.String() + "/media/replacement.png",
		FileSize:   8,
		MimeType:   "image/png",
		CreatorID:  creatorID,
	})
	if err != nil {
		t.Fatalf("CreateMediaReplacementUpload: %v", err)
	}
	if got, err := fixture.q.GetMediaReplacementUploadWithOwner(ctx, db.GetMediaReplacementUploadWithOwnerParams{
		ID:        pending.ID,
		CreatorID: creatorID,
	}); err != nil || got.MediaID != image.ID {
		t.Fatalf("GetMediaReplacementUploadWithOwner err=%v got=%#v", err, got)
	}
	fileUpdated, err := fixture.q.UpdateMediaFileWithOwner(ctx, db.UpdateMediaFileWithOwnerParams{
		ID:         image.ID,
		CreatorID:  creatorID,
		StorageKey: pgtype.Text{String: pending.StorageKey, Valid: true},
		FileSize:   pgtype.Int8{Int64: pending.FileSize, Valid: true},
		MimeType:   pgtype.Text{String: pending.MimeType, Valid: true},
	})
	if err != nil {
		t.Fatalf("UpdateMediaFileWithOwner: %v", err)
	}
	if !fileUpdated.StorageKey.Valid || fileUpdated.StorageKey.String != pending.StorageKey || fileUpdated.Url.Valid {
		t.Fatalf("unexpected updated file media: %#v", fileUpdated)
	}
	if err := fixture.q.DeleteMediaReplacementUpload(ctx, pending.ID); err != nil {
		t.Fatalf("DeleteMediaReplacementUpload: %v", err)
	}

	section, err := fixture.q.CreateReadingSection(ctx, db.CreateReadingSectionParams{
		ThemeID:    themeID,
		Name:       "참조 읽기",
		BgmMediaID: pgtype.UUID{Bytes: bgm.ID, Valid: true},
		BgmMode:    ReadingBGMModeLoop,
		Lines:      json.RawMessage(fmt.Sprintf(`[{"Text":"사진","ImageMediaID":%q,"VoiceMediaID":%q}]`, image.ID.String(), image.ID.String())),
		SortOrder:  1,
	})
	if err != nil {
		t.Fatalf("CreateReadingSection: %v", err)
	}
	if refs, err := fixture.q.FindMediaReferencesInReadingSections(ctx, db.FindMediaReferencesInReadingSectionsParams{
		ThemeID: themeID,
		MediaID: image.ID,
	}); err != nil || len(refs) != 1 || refs[0].ID != section.ID {
		t.Fatalf("FindMediaReferencesInReadingSections image err=%v refs=%#v", err, refs)
	}
	if rows, err := fixture.q.ClearReadingSectionMediaReferencesWithOwner(ctx, db.ClearReadingSectionMediaReferencesWithOwnerParams{
		MediaID:   image.ID,
		CreatorID: creatorID,
		ThemeID:   themeID,
	}); err != nil || rows != 1 {
		t.Fatalf("ClearReadingSectionMediaReferencesWithOwner image rows=%d err=%v", rows, err)
	}

	if _, err := fixture.q.CreateMap(ctx, db.CreateMapParams{
		ThemeID:      themeID,
		Name:         "지도",
		ImageMediaID: pgtype.UUID{Bytes: image.ID, Valid: true},
		SortOrder:    1,
	}); err != nil {
		t.Fatalf("CreateMap: %v", err)
	}
	if refs, err := fixture.q.FindMapReferencesForMedia(ctx, db.FindMapReferencesForMediaParams{
		ThemeID: themeID,
		MediaID: pgtype.UUID{Bytes: image.ID, Valid: true},
	}); err != nil || len(refs) != 1 || refs[0].Name != "지도" {
		t.Fatalf("FindMapReferencesForMedia err=%v refs=%#v", err, refs)
	}
	if rows, err := fixture.q.ClearMapMediaReferencesWithOwner(ctx, db.ClearMapMediaReferencesWithOwnerParams{
		CreatorID: creatorID,
		ThemeID:   themeID,
		MediaID:   pgtype.UUID{Bytes: image.ID, Valid: true},
	}); err != nil || rows != 1 {
		t.Fatalf("ClearMapMediaReferencesWithOwner rows=%d err=%v", rows, err)
	}

	theme, err := fixture.q.GetTheme(ctx, themeID)
	if err != nil {
		t.Fatalf("GetTheme: %v", err)
	}
	if _, err := fixture.q.UpdateTheme(ctx, db.UpdateThemeParams{
		ID:                themeID,
		Title:             theme.Title,
		Slug:              theme.Slug,
		Description:       theme.Description,
		CoverImage:        theme.CoverImage,
		CoverImageMediaID: pgtype.UUID{Bytes: image.ID, Valid: true},
		MinPlayers:        theme.MinPlayers,
		MaxPlayers:        theme.MaxPlayers,
		DurationMin:       theme.DurationMin,
		Price:             theme.Price,
		CoinPrice:         theme.CoinPrice,
		Version:           theme.Version,
	}); err != nil {
		t.Fatalf("UpdateTheme cover media: %v", err)
	}
	if refs, err := fixture.q.FindThemeCoverReferencesForMedia(ctx, db.FindThemeCoverReferencesForMediaParams{
		ThemeID: themeID,
		MediaID: pgtype.UUID{Bytes: image.ID, Valid: true},
	}); err != nil || len(refs) != 1 {
		t.Fatalf("FindThemeCoverReferencesForMedia err=%v refs=%#v", err, refs)
	}
	if rows, err := fixture.q.ClearThemeCoverMediaReferencesWithOwner(ctx, db.ClearThemeCoverMediaReferencesWithOwnerParams{
		ThemeID:   themeID,
		CreatorID: creatorID,
		MediaID:   pgtype.UUID{Bytes: image.ID, Valid: true},
	}); err != nil || rows != 1 {
		t.Fatalf("ClearThemeCoverMediaReferencesWithOwner rows=%d err=%v", rows, err)
	}

	if _, err := fixture.q.UpsertContent(ctx, db.UpsertContentParams{
		ThemeID: themeID,
		Key:     "role_sheet:detective",
		Body:    fmt.Sprintf(`{"version":1,"format":"markdown","markdown":{"body":"사진 <MediaEmbed mediaId=\"%s\" type=\"image\" />"},"portrait":{"media_id":"%s"},"images":{"image_media_ids":["%s"]}}`, image.ID.String(), image.ID.String(), image.ID.String()),
	}); err != nil {
		t.Fatalf("UpsertContent role sheet: %v", err)
	}
	if refs, err := fixture.q.FindRoleSheetReferencesForMedia(ctx, db.FindRoleSheetReferencesForMediaParams{
		ThemeID: themeID,
		Body:    image.ID.String(),
	}); err != nil || len(refs) != 1 || refs[0].Key != "role_sheet:detective" {
		t.Fatalf("FindRoleSheetReferencesForMedia err=%v refs=%#v", err, refs)
	}
	if rows, err := fixture.q.ClearRoleSheetMediaReferencesWithOwner(ctx, db.ClearRoleSheetMediaReferencesWithOwnerParams{
		MediaID:   image.ID.String(),
		CreatorID: creatorID,
		ThemeID:   themeID,
	}); err != nil || rows != 1 {
		t.Fatalf("ClearRoleSheetMediaReferencesWithOwner rows=%d err=%v", rows, err)
	}
	cleanedRoleSheet, err := fixture.q.GetContent(ctx, db.GetContentParams{ThemeID: themeID, Key: "role_sheet:detective"})
	if err != nil {
		t.Fatalf("GetContent cleaned role sheet: %v", err)
	}
	if strings.Contains(cleanedRoleSheet.Body, image.ID.String()) || strings.Contains(cleanedRoleSheet.Body, "<MediaEmbed") {
		t.Fatalf("role sheet media refs should be cleaned: %s", cleanedRoleSheet.Body)
	}
	if !strings.Contains(cleanedRoleSheet.Body, `"image_media_ids": []`) || !strings.Contains(cleanedRoleSheet.Body, `"media_id": null`) {
		t.Fatalf("role sheet PDF/image references should be nulled/emptied: %s", cleanedRoleSheet.Body)
	}

	info, err := fixture.q.CreateStoryInfo(ctx, db.CreateStoryInfoParams{
		ThemeID:             themeID,
		Title:               "현장 정보",
		Body:                fmt.Sprintf(`사진 전 <MediaEmbed mediaId="%s" type="image" /> 사진 후`, image.ID.String()),
		ContentFormat:       StoryInfoContentFormatMDXV1,
		ImageMediaID:        pgtype.UUID{Bytes: image.ID, Valid: true},
		RelatedCharacterIds: json.RawMessage(`[]`),
		RelatedClueIds:      json.RawMessage(`[]`),
		RelatedLocationIds:  json.RawMessage(`[]`),
		SortOrder:           1,
		CreatorID:           creatorID,
	})
	if err != nil {
		t.Fatalf("CreateStoryInfo: %v", err)
	}
	if err := fixture.q.CreateStoryInfoMediaRef(ctx, db.CreateStoryInfoMediaRefParams{
		StoryInfoID: info.ID,
		MediaID:     image.ID,
		Usage:       "cover",
		SortOrder:   0,
	}); err != nil {
		t.Fatalf("CreateStoryInfoMediaRef cover: %v", err)
	}
	if err := fixture.q.CreateStoryInfoMediaRef(ctx, db.CreateStoryInfoMediaRefParams{
		StoryInfoID: info.ID,
		MediaID:     image.ID,
		Usage:       "embedded_image",
		SortOrder:   1,
	}); err != nil {
		t.Fatalf("CreateStoryInfoMediaRef embedded: %v", err)
	}
	if refs, err := fixture.q.FindStoryInfoReferencesForMedia(ctx, db.FindStoryInfoReferencesForMediaParams{
		ThemeID: themeID,
		MediaID: image.ID,
	}); err != nil || len(refs) != 2 || refs[0].Title != "현장 정보" {
		t.Fatalf("FindStoryInfoReferencesForMedia err=%v refs=%#v", err, refs)
	}
	if rows, err := fixture.q.ClearStoryInfoMediaReferencesWithOwner(ctx, db.ClearStoryInfoMediaReferencesWithOwnerParams{
		MediaID:   image.ID,
		CreatorID: creatorID,
		ThemeID:   themeID,
	}); err != nil || rows != 1 {
		t.Fatalf("ClearStoryInfoMediaReferencesWithOwner rows=%d err=%v", rows, err)
	}
	if rows, err := fixture.q.DeleteStoryInfoMediaRefsForMediaWithOwner(ctx, db.DeleteStoryInfoMediaRefsForMediaWithOwnerParams{
		MediaID:   image.ID,
		CreatorID: creatorID,
		ThemeID:   themeID,
	}); err != nil || rows != 2 {
		t.Fatalf("DeleteStoryInfoMediaRefsForMediaWithOwner rows=%d err=%v", rows, err)
	}
	var cleanedBody string
	var cleanedImageID pgtype.UUID
	var cleanedVersion int32
	if err := fixture.pool.QueryRow(ctx, `
		SELECT body, image_media_id, version
		FROM story_infos
		WHERE id = $1
	`, info.ID).Scan(&cleanedBody, &cleanedImageID, &cleanedVersion); err != nil {
		t.Fatalf("select cleaned story_info: %v", err)
	}
	if cleanedImageID.Valid {
		t.Fatalf("story info image media id should be cleared")
	}
	if strings.Contains(cleanedBody, image.ID.String()) || strings.Contains(cleanedBody, "MediaEmbed") {
		t.Fatalf("story info body media embed should be removed: %s", cleanedBody)
	}
	if cleanedVersion != info.Version+1 {
		t.Fatalf("story info version = %d, want %d", cleanedVersion, info.Version+1)
	}
	if refs, err := fixture.q.FindStoryInfoReferencesForMedia(ctx, db.FindStoryInfoReferencesForMediaParams{
		ThemeID: themeID,
		MediaID: image.ID,
	}); err != nil || len(refs) != 0 {
		t.Fatalf("FindStoryInfoReferencesForMedia after cleanup err=%v refs=%#v", err, refs)
	}

	orphanCoverInfo, err := fixture.q.CreateStoryInfo(ctx, db.CreateStoryInfoParams{
		ThemeID:             themeID,
		Title:               "누락된 커버 참조 정보",
		Body:                `커버 이미지만 있는 정보`,
		ContentFormat:       StoryInfoContentFormatMDXV1,
		ImageMediaID:        pgtype.UUID{Bytes: image.ID, Valid: true},
		RelatedCharacterIds: json.RawMessage(`[]`),
		RelatedClueIds:      json.RawMessage(`[]`),
		RelatedLocationIds:  json.RawMessage(`[]`),
		SortOrder:           2,
		CreatorID:           creatorID,
	})
	if err != nil {
		t.Fatalf("CreateStoryInfo orphan cover: %v", err)
	}
	if refs, err := fixture.q.FindStoryInfoReferencesForMedia(ctx, db.FindStoryInfoReferencesForMediaParams{
		ThemeID: themeID,
		MediaID: image.ID,
	}); err != nil || len(refs) != 1 || refs[0].ID != orphanCoverInfo.ID || refs[0].Usage != "cover" {
		t.Fatalf("FindStoryInfoReferencesForMedia orphan cover err=%v refs=%#v", err, refs)
	}
	if rows, err := fixture.q.ClearStoryInfoMediaReferencesWithOwner(ctx, db.ClearStoryInfoMediaReferencesWithOwnerParams{
		MediaID:   image.ID,
		CreatorID: creatorID,
		ThemeID:   themeID,
	}); err != nil || rows != 1 {
		t.Fatalf("ClearStoryInfoMediaReferencesWithOwner orphan cover rows=%d err=%v", rows, err)
	}
	var orphanCoverImageID pgtype.UUID
	var orphanCoverVersion int32
	if err := fixture.pool.QueryRow(ctx, `
		SELECT image_media_id, version
		FROM story_infos
		WHERE id = $1
	`, orphanCoverInfo.ID).Scan(&orphanCoverImageID, &orphanCoverVersion); err != nil {
		t.Fatalf("select orphan cover story_info: %v", err)
	}
	if orphanCoverImageID.Valid {
		t.Fatalf("orphan cover story info image media id should be cleared")
	}
	if orphanCoverVersion != orphanCoverInfo.Version+1 {
		t.Fatalf("orphan cover story info version = %d, want %d", orphanCoverVersion, orphanCoverInfo.Version+1)
	}

	orphanInfo, err := fixture.q.CreateStoryInfo(ctx, db.CreateStoryInfoParams{
		ThemeID:             themeID,
		Title:               "누락된 참조 정보",
		Body:                fmt.Sprintf(`본문 <MediaEmbed type="image" mediaId="%s" /> 끝`, image.ID.String()),
		ContentFormat:       StoryInfoContentFormatMDXV1,
		ImageMediaID:        pgtype.UUID{},
		RelatedCharacterIds: json.RawMessage(`[]`),
		RelatedClueIds:      json.RawMessage(`[]`),
		RelatedLocationIds:  json.RawMessage(`[]`),
		SortOrder:           2,
		CreatorID:           creatorID,
	})
	if err != nil {
		t.Fatalf("CreateStoryInfo orphan: %v", err)
	}
	if refs, err := fixture.q.FindStoryInfoReferencesForMedia(ctx, db.FindStoryInfoReferencesForMediaParams{
		ThemeID: themeID,
		MediaID: image.ID,
	}); err != nil || len(refs) != 1 || refs[0].ID != orphanInfo.ID || refs[0].Usage != "embedded_image" {
		t.Fatalf("FindStoryInfoReferencesForMedia orphan embed err=%v refs=%#v", err, refs)
	}
	if rows, err := fixture.q.ClearStoryInfoMediaReferencesWithOwner(ctx, db.ClearStoryInfoMediaReferencesWithOwnerParams{
		MediaID:   image.ID,
		CreatorID: creatorID,
		ThemeID:   themeID,
	}); err != nil || rows != 1 {
		t.Fatalf("ClearStoryInfoMediaReferencesWithOwner orphan rows=%d err=%v", rows, err)
	}
	if rows, err := fixture.q.DeleteStoryInfoMediaRefsForMediaWithOwner(ctx, db.DeleteStoryInfoMediaRefsForMediaWithOwnerParams{
		MediaID:   image.ID,
		CreatorID: creatorID,
		ThemeID:   themeID,
	}); err != nil || rows != 0 {
		t.Fatalf("DeleteStoryInfoMediaRefsForMediaWithOwner orphan rows=%d err=%v", rows, err)
	}
	var orphanBody string
	var orphanVersion int32
	if err := fixture.pool.QueryRow(ctx, `
		SELECT body, version
		FROM story_infos
		WHERE id = $1
	`, orphanInfo.ID).Scan(&orphanBody, &orphanVersion); err != nil {
		t.Fatalf("select orphan story_info: %v", err)
	}
	if strings.Contains(orphanBody, image.ID.String()) || strings.Contains(orphanBody, "MediaEmbed") {
		t.Fatalf("orphan story info body media embed should be removed: %s", orphanBody)
	}
	if orphanVersion != orphanInfo.Version+1 {
		t.Fatalf("orphan story info version = %d, want %d", orphanVersion, orphanInfo.Version+1)
	}

	if rows, err := fixture.q.DeleteMediaCategoryWithOwner(ctx, db.DeleteMediaCategoryWithOwnerParams{ID: category.ID, CreatorID: creatorID}); err != nil || rows != 1 {
		t.Fatalf("DeleteMediaCategoryWithOwner rows=%d err=%v", rows, err)
	}
	if rows, err := fixture.q.DeleteMediaWithOwner(ctx, db.DeleteMediaWithOwnerParams{ID: image.ID, CreatorID: creatorID}); err != nil || rows != 1 {
		t.Fatalf("DeleteMediaWithOwner rows=%d err=%v", rows, err)
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

	if err := svc.DeleteMedia(context.Background(), creatorID, mediaID, DeleteMediaOptions{}); err != nil {
		t.Fatalf("expected delete to succeed, got %v", err)
	}
	if _, ok := q.media[mediaID]; ok {
		t.Fatalf("media should have been deleted")
	}
}

func TestMediaService_Delete_BlocksReferencesUntilDetachRequested(t *testing.T) {
	svc, q, creatorID, themeID := newMediaTestService(t)
	mediaID := seedMedia(q, themeID, MediaTypeImage)
	clueID := uuid.New()
	q.clues[clueID] = db.ThemeClue{
		ID:           clueID,
		ThemeID:      themeID,
		Name:         "1층 단서",
		ImageMediaID: pgtype.UUID{Bytes: mediaID, Valid: true},
	}

	err := svc.DeleteMedia(context.Background(), creatorID, mediaID, DeleteMediaOptions{})
	assertMediaAppCode(t, err, apperror.ErrMediaReferenceInUse)
	if _, ok := q.media[mediaID]; !ok {
		t.Fatalf("media should remain when references are not detached")
	}
	if !q.clues[clueID].ImageMediaID.Valid {
		t.Fatalf("clue image reference should remain on blocked delete")
	}

	if err := svc.DeleteMedia(context.Background(), creatorID, mediaID, DeleteMediaOptions{DetachReferences: true}); err != nil {
		t.Fatalf("DeleteMedia with detach: %v", err)
	}
	if _, ok := q.media[mediaID]; ok {
		t.Fatalf("media should be deleted after detach")
	}
	if q.clues[clueID].ImageMediaID.Valid {
		t.Fatalf("clue image reference should be cleared")
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

func TestMediaService_PreviewDelete_ReportsEntityImageReferences(t *testing.T) {
	svc, q, creatorID, themeID := newMediaTestService(t)
	mediaID := seedMedia(q, themeID, MediaTypeImage)
	clueID := uuid.New()
	locationID := uuid.New()
	characterID := uuid.New()
	q.clues[clueID] = db.ThemeClue{
		ID:           clueID,
		ThemeID:      themeID,
		Name:         "우비 및 우산걸이",
		ImageMediaID: pgtype.UUID{Bytes: mediaID, Valid: true},
	}
	q.locations[locationID] = db.ThemeLocation{
		ID:           locationID,
		ThemeID:      themeID,
		Name:         "1층",
		ImageMediaID: pgtype.UUID{Bytes: mediaID, Valid: true},
	}
	q.characters[characterID] = db.ThemeCharacter{
		ID:                  characterID,
		ThemeID:             themeID,
		Name:                "고동",
		ImageMediaID:        pgtype.UUID{Bytes: mediaID, Valid: true},
		EndcardImageMediaID: pgtype.UUID{Bytes: mediaID, Valid: true},
	}

	preview, err := svc.PreviewDeleteMedia(context.Background(), creatorID, mediaID)
	if err != nil {
		t.Fatalf("PreviewDeleteMedia: %v", err)
	}
	refs := preview.References
	if len(refs) != 4 {
		t.Fatalf("expected four entity references, got %#v", refs)
	}
	gotTypes := map[string]bool{}
	for _, ref := range refs {
		gotTypes[ref.Type] = true
	}
	for _, wantType := range []string{"clue_image", "location_image", "character_image", "character_endcard_image"} {
		if !gotTypes[wantType] {
			t.Fatalf("missing reference type %s in %#v", wantType, refs)
		}
	}
}

func TestMediaService_PreviewDelete_ReportsStoryInfoReference(t *testing.T) {
	svc, q, creatorID, themeID := newMediaTestService(t)
	mediaID := seedMedia(q, themeID, MediaTypeImage)
	infoID := uuid.New()
	q.storyInfoRefs[mediaID] = []db.FindStoryInfoReferencesForMediaRow{
		{ID: infoID, Title: "사건 현장 정보", Usage: "embedded_image"},
	}

	preview, err := svc.PreviewDeleteMedia(context.Background(), creatorID, mediaID)
	if err != nil {
		t.Fatalf("PreviewDeleteMedia: %v", err)
	}
	refs := preview.References
	if len(refs) != 1 || refs[0].Type != "story_info_embedded_image" || refs[0].ID != infoID.String() || refs[0].Name != "사건 현장 정보" {
		t.Fatalf("unexpected story info references: %#v", refs)
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

func TestMediaService_PreviewDelete_ReportsRoleSheetImagePageReference(t *testing.T) {
	svc, q, creatorID, themeID := newMediaTestService(t)
	mediaID := seedMedia(q, themeID, MediaTypeImage)
	q.roleSheetRefs[mediaID] = []db.FindRoleSheetReferencesForMediaRow{
		{ID: uuid.New(), Key: "role_sheet:char-1", Body: fmt.Sprintf(`{"format":"images","images":{"image_media_ids":["%s"]}}`, mediaID.String())},
	}

	preview, err := svc.PreviewDeleteMedia(context.Background(), creatorID, mediaID)
	if err != nil {
		t.Fatalf("PreviewDeleteMedia: %v", err)
	}
	refs := preview.References
	if len(refs) != 1 || refs[0].Type != "role_sheet_image_page" || refs[0].ID != "role_sheet:char-1" {
		t.Fatalf("unexpected role sheet image references: %#v", refs)
	}
}

func roleSheetEmbedBody(mediaID uuid.UUID, embedTyp string) string {
	if embedTyp == "" {
		return fmt.Sprintf(`{"format":"markdown","markdown":{"body":"증거 <MediaEmbed mediaId=\"%s\" />"}}`, mediaID.String())
	}
	return fmt.Sprintf(`{"format":"markdown","markdown":{"body":"증거 <MediaEmbed mediaId=\"%s\" type=\"%s\" />"}}`, mediaID.String(), embedTyp)
}

func TestMediaService_PreviewDelete_ReportsRoleSheetEmbeddedMediaReferences(t *testing.T) {
	for _, tc := range []struct {
		name     string
		mediaTyp string
		embedTyp string
		wantTyp  string
	}{
		{name: "image", mediaTyp: MediaTypeImage, embedTyp: "image", wantTyp: "role_sheet_embedded_image"},
		{name: "video", mediaTyp: MediaTypeVideo, embedTyp: "video", wantTyp: "role_sheet_embedded_video"},
		{name: "video without explicit embed type", mediaTyp: MediaTypeVideo, embedTyp: "", wantTyp: "role_sheet_embedded_video"},
		{name: "unknown embed type", mediaTyp: MediaTypeImage, embedTyp: "audio", wantTyp: "role_sheet"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			svc, q, creatorID, themeID := newMediaTestService(t)
			mediaID := seedMedia(q, themeID, tc.mediaTyp)
			q.roleSheetRefs[mediaID] = []db.FindRoleSheetReferencesForMediaRow{
				{
					ID:   uuid.New(),
					Key:  "role_sheet:char-1",
					Body: roleSheetEmbedBody(mediaID, tc.embedTyp),
				},
			}

			preview, err := svc.PreviewDeleteMedia(context.Background(), creatorID, mediaID)
			if err != nil {
				t.Fatalf("PreviewDeleteMedia: %v", err)
			}
			refs := preview.References
			if len(refs) != 1 || refs[0].Type != tc.wantTyp || refs[0].ID != "role_sheet:char-1" {
				t.Fatalf("unexpected role sheet embedded references: %#v", refs)
			}
		})
	}
}

func TestMediaService_PreviewDelete_ReportsCharacterAliasIconReference(t *testing.T) {
	svc, q, creatorID, themeID := newMediaTestService(t)
	mediaID := seedMedia(q, themeID, MediaTypeImage)
	charID := uuid.New()
	q.aliasIconRefs[mediaID] = []db.FindCharacterAliasIconReferencesForMediaRow{
		{ID: charID, Name: "밤의 목격자"},
	}

	preview, err := svc.PreviewDeleteMedia(context.Background(), creatorID, mediaID)
	if err != nil {
		t.Fatalf("PreviewDeleteMedia: %v", err)
	}
	refs := preview.References
	if len(refs) != 1 || refs[0].Type != "character_alias_icon" || refs[0].ID != charID.String() || refs[0].Name != "밤의 목격자" {
		t.Fatalf("unexpected character alias icon references: %#v", refs)
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

	err := svc.DeleteMedia(context.Background(), creatorID, mediaID, DeleteMediaOptions{})
	assertMediaAppCode(t, err, apperror.ErrValidation)
	if _, ok := q.media[mediaID]; !ok {
		t.Fatalf("media should not have been deleted")
	}
}

func TestMediaService_CollectMediaReferences_QueryErrorsReturnInternal(t *testing.T) {
	tests := []struct {
		name string
		mock func(*MockmediaQueries, uuid.UUID, uuid.UUID)
	}{
		{
			name: "reading sections",
			mock: func(q *MockmediaQueries, _ uuid.UUID, _ uuid.UUID) {
				q.EXPECT().FindMediaReferencesInReadingSections(gomock.Any(), gomock.Any()).Return(nil, errors.New("db down"))
			},
		},
		{
			name: "theme cover",
			mock: func(q *MockmediaQueries, _ uuid.UUID, _ uuid.UUID) {
				q.EXPECT().FindMediaReferencesInReadingSections(gomock.Any(), gomock.Any()).Return(nil, nil)
				q.EXPECT().FindThemeCoverReferencesForMedia(gomock.Any(), gomock.Any()).Return(nil, errors.New("db down"))
			},
		},
		{
			name: "map",
			mock: func(q *MockmediaQueries, _ uuid.UUID, _ uuid.UUID) {
				q.EXPECT().FindMediaReferencesInReadingSections(gomock.Any(), gomock.Any()).Return(nil, nil)
				q.EXPECT().FindThemeCoverReferencesForMedia(gomock.Any(), gomock.Any()).Return(nil, nil)
				q.EXPECT().FindMapReferencesForMedia(gomock.Any(), gomock.Any()).Return(nil, errors.New("db down"))
			},
		},
		{
			name: "role sheet",
			mock: func(q *MockmediaQueries, _ uuid.UUID, _ uuid.UUID) {
				q.EXPECT().FindMediaReferencesInReadingSections(gomock.Any(), gomock.Any()).Return(nil, nil)
				q.EXPECT().FindThemeCoverReferencesForMedia(gomock.Any(), gomock.Any()).Return(nil, nil)
				q.EXPECT().FindMapReferencesForMedia(gomock.Any(), gomock.Any()).Return(nil, nil)
				q.EXPECT().FindClueReferencesForMedia(gomock.Any(), gomock.Any()).Return(nil, nil)
				q.EXPECT().FindLocationReferencesForMedia(gomock.Any(), gomock.Any()).Return(nil, nil)
				q.EXPECT().FindCharacterImageReferencesForMedia(gomock.Any(), gomock.Any()).Return(nil, nil)
				q.EXPECT().FindStoryInfoReferencesForMedia(gomock.Any(), gomock.Any()).Return(nil, nil)
				q.EXPECT().FindRoleSheetReferencesForMedia(gomock.Any(), gomock.Any()).Return(nil, errors.New("db down"))
			},
		},
		{
			name: "story info",
			mock: func(q *MockmediaQueries, _ uuid.UUID, _ uuid.UUID) {
				q.EXPECT().FindMediaReferencesInReadingSections(gomock.Any(), gomock.Any()).Return(nil, nil)
				q.EXPECT().FindThemeCoverReferencesForMedia(gomock.Any(), gomock.Any()).Return(nil, nil)
				q.EXPECT().FindMapReferencesForMedia(gomock.Any(), gomock.Any()).Return(nil, nil)
				q.EXPECT().FindClueReferencesForMedia(gomock.Any(), gomock.Any()).Return(nil, nil)
				q.EXPECT().FindLocationReferencesForMedia(gomock.Any(), gomock.Any()).Return(nil, nil)
				q.EXPECT().FindCharacterImageReferencesForMedia(gomock.Any(), gomock.Any()).Return(nil, nil)
				q.EXPECT().FindStoryInfoReferencesForMedia(gomock.Any(), gomock.Any()).Return(nil, errors.New("db down"))
			},
		},
		{
			name: "theme config",
			mock: func(q *MockmediaQueries, themeID uuid.UUID, _ uuid.UUID) {
				q.EXPECT().FindMediaReferencesInReadingSections(gomock.Any(), gomock.Any()).Return(nil, nil)
				q.EXPECT().FindThemeCoverReferencesForMedia(gomock.Any(), gomock.Any()).Return(nil, nil)
				q.EXPECT().FindMapReferencesForMedia(gomock.Any(), gomock.Any()).Return(nil, nil)
				q.EXPECT().FindClueReferencesForMedia(gomock.Any(), gomock.Any()).Return(nil, nil)
				q.EXPECT().FindLocationReferencesForMedia(gomock.Any(), gomock.Any()).Return(nil, nil)
				q.EXPECT().FindCharacterImageReferencesForMedia(gomock.Any(), gomock.Any()).Return(nil, nil)
				q.EXPECT().FindStoryInfoReferencesForMedia(gomock.Any(), gomock.Any()).Return(nil, nil)
				q.EXPECT().FindRoleSheetReferencesForMedia(gomock.Any(), gomock.Any()).Return(nil, nil)
				q.EXPECT().FindCharacterAliasIconReferencesForMedia(gomock.Any(), gomock.Any()).Return(nil, nil)
				q.EXPECT().GetTheme(gomock.Any(), themeID).Return(db.Theme{}, errors.New("db down"))
			},
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			ctrl := gomock.NewController(t)
			q := NewMockmediaQueries(ctrl)
			themeID := uuid.New()
			mediaID := uuid.New()
			tt.mock(q, themeID, mediaID)
			svc := newMediaServiceWith(q, nil, zerolog.Nop())

			_, err := svc.collectMediaReferencesWithQueries(context.Background(), q, db.ThemeMedium{ID: mediaID, ThemeID: themeID}, mediaID)

			assertMediaAppCode(t, err, apperror.ErrInternal)
		})
	}
}

func TestMediaService_CleanupMediaReferences_QueryErrorsReturnInternal(t *testing.T) {
	tests := []struct {
		name string
		mock func(*MockmediaQueries, uuid.UUID, uuid.UUID)
	}{
		{
			name: "clear reading section",
			mock: func(q *MockmediaQueries, themeID uuid.UUID, mediaID uuid.UUID) {
				expectEmptyMediaReferenceCollection(q, themeID)
				q.EXPECT().ClearReadingSectionMediaReferencesWithOwner(gomock.Any(), gomock.Any()).Return(int64(0), errors.New("db down"))
				_ = mediaID
			},
		},
		{
			name: "clear role sheet",
			mock: func(q *MockmediaQueries, themeID uuid.UUID, mediaID uuid.UUID) {
				expectEmptyMediaReferenceCollection(q, themeID)
				q.EXPECT().ClearReadingSectionMediaReferencesWithOwner(gomock.Any(), gomock.Any()).Return(int64(0), nil)
				q.EXPECT().ClearRoleSheetMediaReferencesWithOwner(gomock.Any(), gomock.Any()).Return(int64(0), errors.New("db down"))
				_ = mediaID
			},
		},
		{
			name: "clear theme cover",
			mock: func(q *MockmediaQueries, themeID uuid.UUID, mediaID uuid.UUID) {
				expectEmptyMediaReferenceCollection(q, themeID)
				q.EXPECT().ClearReadingSectionMediaReferencesWithOwner(gomock.Any(), gomock.Any()).Return(int64(0), nil)
				q.EXPECT().ClearRoleSheetMediaReferencesWithOwner(gomock.Any(), gomock.Any()).Return(int64(0), nil)
				q.EXPECT().ClearCharacterAliasIconMediaReferencesWithOwner(gomock.Any(), gomock.Any()).Return(int64(0), nil)
				q.EXPECT().ClearCharacterImageMediaReferencesWithOwner(gomock.Any(), gomock.Any()).Return(int64(0), nil)
				q.EXPECT().ClearThemeCoverMediaReferencesWithOwner(gomock.Any(), gomock.Any()).Return(int64(0), errors.New("db down"))
				_ = mediaID
			},
		},
		{
			name: "clear map",
			mock: func(q *MockmediaQueries, themeID uuid.UUID, mediaID uuid.UUID) {
				expectEmptyMediaReferenceCollection(q, themeID)
				q.EXPECT().ClearReadingSectionMediaReferencesWithOwner(gomock.Any(), gomock.Any()).Return(int64(0), nil)
				q.EXPECT().ClearRoleSheetMediaReferencesWithOwner(gomock.Any(), gomock.Any()).Return(int64(0), nil)
				q.EXPECT().ClearCharacterAliasIconMediaReferencesWithOwner(gomock.Any(), gomock.Any()).Return(int64(0), nil)
				q.EXPECT().ClearCharacterImageMediaReferencesWithOwner(gomock.Any(), gomock.Any()).Return(int64(0), nil)
				q.EXPECT().ClearThemeCoverMediaReferencesWithOwner(gomock.Any(), gomock.Any()).Return(int64(0), nil)
				q.EXPECT().ClearMapMediaReferencesWithOwner(gomock.Any(), gomock.Any()).Return(int64(0), errors.New("db down"))
				_ = mediaID
			},
		},
		{
			name: "load theme for config cleanup",
			mock: func(q *MockmediaQueries, themeID uuid.UUID, mediaID uuid.UUID) {
				expectEmptyMediaReferenceCollection(q, themeID)
				expectSuccessfulMediaReferenceClears(q)
				q.EXPECT().GetTheme(gomock.Any(), themeID).Return(db.Theme{}, errors.New("db down"))
				_ = mediaID
			},
		},
		{
			name: "persist cleaned config",
			mock: func(q *MockmediaQueries, themeID uuid.UUID, mediaID uuid.UUID) {
				cfg := json.RawMessage(fmt.Sprintf(`{
					"phases": [{"id": "opening", "onEnter": [{"params": {"mediaId": %q}}]}],
					"modules": {}
				}`, mediaID.String()))
				expectEmptyMediaReferenceCollectionWithConfig(q, themeID, cfg)
				expectSuccessfulMediaReferenceClears(q)
				q.EXPECT().GetTheme(gomock.Any(), themeID).Return(db.Theme{ID: themeID, ConfigJson: cfg}, nil)
				q.EXPECT().UpdateThemeConfigJsonWithOwner(gomock.Any(), gomock.Any()).Return(db.Theme{}, errors.New("db down"))
			},
		},
		{
			name: "clear story info",
			mock: func(q *MockmediaQueries, themeID uuid.UUID, mediaID uuid.UUID) {
				expectEmptyMediaReferenceCollection(q, themeID)
				q.EXPECT().ClearReadingSectionMediaReferencesWithOwner(gomock.Any(), gomock.Any()).Return(int64(0), nil)
				q.EXPECT().ClearRoleSheetMediaReferencesWithOwner(gomock.Any(), gomock.Any()).Return(int64(0), nil)
				q.EXPECT().ClearCharacterAliasIconMediaReferencesWithOwner(gomock.Any(), gomock.Any()).Return(int64(0), nil)
				q.EXPECT().ClearCharacterImageMediaReferencesWithOwner(gomock.Any(), gomock.Any()).Return(int64(0), nil)
				q.EXPECT().ClearThemeCoverMediaReferencesWithOwner(gomock.Any(), gomock.Any()).Return(int64(0), nil)
				q.EXPECT().ClearMapMediaReferencesWithOwner(gomock.Any(), gomock.Any()).Return(int64(0), nil)
				q.EXPECT().ClearClueMediaReferencesWithOwner(gomock.Any(), gomock.Any()).Return(int64(0), nil)
				q.EXPECT().ClearLocationMediaReferencesWithOwner(gomock.Any(), gomock.Any()).Return(int64(0), nil)
				q.EXPECT().ClearStoryInfoMediaReferencesWithOwner(gomock.Any(), gomock.Any()).Return(int64(0), errors.New("db down"))
				_ = mediaID
			},
		},
		{
			name: "delete story info refs",
			mock: func(q *MockmediaQueries, themeID uuid.UUID, mediaID uuid.UUID) {
				expectEmptyMediaReferenceCollection(q, themeID)
				q.EXPECT().ClearReadingSectionMediaReferencesWithOwner(gomock.Any(), gomock.Any()).Return(int64(0), nil)
				q.EXPECT().ClearRoleSheetMediaReferencesWithOwner(gomock.Any(), gomock.Any()).Return(int64(0), nil)
				q.EXPECT().ClearCharacterAliasIconMediaReferencesWithOwner(gomock.Any(), gomock.Any()).Return(int64(0), nil)
				q.EXPECT().ClearCharacterImageMediaReferencesWithOwner(gomock.Any(), gomock.Any()).Return(int64(0), nil)
				q.EXPECT().ClearThemeCoverMediaReferencesWithOwner(gomock.Any(), gomock.Any()).Return(int64(0), nil)
				q.EXPECT().ClearMapMediaReferencesWithOwner(gomock.Any(), gomock.Any()).Return(int64(0), nil)
				q.EXPECT().ClearClueMediaReferencesWithOwner(gomock.Any(), gomock.Any()).Return(int64(0), nil)
				q.EXPECT().ClearLocationMediaReferencesWithOwner(gomock.Any(), gomock.Any()).Return(int64(0), nil)
				q.EXPECT().ClearStoryInfoMediaReferencesWithOwner(gomock.Any(), gomock.Any()).Return(int64(0), nil)
				q.EXPECT().DeleteStoryInfoMediaRefsForMediaWithOwner(gomock.Any(), gomock.Any()).Return(int64(0), errors.New("db down"))
				_ = mediaID
			},
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			ctrl := gomock.NewController(t)
			q := NewMockmediaQueries(ctrl)
			creatorID := uuid.New()
			themeID := uuid.New()
			mediaID := uuid.New()
			tt.mock(q, themeID, mediaID)
			svc := newMediaServiceWith(q, nil, zerolog.Nop())

			err := svc.cleanupMediaReferences(context.Background(), q, creatorID, db.ThemeMedium{ID: mediaID, ThemeID: themeID}, mediaID)

			assertMediaAppCode(t, err, apperror.ErrInternal)
		})
	}
}

func TestMediaReferenceScanner_ClearEventProgressionAndWrappedActions(t *testing.T) {
	mediaID := uuid.New()
	raw := json.RawMessage(fmt.Sprintf(`{
		"phases": [
			{"id": "intro", "onEnter": {"actions": [{"params": {"mediaId": %q}}]}},
			{"id": "outro", "onExit": [{"params": {"mediaId": %q}}, {"params": {"mediaId": "other"}}]}
		],
		"modules": {
			"event_progression": {
				"config": {
					"Triggers": [
						{"actions": {"actions": [{"params": {"mediaId": %q}}]}},
						{"actions": [{"params": {"mediaId": "other"}}]}
					]
				}
			}
		}
	}`, mediaID.String(), mediaID.String(), mediaID.String()))

	cleaned, changed, err := clearMediaReferencesInThemeConfig(raw, mediaID)
	if err != nil {
		t.Fatalf("clearMediaReferencesInThemeConfig: %v", err)
	}
	if !changed {
		t.Fatalf("expected config to change")
	}
	if strings.Contains(string(cleaned), mediaID.String()) {
		t.Fatalf("expected target media id to be removed: %s", cleaned)
	}
	if !strings.Contains(string(cleaned), "other") {
		t.Fatalf("expected unrelated media references to remain: %s", cleaned)
	}
}

func TestMediaReferenceScanner_DefaultLabelsAndMalformedActionParams(t *testing.T) {
	mediaID := uuid.New()
	raw := json.RawMessage(fmt.Sprintf(`{
		"phases": [
			{"onEnter": [{"action": "PLAY_BGM", "params": {"mediaId": %q}}]},
			{"id": "broken", "onExit": [{"params": {"mediaId": 42}}]}
		],
		"modules": {
			"event_progression": {
				"config": {
					"Triggers": [{"actions": [{"params": {"mediaId": %q}}]}]
				}
			}
		}
	}`, mediaID.String(), mediaID.String()))

	_, err := findMediaReferencesInThemeConfig(raw, mediaID)
	if err == nil {
		t.Fatalf("expected malformed action params to fail")
	}
	if !strings.Contains(err.Error(), "broken") {
		t.Fatalf("expected error to include owner context, got %v", err)
	}

	phaseOnly := json.RawMessage(fmt.Sprintf(`{
		"phases": [{"onEnter": [{"action": "PLAY_BGM", "params": {"mediaId": %q}}]}],
		"modules": {"event_progression": {"config": {"Triggers": [{"actions": [{"type": "SET_SFX", "params": {"mediaId": %q}}]}]}}}
	}`, mediaID.String(), mediaID.String()))
	refs, err := findMediaReferencesInThemeConfig(phaseOnly, mediaID)
	if err != nil {
		t.Fatalf("findMediaReferencesInThemeConfig: %v", err)
	}
	if len(refs) != 2 {
		t.Fatalf("expected default phase and trigger refs, got %#v", refs)
	}
	if refs[0].ID != "phase:onEnter:0" || !strings.Contains(refs[0].Name, "단계 시작 트리거") {
		t.Fatalf("unexpected default phase ref: %#v", refs[0])
	}
	if refs[1].ID != "trigger:0" || !strings.Contains(refs[1].Name, "트리거 실행 결과") {
		t.Fatalf("unexpected default trigger ref: %#v", refs[1])
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

func TestMediaService_UploadObject_StoresPendingUploadBody(t *testing.T) {
	svc, q, creatorID, themeID := newMediaTestService(t)
	st := newFakeStorageProvider()
	svc.storage = st
	uploadID := seedFileMedia(q, themeID, MediaTypeImage)
	media := q.media[uploadID]
	media.FileSize = pgtype.Int8{Int64: 8, Valid: true}
	media.MimeType = pgtype.Text{String: "image/png", Valid: true}
	q.media[uploadID] = media

	if err := svc.UploadObject(context.Background(), creatorID, themeID, uploadID, strings.NewReader("png-body")); err != nil {
		t.Fatalf("UploadObject: %v", err)
	}

	if got := string(st.objects[media.StorageKey.String]); got != "png-body" {
		t.Fatalf("stored body = %q", got)
	}
}

func TestMediaService_UploadObject_SizeMismatchCleansObject(t *testing.T) {
	svc, q, creatorID, themeID := newMediaTestService(t)
	st := newFakeStorageProvider()
	svc.storage = st
	uploadID := seedFileMedia(q, themeID, MediaTypeImage)
	media := q.media[uploadID]
	media.FileSize = pgtype.Int8{Int64: 4, Valid: true}
	media.MimeType = pgtype.Text{String: "image/png", Valid: true}
	q.media[uploadID] = media

	err := svc.UploadObject(context.Background(), creatorID, themeID, uploadID, strings.NewReader("too-large"))
	assertMediaAppCode(t, err, apperror.ErrMediaTooLarge)
	if _, ok := st.objects[media.StorageKey.String]; ok {
		t.Fatalf("size mismatch should remove stored object")
	}
}

func TestMediaService_RequestUploadURL_AudioStoresDuration(t *testing.T) {
	svc, q, creatorID, themeID := newMediaTestService(t)
	st := newFakeStorageProvider()
	svc.storage = st
	duration := int32(125)

	resp, err := svc.RequestUpload(context.Background(), creatorID, themeID, RequestMediaUploadRequest{
		Name:     "opening.mp3",
		Type:     MediaTypeBGM,
		MimeType: "audio/mpeg",
		FileSize: 1024,
		Duration: &duration,
	})
	if err != nil {
		t.Fatalf("RequestUpload BGM/mp3: %v", err)
	}
	created := q.media[resp.UploadID]
	if !created.Duration.Valid || created.Duration.Int32 != duration {
		t.Fatalf("expected audio duration %d, got %#v", duration, created.Duration)
	}
}

func TestMediaService_RequestUploadURL_RejectsNegativeDuration(t *testing.T) {
	svc, _, creatorID, themeID := newMediaTestService(t)
	st := newFakeStorageProvider()
	svc.storage = st
	duration := int32(-1)

	_, err := svc.RequestUpload(context.Background(), creatorID, themeID, RequestMediaUploadRequest{
		Name:     "opening.mp3",
		Type:     MediaTypeBGM,
		MimeType: "audio/mpeg",
		FileSize: 1024,
		Duration: &duration,
	})
	if err == nil {
		t.Fatal("expected negative duration to be rejected")
	}
	appErr, ok := err.(*apperror.AppError)
	if !ok {
		t.Fatalf("expected app error, got %T", err)
	}
	if appErr.Code != apperror.ErrValidation {
		t.Fatalf("error code = %q, want %q", appErr.Code, apperror.ErrValidation)
	}
}

func TestMediaService_ConfirmUpload_ImageMagicBytes(t *testing.T) {
	svc, q, creatorID, themeID := newMediaTestService(t)
	st := newFakeStorageProvider()
	svc.storage = st
	mediaID := uuid.New()
	storageKey := "themes/" + themeID.String() + "/media/" + mediaID.String() + ".png"
	header := tinyPNG(t)
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
	if resp.Type != MediaTypeImage || resp.MimeType == nil || *resp.MimeType != imageVariantMimeType {
		t.Fatalf("unexpected response: %#v", resp)
	}
	if resp.PreviewURL == nil || resp.ThumbnailURL == nil || resp.URL == nil {
		t.Fatalf("optimized image response should include variant URLs: %#v", resp)
	}
	if _, ok := st.objects[mediaImageVariantKey(themeID, mediaID, imageVariantMaster)]; !ok {
		t.Fatalf("master variant should be stored")
	}
	if _, ok := st.objects[mediaImageVariantKey(themeID, mediaID, imageVariantPreview)]; !ok {
		t.Fatalf("preview variant should be stored")
	}
	if _, ok := st.objects[mediaImageVariantKey(themeID, mediaID, imageVariantThumbnail)]; !ok {
		t.Fatalf("thumbnail variant should be stored")
	}
}

func TestMediaService_ConfirmUpload_ImageVariantFailureCleansPendingRowAndObjects(t *testing.T) {
	svc, q, creatorID, themeID := newMediaTestService(t)
	st := newFakeStorageProvider()
	st.putErrKeyContains = imageVariantThumbnail + ".webp"
	st.putErr = errors.New("storage write failed")
	svc.storage = st
	mediaID := uuid.New()
	storageKey := mediaImageUploadKey(themeID, mediaID, ".png")
	payload := tinyPNG(t)
	q.media[mediaID] = db.ThemeMedium{
		ID:         mediaID,
		ThemeID:    themeID,
		Name:       "background.png",
		Type:       MediaTypeImage,
		SourceType: SourceTypeFile,
		StorageKey: pgtype.Text{String: storageKey, Valid: true},
		FileSize:   pgtype.Int8{Int64: int64(len(payload)), Valid: true},
		MimeType:   pgtype.Text{String: "image/png", Valid: true},
		Tags:       []string{},
	}
	st.objects[storageKey] = payload

	_, err := svc.ConfirmUpload(context.Background(), creatorID, themeID, ConfirmUploadRequest{UploadID: mediaID})
	assertMediaAppCode(t, err, apperror.ErrInternal)
	if _, ok := q.media[mediaID]; ok {
		t.Fatalf("failed optimized upload should remove pending media row")
	}
	for key := range st.objects {
		if strings.Contains(key, mediaID.String()) {
			t.Fatalf("failed optimized upload should cleanup related objects, found %s", key)
		}
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

func TestMediaService_ListMedia_CategoryFromAnotherTheme_NotFound(t *testing.T) {
	svc, q, creatorID, themeID := newMediaTestService(t)
	otherThemeID := uuid.New()
	q.themes[otherThemeID] = db.Theme{ID: otherThemeID, CreatorID: creatorID}
	category := db.ThemeMediaCategory{
		ID:        uuid.New(),
		ThemeID:   otherThemeID,
		Name:      "다른 테마",
		SortOrder: 1,
		CreatedAt: time.Now(),
	}
	q.categories[category.ID] = category

	_, err := svc.ListMedia(context.Background(), creatorID, themeID, "", &category.ID)
	assertMediaAppCode(t, err, apperror.ErrNotFound)
}

func TestMediaService_ListMedia_FilterVariants(t *testing.T) {
	svc, q, creatorID, themeID := newMediaTestService(t)
	category := db.ThemeMediaCategory{ID: uuid.New(), ThemeID: themeID, Name: "배경", SortOrder: 1, CreatedAt: time.Now()}
	q.categories[category.ID] = category
	imageID := seedMedia(q, themeID, MediaTypeImage)
	image := q.media[imageID]
	image.CategoryID = pgtype.UUID{Bytes: category.ID, Valid: true}
	q.media[imageID] = image
	bgmID := seedMedia(q, themeID, MediaTypeBGM)

	all, err := svc.ListMedia(context.Background(), creatorID, themeID, "", nil)
	if err != nil {
		t.Fatalf("ListMedia all: %v", err)
	}
	if len(all) != 2 {
		t.Fatalf("expected all media, got %#v", all)
	}

	byType, err := svc.ListMedia(context.Background(), creatorID, themeID, MediaTypeBGM, nil)
	if err != nil {
		t.Fatalf("ListMedia type: %v", err)
	}
	if len(byType) != 1 || byType[0].ID != bgmID {
		t.Fatalf("unexpected type-filtered media: %#v", byType)
	}

	byCategory, err := svc.ListMedia(context.Background(), creatorID, themeID, "", &category.ID)
	if err != nil {
		t.Fatalf("ListMedia category: %v", err)
	}
	if len(byCategory) != 1 || byCategory[0].ID != imageID {
		t.Fatalf("unexpected category-filtered media: %#v", byCategory)
	}
}

func TestMediaService_ListCategoriesAndRequestUpload_WithCategory(t *testing.T) {
	svc, q, creatorID, themeID := newMediaTestService(t)
	svc.storage = newFakeStorageProvider()
	category, err := svc.CreateCategory(context.Background(), creatorID, themeID, MediaCategoryRequest{
		Name:      "배경",
		SortOrder: 2,
	})
	if err != nil {
		t.Fatalf("CreateCategory: %v", err)
	}

	categories, err := svc.ListCategories(context.Background(), creatorID, themeID)
	if err != nil {
		t.Fatalf("ListCategories: %v", err)
	}
	if len(categories) != 1 || categories[0].ID != category.ID {
		t.Fatalf("unexpected categories: %#v", categories)
	}

	upload, err := svc.RequestUpload(context.Background(), creatorID, themeID, RequestMediaUploadRequest{
		Name:       "map",
		Type:       MediaTypeImage,
		MimeType:   "image/png",
		FileSize:   8,
		CategoryID: &category.ID,
	})
	if err != nil {
		t.Fatalf("RequestUpload: %v", err)
	}
	if upload.UploadID == uuid.Nil {
		t.Fatalf("expected upload id")
	}
	pending := q.media[upload.UploadID]
	if pending.CategoryID.Valid && pending.CategoryID.Bytes != category.ID {
		t.Fatalf("unexpected category id on pending media: %#v", pending.CategoryID)
	}
}

func TestMediaService_RequestUpload_CategoryFromAnotherTheme_NotFound(t *testing.T) {
	svc, q, creatorID, themeID := newMediaTestService(t)
	svc.storage = newFakeStorageProvider()
	otherThemeID := uuid.New()
	q.themes[otherThemeID] = db.Theme{ID: otherThemeID, CreatorID: creatorID}
	otherCategory := db.ThemeMediaCategory{
		ID:        uuid.New(),
		ThemeID:   otherThemeID,
		Name:      "다른 테마",
		SortOrder: 1,
		CreatedAt: time.Now(),
	}
	q.categories[otherCategory.ID] = otherCategory

	_, err := svc.RequestUpload(context.Background(), creatorID, themeID, RequestMediaUploadRequest{
		Name:       "map",
		Type:       MediaTypeImage,
		MimeType:   "image/png",
		FileSize:   8,
		CategoryID: &otherCategory.ID,
	})
	assertMediaAppCode(t, err, apperror.ErrNotFound)
}

func TestMediaService_CategoryErrors_NotFound(t *testing.T) {
	svc, _, creatorID, _ := newMediaTestService(t)
	missingID := uuid.New()

	if _, err := svc.UpdateCategory(context.Background(), creatorID, missingID, MediaCategoryRequest{Name: "x"}); err == nil {
		t.Fatalf("UpdateCategory should fail for missing category")
	} else {
		assertMediaAppCode(t, err, apperror.ErrNotFound)
	}
	if err := svc.DeleteCategory(context.Background(), creatorID, missingID); err == nil {
		t.Fatalf("DeleteCategory should fail for missing category")
	} else {
		assertMediaAppCode(t, err, apperror.ErrNotFound)
	}
}

func TestMediaService_UpdateMedia_SuccessPreservesDurationAndSetsCategory(t *testing.T) {
	svc, q, creatorID, themeID := newMediaTestService(t)
	mediaID := seedMedia(q, themeID, MediaTypeBGM)
	media := q.media[mediaID]
	media.Duration = pgtype.Int4{Int32: 120, Valid: true}
	q.media[mediaID] = media
	category := db.ThemeMediaCategory{ID: uuid.New(), ThemeID: themeID, Name: "BGM", SortOrder: 1, CreatedAt: time.Now()}
	q.categories[category.ID] = category

	resp, err := svc.UpdateMedia(context.Background(), creatorID, mediaID, UpdateMediaRequest{
		Name:       "오프닝 음악",
		Type:       MediaTypeBGM,
		Tags:       []string{"intro"},
		SortOrder:  3,
		CategoryID: &category.ID,
	})
	if err != nil {
		t.Fatalf("UpdateMedia: %v", err)
	}
	if resp.Name != "오프닝 음악" || resp.Duration == nil || *resp.Duration != 120 || resp.CategoryID == nil || *resp.CategoryID != category.ID {
		t.Fatalf("unexpected updated response: %#v", resp)
	}
	if got := q.media[mediaID]; got.Name != "오프닝 음악" || !got.Duration.Valid || got.Duration.Int32 != 120 || !got.CategoryID.Valid {
		t.Fatalf("unexpected stored media: %#v", got)
	}
}

func TestMediaService_UpdateMedia_ExplicitDurationAndNilTags(t *testing.T) {
	svc, q, creatorID, themeID := newMediaTestService(t)
	mediaID := seedMedia(q, themeID, MediaTypeVoice)
	duration := int32(42)

	resp, err := svc.UpdateMedia(context.Background(), creatorID, mediaID, UpdateMediaRequest{
		Name:      "증언 음성",
		Type:      MediaTypeVoice,
		Duration:  &duration,
		Tags:      nil,
		SortOrder: 4,
	})
	if err != nil {
		t.Fatalf("UpdateMedia: %v", err)
	}
	if resp.Duration == nil || *resp.Duration != duration || resp.Tags == nil || len(resp.Tags) != 0 {
		t.Fatalf("unexpected updated response: %#v", resp)
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

	if err := svc.DeleteMedia(context.Background(), creatorID, mediaID, DeleteMediaOptions{DetachReferences: true}); err != nil {
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

func TestMediaService_Delete_CleansStoryInfoMediaReferences(t *testing.T) {
	svc, q, creatorID, themeID := newMediaTestService(t)
	mediaID := seedMedia(q, themeID, MediaTypeImage)
	infoID := uuid.New()
	q.storyInfoRefs[mediaID] = []db.FindStoryInfoReferencesForMediaRow{
		{ID: infoID, Title: "현장 사진", Usage: "cover"},
		{ID: infoID, Title: "현장 사진", Usage: "embedded_image"},
	}

	if err := svc.DeleteMedia(context.Background(), creatorID, mediaID, DeleteMediaOptions{DetachReferences: true}); err != nil {
		t.Fatalf("DeleteMedia: %v", err)
	}
	if _, ok := q.media[mediaID]; ok {
		t.Fatalf("media should be deleted")
	}
	if refs, ok := q.storyInfoRefs[mediaID]; ok {
		t.Fatalf("story info media refs should be deleted: %#v", refs)
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
	st.objects[oldKey] = tinyPNG(t)

	replacementBody := tinyPNG(t)
	upload, err := svc.RequestReplacementUpload(context.Background(), creatorID, mediaID, RequestMediaReplacementUploadRequest{
		MimeType: "image/png",
		FileSize: int64(len(replacementBody)),
	})
	if err != nil {
		t.Fatalf("RequestReplacementUpload: %v", err)
	}
	pending := q.replacements[upload.UploadID]
	st.objects[pending.StorageKey] = replacementBody

	resp, err := svc.ConfirmReplacementUpload(context.Background(), creatorID, mediaID, ConfirmUploadRequest{UploadID: upload.UploadID})
	if err != nil {
		t.Fatalf("ConfirmReplacementUpload: %v", err)
	}
	if resp.ID != mediaID {
		t.Fatalf("replacement must preserve media id: got %s want %s", resp.ID, mediaID)
	}
	if q.media[mediaID].StorageKey.String != mediaImageVariantKey(themeID, mediaID, imageVariantMaster) {
		t.Fatalf("storage key was not replaced")
	}
	if q.media[mediaID].Duration.Valid {
		t.Fatalf("replacement should clear stale duration metadata")
	}
	if _, ok := st.objects[oldKey]; ok {
		t.Fatalf("old object should be deleted")
	}
	for _, variant := range []string{imageVariantMaster, imageVariantPreview, imageVariantThumbnail} {
		key := mediaImageVariantKey(themeID, mediaID, variant)
		if _, ok := st.objects[key]; !ok {
			t.Fatalf("optimized replacement variant should remain: %s", key)
		}
	}
	if _, ok := q.replacements[upload.UploadID]; ok {
		t.Fatalf("pending replacement should be deleted")
	}
}

func TestMediaService_Delete_FileMediaBestEffortStorageCleanup(t *testing.T) {
	svc, q, creatorID, themeID := newMediaTestService(t)
	st := newFakeStorageProvider()
	svc.storage = st
	mediaID := seedFileMedia(q, themeID, MediaTypeImage)
	key := q.media[mediaID].StorageKey.String
	st.objects[key] = tinyPNG(t)

	if err := svc.DeleteMedia(context.Background(), creatorID, mediaID, DeleteMediaOptions{DetachReferences: true}); err != nil {
		t.Fatalf("DeleteMedia: %v", err)
	}
	if _, ok := q.media[mediaID]; ok {
		t.Fatalf("media row should be deleted")
	}
	if _, ok := st.objects[key]; ok {
		t.Fatalf("storage object should be deleted")
	}
}

func TestMediaService_Delete_ImageMediaDeletesOptimizedVariants(t *testing.T) {
	svc, q, creatorID, themeID := newMediaTestService(t)
	st := newFakeStorageProvider()
	svc.storage = st
	mediaID := seedFileMedia(q, themeID, MediaTypeImage)
	media := q.media[mediaID]
	media.StorageKey = pgtype.Text{String: mediaImageVariantKey(themeID, mediaID, imageVariantMaster), Valid: true}
	q.media[mediaID] = media
	for _, key := range mediaImageVariantKeysFor(media) {
		st.objects[key] = []byte("variant")
	}

	if err := svc.DeleteMedia(context.Background(), creatorID, mediaID, DeleteMediaOptions{DetachReferences: true}); err != nil {
		t.Fatalf("DeleteMedia: %v", err)
	}
	for _, key := range mediaImageVariantKeysFor(media) {
		if _, ok := st.objects[key]; ok {
			t.Fatalf("optimized variant should be deleted: %s", key)
		}
	}
}

func TestMediaService_RequestReplacementUpload_RejectsInvalidInputs(t *testing.T) {
	svc, q, creatorID, themeID := newMediaTestService(t)
	svc.storage = newFakeStorageProvider()
	youtubeID := seedMedia(q, themeID, MediaTypeImage)
	fileID := seedFileMedia(q, themeID, MediaTypeImage)

	_, err := svc.RequestReplacementUpload(context.Background(), creatorID, youtubeID, RequestMediaReplacementUploadRequest{
		MimeType: "image/png",
		FileSize: 8,
	})
	assertMediaAppCode(t, err, apperror.ErrMediaInvalidType)

	_, err = svc.RequestReplacementUpload(context.Background(), creatorID, fileID, RequestMediaReplacementUploadRequest{
		MimeType: "application/pdf",
		FileSize: 8,
	})
	assertMediaAppCode(t, err, apperror.ErrMediaInvalidType)

	_, err = svc.RequestReplacementUpload(context.Background(), creatorID, fileID, RequestMediaReplacementUploadRequest{
		MimeType: "image/png",
		FileSize: MaxMediaFileSize + 1,
	})
	assertMediaAppCode(t, err, apperror.ErrMediaTooLarge)
}

func TestMediaService_RequestReplacementUpload_RollsBackPendingOnUploadURLError(t *testing.T) {
	svc, q, creatorID, themeID := newMediaTestService(t)
	st := newFakeStorageProvider()
	st.generateUploadErr = errors.New("presign failed")
	svc.storage = st
	mediaID := seedFileMedia(q, themeID, MediaTypeImage)

	_, err := svc.RequestReplacementUpload(context.Background(), creatorID, mediaID, RequestMediaReplacementUploadRequest{
		MimeType: "image/png",
		FileSize: 8,
	})

	assertMediaAppCode(t, err, apperror.ErrInternal)
	if len(q.replacements) != 0 {
		t.Fatalf("failed presign should rollback pending replacement rows: %#v", q.replacements)
	}
}

func TestMediaService_RequestReplacementUpload_RequiresStorageAndExistingMedia(t *testing.T) {
	svc, _, creatorID, _ := newMediaTestService(t)
	mediaID := uuid.New()

	_, err := svc.RequestReplacementUpload(context.Background(), creatorID, mediaID, RequestMediaReplacementUploadRequest{
		MimeType: "image/png",
		FileSize: 8,
	})
	assertMediaAppCode(t, err, apperror.ErrInternal)

	svc.storage = newFakeStorageProvider()
	_, err = svc.RequestReplacementUpload(context.Background(), creatorID, mediaID, RequestMediaReplacementUploadRequest{
		MimeType: "image/png",
		FileSize: 8,
	})
	assertMediaAppCode(t, err, apperror.ErrNotFound)
}

func TestMediaService_ConfirmReplacementUpload_CleansPendingWhenObjectMissing(t *testing.T) {
	svc, q, creatorID, themeID := newMediaTestService(t)
	st := newFakeStorageProvider()
	svc.storage = st
	mediaID := seedFileMedia(q, themeID, MediaTypeImage)
	upload, err := svc.RequestReplacementUpload(context.Background(), creatorID, mediaID, RequestMediaReplacementUploadRequest{
		MimeType: "image/png",
		FileSize: 8,
	})
	if err != nil {
		t.Fatalf("RequestReplacementUpload: %v", err)
	}

	err = func() error {
		_, confirmErr := svc.ConfirmReplacementUpload(context.Background(), creatorID, mediaID, ConfirmUploadRequest{UploadID: upload.UploadID})
		return confirmErr
	}()
	assertMediaAppCode(t, err, apperror.ErrMediaUploadExpired)
	if _, ok := q.replacements[upload.UploadID]; ok {
		t.Fatalf("missing uploaded object should delete pending replacement")
	}
}

func TestMediaService_ConfirmReplacementUpload_ErrorPaths(t *testing.T) {
	svc, q, creatorID, themeID := newMediaTestService(t)
	st := newFakeStorageProvider()
	svc.storage = st
	mediaID := seedFileMedia(q, themeID, MediaTypeImage)
	otherMediaID := seedFileMedia(q, themeID, MediaTypeImage)
	upload, err := svc.RequestReplacementUpload(context.Background(), creatorID, otherMediaID, RequestMediaReplacementUploadRequest{
		MimeType: "image/png",
		FileSize: 8,
	})
	if err != nil {
		t.Fatalf("RequestReplacementUpload: %v", err)
	}

	_, err = svc.ConfirmReplacementUpload(context.Background(), creatorID, mediaID, ConfirmUploadRequest{UploadID: upload.UploadID})
	assertMediaAppCode(t, err, apperror.ErrNotFound)

	_, err = svc.ConfirmReplacementUpload(context.Background(), creatorID, mediaID, ConfirmUploadRequest{UploadID: uuid.New()})
	assertMediaAppCode(t, err, apperror.ErrNotFound)

	st.headErr = errors.New("storage unavailable")
	_, err = svc.ConfirmReplacementUpload(context.Background(), creatorID, otherMediaID, ConfirmUploadRequest{UploadID: upload.UploadID})
	assertMediaAppCode(t, err, apperror.ErrInternal)

	st.headErr = nil
	replacementBody := tinyPNG(t)
	upload, err = svc.RequestReplacementUpload(context.Background(), creatorID, otherMediaID, RequestMediaReplacementUploadRequest{
		MimeType: "image/png",
		FileSize: int64(len(replacementBody)),
	})
	if err != nil {
		t.Fatalf("RequestReplacementUpload for range failure: %v", err)
	}
	pending := q.replacements[upload.UploadID]
	st.objects[pending.StorageKey] = replacementBody
	st.rangeErr = errors.New("range failed")
	_, err = svc.ConfirmReplacementUpload(context.Background(), creatorID, otherMediaID, ConfirmUploadRequest{UploadID: upload.UploadID})
	assertMediaAppCode(t, err, apperror.ErrInternal)
}

func TestMediaService_ConfirmUpload_CleansMissingObject(t *testing.T) {
	svc, q, creatorID, themeID := newMediaTestService(t)
	svc.storage = newFakeStorageProvider()
	mediaID := seedFileMedia(q, themeID, MediaTypeImage)

	_, err := svc.ConfirmUpload(context.Background(), creatorID, themeID, ConfirmUploadRequest{UploadID: mediaID})
	assertMediaAppCode(t, err, apperror.ErrMediaUploadExpired)
	if _, ok := q.media[mediaID]; ok {
		t.Fatalf("missing object should remove pending media")
	}
}

func TestMediaService_ConfirmUpload_SizeMismatchCleansPendingMedia(t *testing.T) {
	svc, q, creatorID, themeID := newMediaTestService(t)
	st := newFakeStorageProvider()
	svc.storage = st
	mediaID := seedFileMedia(q, themeID, MediaTypeImage)
	key := q.media[mediaID].StorageKey.String
	st.objects[key] = tinyPNG(t)

	_, err := svc.ConfirmUpload(context.Background(), creatorID, themeID, ConfirmUploadRequest{UploadID: mediaID})
	assertMediaAppCode(t, err, apperror.ErrMediaTooLarge)
	if _, ok := q.media[mediaID]; ok {
		t.Fatalf("size mismatch should remove pending media")
	}
	if _, ok := st.objects[key]; ok {
		t.Fatalf("size mismatch should delete uploaded object")
	}
}

func TestMediaService_ResolveMediaURL_YouTubeAndInvalidSource(t *testing.T) {
	svc, q, _, themeID := newMediaTestService(t)
	sessionID := uuid.New()
	q.sessions[sessionID] = db.GameSession{ID: sessionID, ThemeID: themeID}
	youtubeID := seedMedia(q, themeID, MediaTypeVideo)
	youtube := q.media[youtubeID]
	youtube.Url = pgtype.Text{String: "https://www.youtube.com/watch?v=dQw4w9WgXcQ", Valid: true}
	q.media[youtubeID] = youtube

	url, sourceType, err := svc.ResolveMediaURL(context.Background(), sessionID, youtubeID, MediaTypeVideo)
	if err != nil {
		t.Fatalf("ResolveMediaURL youtube: %v", err)
	}
	if url != youtube.Url.String || sourceType != SourceTypeYouTube {
		t.Fatalf("unexpected youtube resolve: url=%q source=%q", url, sourceType)
	}

	brokenID := seedMedia(q, themeID, MediaTypeImage)
	broken := q.media[brokenID]
	broken.SourceType = "BROKEN"
	q.media[brokenID] = broken
	_, _, err = svc.ResolveMediaURL(context.Background(), sessionID, brokenID)
	assertMediaAppCode(t, err, apperror.ErrInternal)
}

func TestMediaService_GetMediaPlayURL_FileAndAllowedTypeErrors(t *testing.T) {
	svc, q, _, themeID := newMediaTestService(t)
	st := newFakeStorageProvider()
	svc.storage = st
	sessionID := uuid.New()
	q.sessions[sessionID] = db.GameSession{ID: sessionID, ThemeID: themeID}
	mediaID := seedFileMedia(q, themeID, MediaTypeBGM)

	url, err := svc.GetMediaPlayURL(context.Background(), sessionID, mediaID)
	if err != nil {
		t.Fatalf("GetMediaPlayURL file: %v", err)
	}
	if !strings.Contains(url, "https://download.example/") {
		t.Fatalf("unexpected file play URL: %s", url)
	}

	_, _, err = svc.ResolveMediaURL(context.Background(), sessionID, mediaID, MediaTypeImage)
	assertMediaAppCode(t, err, apperror.ErrMediaInvalidType)

	st.generateDownloadErr = errors.New("download presign failed")
	_, _, err = svc.ResolveMediaURL(context.Background(), sessionID, mediaID)
	assertMediaAppCode(t, err, apperror.ErrInternal)
}

func TestMediaService_CreateYouTube_RejectsInvalidURLBeforeOEmbed(t *testing.T) {
	svc, _, creatorID, themeID := newMediaTestService(t)

	_, err := svc.CreateYouTube(context.Background(), creatorID, themeID, CreateMediaYouTubeRequest{
		Name: "intro",
		Type: MediaTypeVideo,
		URL:  "https://example.com/not-youtube",
	})
	assertMediaAppCode(t, err, apperror.ErrMediaInvalidURL)
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

func TestUploadExtensionFor_ImageAndDocumentTypes(t *testing.T) {
	tests := []struct {
		name      string
		mediaType string
		mimeType  string
		wantExt   string
		wantOK    bool
	}{
		{name: "jpeg image", mediaType: MediaTypeImage, mimeType: "image/jpeg", wantExt: ".jpg", wantOK: true},
		{name: "webp image", mediaType: MediaTypeImage, mimeType: "image/webp", wantExt: ".webp", wantOK: true},
		{name: "pdf document", mediaType: MediaTypeDocument, mimeType: "application/pdf", wantExt: ".pdf", wantOK: true},
		{name: "wav audio", mediaType: MediaTypeBGM, mimeType: "audio/wav", wantExt: ".wav", wantOK: true},
		{name: "wave audio", mediaType: MediaTypeBGM, mimeType: "audio/wave", wantExt: ".wav", wantOK: true},
		{name: "x-wav audio", mediaType: MediaTypeBGM, mimeType: "audio/x-wav", wantExt: ".wav", wantOK: true},
		{name: "vendor wave audio", mediaType: MediaTypeBGM, mimeType: "audio/vnd.wave", wantExt: ".wav", wantOK: true},
		{name: "unsupported image", mediaType: MediaTypeImage, mimeType: "image/gif", wantOK: false},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			gotExt, gotOK := uploadExtensionFor(tt.mediaType, tt.mimeType)
			if gotExt != tt.wantExt || gotOK != tt.wantOK {
				t.Fatalf("uploadExtensionFor() = (%q, %v), want (%q, %v)", gotExt, gotOK, tt.wantExt, tt.wantOK)
			}
		})
	}
}

func TestValidateImageMagicBytes(t *testing.T) {
	tests := []struct {
		name    string
		header  []byte
		mime    string
		wantErr bool
	}{
		{"JPEG valid", []byte{0xFF, 0xD8, 0xFF, 0xEE}, "image/jpeg", false},
		{"PNG valid", []byte{0x89, 'P', 'N', 'G', 0x0D, 0x0A, 0x1A, 0x0A}, "image/png", false},
		{"WEBP valid", []byte("RIFF\x00\x00\x00\x00WEBPVP8 "), "image/webp", false},
		{"MIME mismatch", []byte{0xFF, 0xD8, 0xFF}, "image/png", true},
		{"Unknown MIME", []byte{0xFF, 0xD8, 0xFF}, "image/gif", true},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := validateImageMagicBytes(tt.header, tt.mime)
			if (err != nil) != tt.wantErr {
				t.Fatalf("validateImageMagicBytes() err=%v, wantErr=%v", err, tt.wantErr)
			}
		})
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
		{"WAV alias valid", []byte("RIFF\x00\x00\x00\x00WAVEfmt "), "audio/x-wav", false},
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
