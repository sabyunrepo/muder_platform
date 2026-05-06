package editor

import (
	"context"
	"encoding/json"
	"errors"
	"strings"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/rs/zerolog"

	"github.com/mmp-platform/server/internal/apperror"
	"github.com/mmp-platform/server/internal/db"
)

// --- fakeReadingQueries: in-memory readingQueries implementation for unit tests ---

type fakeReadingQueries struct {
	themes   map[uuid.UUID]db.Theme
	media    map[uuid.UUID]db.ThemeMedium
	sections map[uuid.UUID]db.ReadingSection
}

func newFakeReadingQueries() *fakeReadingQueries {
	return &fakeReadingQueries{
		themes:   make(map[uuid.UUID]db.Theme),
		media:    make(map[uuid.UUID]db.ThemeMedium),
		sections: make(map[uuid.UUID]db.ReadingSection),
	}
}

func (f *fakeReadingQueries) GetTheme(_ context.Context, id uuid.UUID) (db.Theme, error) {
	t, ok := f.themes[id]
	if !ok {
		return db.Theme{}, pgx.ErrNoRows
	}
	return t, nil
}

func (f *fakeReadingQueries) GetMedia(_ context.Context, id uuid.UUID) (db.ThemeMedium, error) {
	m, ok := f.media[id]
	if !ok {
		return db.ThemeMedium{}, pgx.ErrNoRows
	}
	return m, nil
}

func (f *fakeReadingQueries) ListReadingSectionsByTheme(_ context.Context, themeID uuid.UUID) ([]db.ReadingSection, error) {
	out := []db.ReadingSection{}
	for _, s := range f.sections {
		if s.ThemeID == themeID {
			out = append(out, s)
		}
	}
	// match SQL ORDER BY sort_order, created_at (created_at uses time.Now in tests, so sort_order alone is enough).
	for i := 1; i < len(out); i++ {
		for j := i; j > 0 && out[j-1].SortOrder > out[j].SortOrder; j-- {
			out[j-1], out[j] = out[j], out[j-1]
		}
	}
	return out, nil
}

func (f *fakeReadingQueries) GetReadingSectionWithOwner(_ context.Context, arg db.GetReadingSectionWithOwnerParams) (db.ReadingSection, error) {
	s, ok := f.sections[arg.ID]
	if !ok {
		return db.ReadingSection{}, pgx.ErrNoRows
	}
	t, ok := f.themes[s.ThemeID]
	if !ok || t.CreatorID != arg.CreatorID {
		return db.ReadingSection{}, pgx.ErrNoRows
	}
	return s, nil
}

func (f *fakeReadingQueries) CreateReadingSection(_ context.Context, arg db.CreateReadingSectionParams) (db.ReadingSection, error) {
	s := db.ReadingSection{
		ID:         uuid.New(),
		ThemeID:    arg.ThemeID,
		Name:       arg.Name,
		BgmMediaID: arg.BgmMediaID,
		Lines:      arg.Lines,
		SortOrder:  arg.SortOrder,
		Version:    1,
		CreatedAt:  time.Now(),
		UpdatedAt:  time.Now(),
	}
	f.sections[s.ID] = s
	return s, nil
}

func (f *fakeReadingQueries) UpdateReadingSection(_ context.Context, arg db.UpdateReadingSectionParams) (db.ReadingSection, error) {
	s, ok := f.sections[arg.ID]
	if !ok {
		return db.ReadingSection{}, pgx.ErrNoRows
	}
	if s.Version != arg.Version {
		return db.ReadingSection{}, pgx.ErrNoRows
	}
	s.Name = arg.Name
	s.BgmMediaID = arg.BgmMediaID
	s.Lines = arg.Lines
	s.SortOrder = arg.SortOrder
	s.Version++
	s.UpdatedAt = time.Now()
	f.sections[arg.ID] = s
	return s, nil
}

func (f *fakeReadingQueries) DeleteReadingSectionWithOwner(_ context.Context, arg db.DeleteReadingSectionWithOwnerParams) (int64, error) {
	s, ok := f.sections[arg.ID]
	if !ok {
		return 0, nil
	}
	t, ok := f.themes[s.ThemeID]
	if !ok || t.CreatorID != arg.CreatorID {
		return 0, nil
	}
	delete(f.sections, arg.ID)
	return 1, nil
}

// --- helpers ---

type readingTestFixture struct {
	q         *fakeReadingQueries
	svc       *readingService
	creatorID uuid.UUID
	themeID   uuid.UUID
	bgmID     uuid.UUID
	voiceID   uuid.UUID
	imageID   uuid.UUID
	otherBgm  uuid.UUID // BGM in a different theme
}

func newReadingFixture(t *testing.T) *readingTestFixture {
	t.Helper()
	q := newFakeReadingQueries()

	creatorID := uuid.New()
	themeID := uuid.New()
	q.themes[themeID] = db.Theme{ID: themeID, CreatorID: creatorID}

	otherThemeID := uuid.New()
	q.themes[otherThemeID] = db.Theme{ID: otherThemeID, CreatorID: creatorID}

	bgmID := uuid.New()
	q.media[bgmID] = db.ThemeMedium{ID: bgmID, ThemeID: themeID, Type: MediaTypeBGM}

	voiceID := uuid.New()
	q.media[voiceID] = db.ThemeMedium{ID: voiceID, ThemeID: themeID, Type: MediaTypeVoice}

	imageID := uuid.New()
	q.media[imageID] = db.ThemeMedium{ID: imageID, ThemeID: themeID, Type: MediaTypeImage}

	otherBgm := uuid.New()
	q.media[otherBgm] = db.ThemeMedium{ID: otherBgm, ThemeID: otherThemeID, Type: MediaTypeBGM}

	return &readingTestFixture{
		q:         q,
		svc:       newReadingServiceWith(q, zerolog.Nop()),
		creatorID: creatorID,
		themeID:   themeID,
		bgmID:     bgmID,
		voiceID:   voiceID,
		imageID:   imageID,
		otherBgm:  otherBgm,
	}
}

func assertAppCode(t *testing.T, err error, want string) {
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

func ptr[T any](v T) *T { return &v }

// --- tests ---

func TestReadingService_Create_Success(t *testing.T) {
	f := newReadingFixture(t)
	bgm := f.bgmID.String()
	resp, err := f.svc.Create(context.Background(), f.creatorID, f.themeID, CreateReadingSectionRequest{
		Name:       "Intro",
		BgmMediaID: &bgm,
		Lines: []ReadingLineDTO{
			{Text: "It was a dark night.", Speaker: "narrator", AdvanceBy: AdvanceByGM},
			{Text: "The detective spoke.", AdvanceBy: AdvanceByVoice, VoiceMediaID: f.voiceID.String()},
			{Text: "I have a clue.", AdvanceBy: "role:detective"},
		},
		SortOrder: 0,
	})
	if err != nil {
		t.Fatalf("create failed: %v", err)
	}
	if resp.Name != "Intro" || resp.Version != 1 || len(resp.Lines) != 3 {
		t.Fatalf("unexpected response: %+v", resp)
	}
	if resp.BgmMediaID == nil || *resp.BgmMediaID != bgm {
		t.Fatalf("bgm not persisted")
	}
	// Indices must be normalized.
	for i, ln := range resp.Lines {
		if ln.Index != i {
			t.Errorf("line %d has Index=%d", i, ln.Index)
		}
	}
}

func TestReadingService_Create_InvalidAdvanceBy(t *testing.T) {
	f := newReadingFixture(t)
	_, err := f.svc.Create(context.Background(), f.creatorID, f.themeID, CreateReadingSectionRequest{
		Name: "Bad",
		Lines: []ReadingLineDTO{
			{Text: "x", AdvanceBy: "foo"},
		},
	})
	assertAppCode(t, err, apperror.ErrReadingInvalidAdvanceBy)
}

func TestReadingService_Create_VoiceModeRequiresVoiceMediaId(t *testing.T) {
	f := newReadingFixture(t)
	_, err := f.svc.Create(context.Background(), f.creatorID, f.themeID, CreateReadingSectionRequest{
		Name: "Bad",
		Lines: []ReadingLineDTO{
			{Text: "x", AdvanceBy: AdvanceByVoice},
		},
	})
	assertAppCode(t, err, apperror.ErrReadingVoiceRequired)
}

func TestReadingService_Create_BgmMediaNotInTheme(t *testing.T) {
	f := newReadingFixture(t)
	bad := f.otherBgm.String()
	_, err := f.svc.Create(context.Background(), f.creatorID, f.themeID, CreateReadingSectionRequest{
		Name:       "Bad",
		BgmMediaID: &bad,
		Lines:      []ReadingLineDTO{},
	})
	assertAppCode(t, err, apperror.ErrMediaNotInTheme)
}

func TestReadingService_Create_VoiceMediaNotInTheme(t *testing.T) {
	f := newReadingFixture(t)
	// Create a voice media in another theme and reference it.
	otherVoice := uuid.New()
	otherTheme := uuid.New()
	f.q.themes[otherTheme] = db.Theme{ID: otherTheme, CreatorID: f.creatorID}
	f.q.media[otherVoice] = db.ThemeMedium{ID: otherVoice, ThemeID: otherTheme, Type: MediaTypeVoice}

	_, err := f.svc.Create(context.Background(), f.creatorID, f.themeID, CreateReadingSectionRequest{
		Name: "Bad",
		Lines: []ReadingLineDTO{
			{Text: "x", AdvanceBy: AdvanceByVoice, VoiceMediaID: otherVoice.String()},
		},
	})
	assertAppCode(t, err, apperror.ErrMediaNotInTheme)
}

func TestReadingService_Create_ImageMediaReference(t *testing.T) {
	f := newReadingFixture(t)
	resp, err := f.svc.Create(context.Background(), f.creatorID, f.themeID, CreateReadingSectionRequest{
		Name: "With image",
		Lines: []ReadingLineDTO{
			{Text: "사진을 확인한다.", AdvanceBy: AdvanceByGM, ImageMediaID: f.imageID.String()},
		},
	})
	if err != nil {
		t.Fatalf("create failed: %v", err)
	}
	if got := resp.Lines[0].ImageMediaID; got != f.imageID.String() {
		t.Fatalf("ImageMediaID = %q, want %q", got, f.imageID.String())
	}
}

func TestReadingService_Create_ImageMediaMustBeImageInTheme(t *testing.T) {
	f := newReadingFixture(t)
	_, err := f.svc.Create(context.Background(), f.creatorID, f.themeID, CreateReadingSectionRequest{
		Name: "Wrong type",
		Lines: []ReadingLineDTO{
			{Text: "x", AdvanceBy: AdvanceByGM, ImageMediaID: f.voiceID.String()},
		},
	})
	assertAppCode(t, err, apperror.ErrMediaNotInTheme)
	if !strings.Contains(err.Error(), "line 0: imageMediaId") {
		t.Fatalf("expected line context in error, got %v", err)
	}

	otherImage := uuid.New()
	otherTheme := uuid.New()
	f.q.themes[otherTheme] = db.Theme{ID: otherTheme, CreatorID: f.creatorID}
	f.q.media[otherImage] = db.ThemeMedium{ID: otherImage, ThemeID: otherTheme, Type: MediaTypeImage}

	_, err = f.svc.Create(context.Background(), f.creatorID, f.themeID, CreateReadingSectionRequest{
		Name: "Other theme",
		Lines: []ReadingLineDTO{
			{Text: "x", AdvanceBy: AdvanceByGM, ImageMediaID: otherImage.String()},
		},
	})
	assertAppCode(t, err, apperror.ErrMediaNotInTheme)
}

func TestReadingService_Update_OptimisticLock(t *testing.T) {
	f := newReadingFixture(t)
	created, err := f.svc.Create(context.Background(), f.creatorID, f.themeID, CreateReadingSectionRequest{
		Name:  "Original",
		Lines: []ReadingLineDTO{{Text: "x", AdvanceBy: AdvanceByGM}},
	})
	if err != nil {
		t.Fatalf("seed create failed: %v", err)
	}
	// First update with correct version succeeds.
	updated, err := f.svc.Update(context.Background(), f.creatorID, created.ID, UpdateReadingSectionRequest{
		Name:    ptr("Renamed"),
		Version: created.Version,
	})
	if err != nil {
		t.Fatalf("first update failed: %v", err)
	}
	if updated.Version != created.Version+1 {
		t.Fatalf("version did not bump: %d → %d", created.Version, updated.Version)
	}
	// Second update with stale version fails with conflict.
	_, err = f.svc.Update(context.Background(), f.creatorID, created.ID, UpdateReadingSectionRequest{
		Name:    ptr("Stale"),
		Version: created.Version, // stale
	})
	assertAppCode(t, err, apperror.ErrConflict)
}

func TestReadingService_List_SortedBySortOrder(t *testing.T) {
	f := newReadingFixture(t)
	for _, so := range []int32{2, 0, 1} {
		_, err := f.svc.Create(context.Background(), f.creatorID, f.themeID, CreateReadingSectionRequest{
			Name:      "section",
			Lines:     []ReadingLineDTO{},
			SortOrder: so,
		})
		if err != nil {
			t.Fatalf("create failed: %v", err)
		}
	}
	list, err := f.svc.List(context.Background(), f.creatorID, f.themeID)
	if err != nil {
		t.Fatalf("list failed: %v", err)
	}
	if len(list) != 3 {
		t.Fatalf("expected 3 sections, got %d", len(list))
	}
	for i, s := range list {
		if s.SortOrder != int32(i) {
			t.Errorf("position %d: SortOrder=%d", i, s.SortOrder)
		}
	}
}

func TestReadingService_Delete(t *testing.T) {
	f := newReadingFixture(t)
	created, err := f.svc.Create(context.Background(), f.creatorID, f.themeID, CreateReadingSectionRequest{
		Name:  "doomed",
		Lines: []ReadingLineDTO{},
	})
	if err != nil {
		t.Fatalf("seed create failed: %v", err)
	}
	if err := f.svc.Delete(context.Background(), f.creatorID, created.ID); err != nil {
		t.Fatalf("delete failed: %v", err)
	}
	// Second delete returns NotFound (0 rows affected).
	err = f.svc.Delete(context.Background(), f.creatorID, created.ID)
	assertAppCode(t, err, apperror.ErrReadingSectionNotFound)
}

// Additional safety: lines round-trip through JSON correctly.
func TestReadingService_Create_LinesRoundTripJSON(t *testing.T) {
	f := newReadingFixture(t)
	created, err := f.svc.Create(context.Background(), f.creatorID, f.themeID, CreateReadingSectionRequest{
		Name: "rt",
		Lines: []ReadingLineDTO{
			{Text: "alpha", AdvanceBy: AdvanceByGM},
			{Text: "beta", AdvanceBy: "role:x"},
		},
	})
	if err != nil {
		t.Fatalf("create failed: %v", err)
	}
	// Re-fetch via List.
	list, err := f.svc.List(context.Background(), f.creatorID, f.themeID)
	if err != nil || len(list) != 1 {
		t.Fatalf("list failed: %v len=%d", err, len(list))
	}
	if list[0].ID != created.ID {
		t.Fatalf("id mismatch")
	}
	if list[0].Lines[1].AdvanceBy != "role:x" {
		t.Fatalf("advanceBy not persisted")
	}
	// And confirm raw JSON in the fake's row uses PascalCase keys (engine compat).
	row := f.q.sections[created.ID]
	var raw []map[string]any
	if err := json.Unmarshal(row.Lines, &raw); err != nil {
		t.Fatalf("unmarshal raw lines: %v", err)
	}
	if _, ok := raw[0]["AdvanceBy"]; !ok {
		t.Fatalf("expected PascalCase AdvanceBy key in stored JSON, got %+v", raw[0])
	}
}

// Sanity: BgmMediaID null pgtype yields nil response field.
func TestReadingService_Create_NoBgm_ResponseHasNilBgm(t *testing.T) {
	f := newReadingFixture(t)
	resp, err := f.svc.Create(context.Background(), f.creatorID, f.themeID, CreateReadingSectionRequest{
		Name:  "no-bgm",
		Lines: []ReadingLineDTO{},
	})
	if err != nil {
		t.Fatalf("create failed: %v", err)
	}
	if resp.BgmMediaID != nil {
		t.Fatalf("expected nil BgmMediaID, got %v", *resp.BgmMediaID)
	}
	// Underlying row should also have invalid pgtype.UUID.
	row := f.q.sections[resp.ID]
	if (pgtype.UUID{}) != row.BgmMediaID {
		t.Fatalf("expected empty BgmMediaID pgtype, got %+v", row.BgmMediaID)
	}
}
