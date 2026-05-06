package editor

import (
	"context"
	"encoding/json"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/rs/zerolog"

	"github.com/mmp-platform/server/internal/apperror"
	"github.com/mmp-platform/server/internal/db"
)

type fakeStoryInfoQueries struct {
	themes     map[uuid.UUID]db.Theme
	media      map[uuid.UUID]db.ThemeMedium
	characters map[uuid.UUID]db.ThemeCharacter
	clues      map[uuid.UUID]db.ThemeClue
	locations  map[uuid.UUID]db.ThemeLocation
	infos      map[uuid.UUID]db.StoryInfo
}

func newFakeStoryInfoQueries() *fakeStoryInfoQueries {
	return &fakeStoryInfoQueries{
		themes:     map[uuid.UUID]db.Theme{},
		media:      map[uuid.UUID]db.ThemeMedium{},
		characters: map[uuid.UUID]db.ThemeCharacter{},
		clues:      map[uuid.UUID]db.ThemeClue{},
		locations:  map[uuid.UUID]db.ThemeLocation{},
		infos:      map[uuid.UUID]db.StoryInfo{},
	}
}

func (f *fakeStoryInfoQueries) GetTheme(_ context.Context, id uuid.UUID) (db.Theme, error) {
	row, ok := f.themes[id]
	if !ok {
		return db.Theme{}, pgx.ErrNoRows
	}
	return row, nil
}

func (f *fakeStoryInfoQueries) GetMedia(_ context.Context, id uuid.UUID) (db.ThemeMedium, error) {
	row, ok := f.media[id]
	if !ok {
		return db.ThemeMedium{}, pgx.ErrNoRows
	}
	return row, nil
}

func (f *fakeStoryInfoQueries) GetThemeCharacter(_ context.Context, id uuid.UUID) (db.ThemeCharacter, error) {
	row, ok := f.characters[id]
	if !ok {
		return db.ThemeCharacter{}, pgx.ErrNoRows
	}
	return row, nil
}

func (f *fakeStoryInfoQueries) GetClue(_ context.Context, id uuid.UUID) (db.ThemeClue, error) {
	row, ok := f.clues[id]
	if !ok {
		return db.ThemeClue{}, pgx.ErrNoRows
	}
	return row, nil
}

func (f *fakeStoryInfoQueries) GetLocation(_ context.Context, id uuid.UUID) (db.ThemeLocation, error) {
	row, ok := f.locations[id]
	if !ok {
		return db.ThemeLocation{}, pgx.ErrNoRows
	}
	return row, nil
}

func (f *fakeStoryInfoQueries) ListStoryInfosByTheme(_ context.Context, themeID uuid.UUID) ([]db.StoryInfo, error) {
	out := []db.StoryInfo{}
	for _, info := range f.infos {
		if info.ThemeID == themeID {
			out = append(out, info)
		}
	}
	return out, nil
}

func (f *fakeStoryInfoQueries) GetStoryInfoWithOwner(_ context.Context, arg db.GetStoryInfoWithOwnerParams) (db.StoryInfo, error) {
	info, ok := f.infos[arg.ID]
	if !ok {
		return db.StoryInfo{}, pgx.ErrNoRows
	}
	theme, ok := f.themes[info.ThemeID]
	if !ok || theme.CreatorID != arg.CreatorID {
		return db.StoryInfo{}, pgx.ErrNoRows
	}
	return info, nil
}

func (f *fakeStoryInfoQueries) CreateStoryInfo(_ context.Context, arg db.CreateStoryInfoParams) (db.StoryInfo, error) {
	info := db.StoryInfo{
		ID:                  uuid.New(),
		ThemeID:             arg.ThemeID,
		Title:               arg.Title,
		Body:                arg.Body,
		ImageMediaID:        arg.ImageMediaID,
		RelatedCharacterIds: arg.RelatedCharacterIds,
		RelatedClueIds:      arg.RelatedClueIds,
		RelatedLocationIds:  arg.RelatedLocationIds,
		SortOrder:           arg.SortOrder,
		Version:             1,
		CreatedAt:           time.Now(),
		UpdatedAt:           time.Now(),
	}
	f.infos[info.ID] = info
	return info, nil
}

func (f *fakeStoryInfoQueries) UpdateStoryInfo(_ context.Context, arg db.UpdateStoryInfoParams) (db.StoryInfo, error) {
	info, ok := f.infos[arg.ID]
	if !ok || info.Version != arg.Version {
		return db.StoryInfo{}, pgx.ErrNoRows
	}
	info.Title = arg.Title
	info.Body = arg.Body
	info.ImageMediaID = arg.ImageMediaID
	info.RelatedCharacterIds = arg.RelatedCharacterIds
	info.RelatedClueIds = arg.RelatedClueIds
	info.RelatedLocationIds = arg.RelatedLocationIds
	info.SortOrder = arg.SortOrder
	info.Version++
	info.UpdatedAt = time.Now()
	f.infos[arg.ID] = info
	return info, nil
}

func (f *fakeStoryInfoQueries) DeleteStoryInfoWithOwner(_ context.Context, arg db.DeleteStoryInfoWithOwnerParams) (int64, error) {
	info, ok := f.infos[arg.ID]
	if !ok {
		return 0, nil
	}
	theme, ok := f.themes[info.ThemeID]
	if !ok || theme.CreatorID != arg.CreatorID {
		return 0, nil
	}
	delete(f.infos, arg.ID)
	return 1, nil
}

type storyInfoFixture struct {
	q           *fakeStoryInfoQueries
	svc         *storyInfoService
	creatorID   uuid.UUID
	themeID     uuid.UUID
	imageID     uuid.UUID
	bgmID       uuid.UUID
	characterID uuid.UUID
	clueID      uuid.UUID
	locationID  uuid.UUID
	otherCharID uuid.UUID
}

func newStoryInfoFixture(t *testing.T) *storyInfoFixture {
	t.Helper()
	q := newFakeStoryInfoQueries()
	creatorID := uuid.New()
	themeID := uuid.New()
	otherThemeID := uuid.New()
	q.themes[themeID] = db.Theme{ID: themeID, CreatorID: creatorID}
	q.themes[otherThemeID] = db.Theme{ID: otherThemeID, CreatorID: creatorID}

	imageID := uuid.New()
	bgmID := uuid.New()
	q.media[imageID] = db.ThemeMedium{ID: imageID, ThemeID: themeID, Type: MediaTypeImage}
	q.media[bgmID] = db.ThemeMedium{ID: bgmID, ThemeID: themeID, Type: MediaTypeBGM}

	characterID := uuid.New()
	clueID := uuid.New()
	locationID := uuid.New()
	otherCharID := uuid.New()
	q.characters[characterID] = db.ThemeCharacter{ID: characterID, ThemeID: themeID, Name: "탐정"}
	q.characters[otherCharID] = db.ThemeCharacter{ID: otherCharID, ThemeID: otherThemeID, Name: "외부 인물"}
	q.clues[clueID] = db.ThemeClue{ID: clueID, ThemeID: themeID, Name: "혈흔"}
	q.locations[locationID] = db.ThemeLocation{ID: locationID, ThemeID: themeID, Name: "서재"}

	return &storyInfoFixture{
		q:           q,
		svc:         newStoryInfoServiceWith(q, zerolog.Nop()),
		creatorID:   creatorID,
		themeID:     themeID,
		imageID:     imageID,
		bgmID:       bgmID,
		characterID: characterID,
		clueID:      clueID,
		locationID:  locationID,
		otherCharID: otherCharID,
	}
}

func TestStoryInfoService_Create_SuccessWithImageAndRefs(t *testing.T) {
	f := newStoryInfoFixture(t)
	image := f.imageID.String()

	resp, err := f.svc.Create(context.Background(), f.creatorID, f.themeID, CreateStoryInfoRequest{
		Title:               "피해자의 비밀",
		Body:                "모든 플레이어에게 공개될 정보입니다.",
		ImageMediaID:        &image,
		RelatedCharacterIDs: []string{f.characterID.String(), f.characterID.String()},
		RelatedClueIDs:      []string{f.clueID.String()},
		RelatedLocationIDs:  []string{f.locationID.String()},
		SortOrder:           2,
	})
	if err != nil {
		t.Fatalf("create failed: %v", err)
	}
	if resp.ImageMediaID == nil || *resp.ImageMediaID != image {
		t.Fatalf("image reference not persisted: %+v", resp.ImageMediaID)
	}
	if len(resp.RelatedCharacterIDs) != 1 || resp.RelatedCharacterIDs[0] != f.characterID.String() {
		t.Fatalf("character refs not normalized: %+v", resp.RelatedCharacterIDs)
	}
	if resp.RelatedClueIDs[0] != f.clueID.String() || resp.RelatedLocationIDs[0] != f.locationID.String() {
		t.Fatalf("related refs not persisted: %+v", resp)
	}
}

func TestStoryInfoService_Create_RejectsNonImageMedia(t *testing.T) {
	f := newStoryInfoFixture(t)
	bgm := f.bgmID.String()

	_, err := f.svc.Create(context.Background(), f.creatorID, f.themeID, CreateStoryInfoRequest{
		Title:        "잘못된 이미지",
		ImageMediaID: &bgm,
	})
	assertAppCode(t, err, apperror.ErrMediaNotInTheme)
}

func TestStoryInfoService_Create_RejectsRelatedEntityFromOtherTheme(t *testing.T) {
	f := newStoryInfoFixture(t)

	_, err := f.svc.Create(context.Background(), f.creatorID, f.themeID, CreateStoryInfoRequest{
		Title:               "외부 참조",
		RelatedCharacterIDs: []string{f.otherCharID.String()},
	})
	assertAppCode(t, err, apperror.ErrValidation)
}

func TestStoryInfoService_Update_ClearsImageAndChecksVersion(t *testing.T) {
	f := newStoryInfoFixture(t)
	image := f.imageID.String()
	created, err := f.svc.Create(context.Background(), f.creatorID, f.themeID, CreateStoryInfoRequest{
		Title:        "초기 정보",
		ImageMediaID: &image,
	})
	if err != nil {
		t.Fatalf("create failed: %v", err)
	}

	clearImage := (*string)(nil)
	title := "수정된 정보"
	updated, err := f.svc.Update(context.Background(), f.creatorID, created.ID, UpdateStoryInfoRequest{
		Title:        &title,
		ImageMediaID: &clearImage,
		Version:      created.Version,
	})
	if err != nil {
		t.Fatalf("update failed: %v", err)
	}
	if updated.ImageMediaID != nil || updated.Title != title || updated.Version != created.Version+1 {
		t.Fatalf("unexpected update response: %+v", updated)
	}

	_, err = f.svc.Update(context.Background(), f.creatorID, created.ID, UpdateStoryInfoRequest{
		Version: created.Version,
	})
	assertAppCode(t, err, apperror.ErrConflict)
}

func TestToStoryInfoResponse_DecodesStoredReferences(t *testing.T) {
	charRefs, _ := json.Marshal([]string{"char-1"})
	resp, err := toStoryInfoResponse(db.StoryInfo{
		ID:                  uuid.New(),
		ThemeID:             uuid.New(),
		Title:               "정보",
		RelatedCharacterIds: charRefs,
		RelatedClueIds:      json.RawMessage(`[]`),
		RelatedLocationIds:  json.RawMessage(`[]`),
	})
	if err != nil {
		t.Fatalf("decode failed: %v", err)
	}
	if len(resp.RelatedCharacterIDs) != 1 || resp.RelatedCharacterIDs[0] != "char-1" {
		t.Fatalf("unexpected refs: %+v", resp.RelatedCharacterIDs)
	}
}
