package theme

import (
	"context"
	"io"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/rs/zerolog"

	"github.com/mmp-platform/server/internal/db"
	"github.com/mmp-platform/server/internal/infra/storage"
)

type fakePublicThemeQueries struct {
	theme      db.GetPublishedThemeRow
	characters []db.GetPublishedThemeCharactersRow
	media      map[uuid.UUID]db.ThemeMedium
}

func (f *fakePublicThemeQueries) GetPublishedTheme(context.Context, uuid.UUID) (db.GetPublishedThemeRow, error) {
	return f.theme, nil
}

func (f *fakePublicThemeQueries) GetPublishedThemeBySlug(context.Context, string) (db.GetPublishedThemeBySlugRow, error) {
	return db.GetPublishedThemeBySlugRow{
		ID:          f.theme.ID,
		CreatorID:   f.theme.CreatorID,
		Title:       f.theme.Title,
		Slug:        f.theme.Slug,
		Description: f.theme.Description,
		CoverImage:  f.theme.CoverImage,
		MinPlayers:  f.theme.MinPlayers,
		MaxPlayers:  f.theme.MaxPlayers,
		DurationMin: f.theme.DurationMin,
		Price:       f.theme.Price,
		Status:      f.theme.Status,
		Version:     f.theme.Version,
		PublishedAt: f.theme.PublishedAt,
		CreatedAt:   f.theme.CreatedAt,
		CoinPrice:   f.theme.CoinPrice,
	}, nil
}

func (f *fakePublicThemeQueries) ListPublishedThemes(context.Context, db.ListPublishedThemesParams) ([]db.ListPublishedThemesRow, error) {
	return []db.ListPublishedThemesRow{{
		ID:          f.theme.ID,
		CreatorID:   f.theme.CreatorID,
		Title:       f.theme.Title,
		Slug:        f.theme.Slug,
		Description: f.theme.Description,
		CoverImage:  f.theme.CoverImage,
		MinPlayers:  f.theme.MinPlayers,
		MaxPlayers:  f.theme.MaxPlayers,
		DurationMin: f.theme.DurationMin,
		Price:       f.theme.Price,
		CoinPrice:   f.theme.CoinPrice,
	}}, nil
}

func (f *fakePublicThemeQueries) GetPublishedThemeCharacters(context.Context, uuid.UUID) ([]db.GetPublishedThemeCharactersRow, error) {
	return f.characters, nil
}

func (f *fakePublicThemeQueries) GetMedia(_ context.Context, mediaID uuid.UUID) (db.ThemeMedium, error) {
	if _, ok := f.media[mediaID]; !ok {
		return db.ThemeMedium{}, pgx.ErrNoRows
	}
	return f.media[mediaID], nil
}

type fakePublicThemeStorage struct {
	urls       map[string]string
	existing   map[string]bool
	headErrors map[string]error
	headCalls  int
	urlCalls   int
}

func (f fakePublicThemeStorage) GenerateUploadURL(context.Context, string, string, int64, time.Duration) (string, error) {
	return "", nil
}

func (f *fakePublicThemeStorage) GenerateDownloadURL(_ context.Context, key string, _ time.Duration) (string, error) {
	f.urlCalls++
	return f.urls[key], nil
}

func (*fakePublicThemeStorage) PutObject(context.Context, string, io.Reader, string, int64) error {
	return nil
}

func (f *fakePublicThemeStorage) HeadObject(_ context.Context, key string) (*storage.ObjectMeta, error) {
	f.headCalls++
	if err := f.headErrors[key]; err != nil {
		return nil, err
	}
	if !f.existing[key] {
		return nil, storage.ErrObjectNotFound
	}
	return &storage.ObjectMeta{Key: key, ContentType: "image/png", Size: 1024}, nil
}

func (*fakePublicThemeStorage) GetObjectRange(context.Context, string, int64, int64) (io.ReadCloser, error) {
	return nil, storage.ErrObjectNotFound
}

func (*fakePublicThemeStorage) DeleteObject(context.Context, string) error {
	return nil
}

func (*fakePublicThemeStorage) DeleteObjects(context.Context, []string) error {
	return nil
}

func TestGetCharactersResolvesImageMediaURL(t *testing.T) {
	themeID := uuid.New()
	playableID := uuid.New()
	mediaID := uuid.New()
	storageKey := "themes/" + themeID.String() + "/media/" + mediaID.String() + ".png"
	downloadURL := "https://cdn.example.test/" + storageKey

	q := &fakePublicThemeQueries{
		theme: db.GetPublishedThemeRow{ID: themeID, Status: publishedStatus},
		characters: []db.GetPublishedThemeCharactersRow{
			{
				ID:           playableID,
				ThemeID:      themeID,
				Name:         "Playable",
				SortOrder:    1,
				ImageMediaID: pgUUID(mediaID),
			},
		},
		media: map[uuid.UUID]db.ThemeMedium{
			mediaID: {
				ID:         mediaID,
				ThemeID:    themeID,
				Type:       "IMAGE",
				SourceType: "FILE",
				StorageKey: pgtype.Text{String: storageKey, Valid: true},
			},
		},
	}
	fakeStorage := &fakePublicThemeStorage{
		urls:     map[string]string{storageKey: downloadURL},
		existing: map[string]bool{storageKey: true},
	}
	svc := &service{
		queries: q,
		storage: fakeStorage,
		logger:  zerolog.Nop(),
	}

	chars, err := svc.GetCharacters(context.Background(), themeID)
	if err != nil {
		t.Fatalf("GetCharacters returned error: %v", err)
	}
	if len(chars) != 1 {
		t.Fatalf("len(chars) = %d, want 1: %+v", len(chars), chars)
	}
	if chars[0].ID != playableID {
		t.Fatalf("returned character ID = %s, want %s", chars[0].ID, playableID)
	}
	if chars[0].ImageURL == nil || *chars[0].ImageURL != downloadURL {
		t.Fatalf("image_url = %v, want %q", chars[0].ImageURL, downloadURL)
	}
	if fakeStorage.headCalls != 1 {
		t.Fatalf("HeadObject calls = %d, want 1", fakeStorage.headCalls)
	}
	if fakeStorage.urlCalls != 1 {
		t.Fatalf("GenerateDownloadURL calls = %d, want 1", fakeStorage.urlCalls)
	}
}

func TestGetCharactersPreservesExistingImageURL(t *testing.T) {
	themeID := uuid.New()
	mediaID := uuid.New()
	existingURL := "https://static.example.test/character.png"
	q := &fakePublicThemeQueries{
		theme: db.GetPublishedThemeRow{ID: themeID, Status: publishedStatus},
		characters: []db.GetPublishedThemeCharactersRow{{
			ID:           uuid.New(),
			ThemeID:      themeID,
			Name:         "Playable",
			ImageUrl:     pgtype.Text{String: existingURL, Valid: true},
			ImageMediaID: pgUUID(mediaID),
		}},
		media: map[uuid.UUID]db.ThemeMedium{
			mediaID: {
				ID:         mediaID,
				ThemeID:    themeID,
				Type:       "IMAGE",
				SourceType: "FILE",
				StorageKey: pgtype.Text{String: "unused", Valid: true},
			},
		},
	}
	fakeStorage := &fakePublicThemeStorage{
		urls:     map[string]string{"unused": "https://cdn.example.test/unused"},
		existing: map[string]bool{"unused": true},
	}
	svc := &service{
		queries: q,
		storage: fakeStorage,
		logger:  zerolog.Nop(),
	}

	chars, err := svc.GetCharacters(context.Background(), themeID)
	if err != nil {
		t.Fatalf("GetCharacters returned error: %v", err)
	}
	if len(chars) != 1 {
		t.Fatalf("len(chars) = %d, want 1", len(chars))
	}
	if chars[0].ImageURL == nil || *chars[0].ImageURL != existingURL {
		t.Fatalf("image_url = %v, want existing %q", chars[0].ImageURL, existingURL)
	}
	if fakeStorage.headCalls != 0 {
		t.Fatalf("HeadObject calls = %d, want 0", fakeStorage.headCalls)
	}
	if fakeStorage.urlCalls != 0 {
		t.Fatalf("GenerateDownloadURL calls = %d, want 0", fakeStorage.urlCalls)
	}
}

func TestGetCharactersKeepsCharacterWhenImageMediaMissing(t *testing.T) {
	themeID := uuid.New()
	mediaID := uuid.New()
	q := &fakePublicThemeQueries{
		theme: db.GetPublishedThemeRow{ID: themeID, Status: publishedStatus},
		characters: []db.GetPublishedThemeCharactersRow{{
			ID:           uuid.New(),
			ThemeID:      themeID,
			Name:         "Playable",
			ImageMediaID: pgUUID(mediaID),
		}},
		media: map[uuid.UUID]db.ThemeMedium{},
	}
	svc := &service{
		queries: q,
		storage: &fakePublicThemeStorage{},
		logger:  zerolog.Nop(),
	}

	chars, err := svc.GetCharacters(context.Background(), themeID)
	if err != nil {
		t.Fatalf("GetCharacters returned error: %v", err)
	}
	if len(chars) != 1 {
		t.Fatalf("len(chars) = %d, want 1", len(chars))
	}
	if chars[0].ImageURL != nil {
		t.Fatalf("image_url = %v, want nil fallback", *chars[0].ImageURL)
	}
}

func TestGetCharactersFallsBackWhenImageObjectMissing(t *testing.T) {
	themeID := uuid.New()
	mediaID := uuid.New()
	storageKey := "themes/" + themeID.String() + "/media/" + mediaID.String() + ".png"
	q := &fakePublicThemeQueries{
		theme: db.GetPublishedThemeRow{ID: themeID, Status: publishedStatus},
		characters: []db.GetPublishedThemeCharactersRow{{
			ID:           uuid.New(),
			ThemeID:      themeID,
			Name:         "Playable",
			ImageMediaID: pgUUID(mediaID),
		}},
		media: map[uuid.UUID]db.ThemeMedium{
			mediaID: {
				ID:         mediaID,
				ThemeID:    themeID,
				Type:       "IMAGE",
				SourceType: "FILE",
				StorageKey: pgtype.Text{String: storageKey, Valid: true},
			},
		},
	}
	fakeStorage := &fakePublicThemeStorage{
		urls: map[string]string{storageKey: "https://cdn.example.test/" + storageKey},
	}
	svc := &service{
		queries: q,
		storage: fakeStorage,
		logger:  zerolog.Nop(),
	}

	chars, err := svc.GetCharacters(context.Background(), themeID)
	if err != nil {
		t.Fatalf("GetCharacters returned error: %v", err)
	}
	if len(chars) != 1 {
		t.Fatalf("len(chars) = %d, want 1", len(chars))
	}
	if chars[0].ImageURL != nil {
		t.Fatalf("image_url = %v, want nil fallback for missing object", *chars[0].ImageURL)
	}
	if fakeStorage.headCalls != 1 {
		t.Fatalf("HeadObject calls = %d, want 1", fakeStorage.headCalls)
	}
	if fakeStorage.urlCalls != 0 {
		t.Fatalf("GenerateDownloadURL calls = %d, want 0", fakeStorage.urlCalls)
	}
}

func TestGetCharactersFallsBackWhenImageMediaBelongsToAnotherTheme(t *testing.T) {
	themeID := uuid.New()
	otherThemeID := uuid.New()
	mediaID := uuid.New()
	storageKey := "themes/" + otherThemeID.String() + "/media/" + mediaID.String() + ".png"
	q := &fakePublicThemeQueries{
		theme: db.GetPublishedThemeRow{ID: themeID, Status: publishedStatus},
		characters: []db.GetPublishedThemeCharactersRow{{
			ID:           uuid.New(),
			ThemeID:      themeID,
			Name:         "Playable",
			ImageMediaID: pgUUID(mediaID),
		}},
		media: map[uuid.UUID]db.ThemeMedium{
			mediaID: {
				ID:         mediaID,
				ThemeID:    otherThemeID,
				Type:       "IMAGE",
				SourceType: "FILE",
				StorageKey: pgtype.Text{String: storageKey, Valid: true},
			},
		},
	}
	fakeStorage := &fakePublicThemeStorage{
		urls:     map[string]string{storageKey: "https://cdn.example.test/" + storageKey},
		existing: map[string]bool{storageKey: true},
	}
	svc := &service{
		queries: q,
		storage: fakeStorage,
		logger:  zerolog.Nop(),
	}

	chars, err := svc.GetCharacters(context.Background(), themeID)
	if err != nil {
		t.Fatalf("GetCharacters returned error: %v", err)
	}
	if len(chars) != 1 {
		t.Fatalf("len(chars) = %d, want 1", len(chars))
	}
	if chars[0].ImageURL != nil {
		t.Fatalf("image_url = %v, want nil fallback for cross-theme media", *chars[0].ImageURL)
	}
	if fakeStorage.headCalls != 0 {
		t.Fatalf("HeadObject calls = %d, want 0", fakeStorage.headCalls)
	}
	if fakeStorage.urlCalls != 0 {
		t.Fatalf("GenerateDownloadURL calls = %d, want 0", fakeStorage.urlCalls)
	}
}

func pgUUID(id uuid.UUID) pgtype.UUID {
	return pgtype.UUID{Bytes: id, Valid: true}
}
