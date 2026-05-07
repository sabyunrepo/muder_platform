package editor

import (
	"context"
	"encoding/json"
	"strings"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/rs/zerolog"

	"github.com/mmp-platform/server/internal/apperror"
	"github.com/mmp-platform/server/internal/db"
)

type fakeStoryInfoQueries struct {
	themes       map[uuid.UUID]db.Theme
	media        map[uuid.UUID]db.ThemeMedium
	mediaRefs    map[uuid.UUID][]db.CreateStoryInfoMediaRefParams
	characters   map[uuid.UUID]db.ThemeCharacter
	clues        map[uuid.UUID]db.ThemeClue
	locations    map[uuid.UUID]db.ThemeLocation
	infos        map[uuid.UUID]db.StoryInfo
	themeErr     error
	mediaErr     error
	charErr      error
	clueErr      error
	locationErr  error
	listErr      error
	getInfoErr   error
	createErr    error
	updateErr    error
	deleteErr    error
	refDeleteErr error
	refCreateErr error
}

func newFakeStoryInfoQueries() *fakeStoryInfoQueries {
	return &fakeStoryInfoQueries{
		themes:     map[uuid.UUID]db.Theme{},
		media:      map[uuid.UUID]db.ThemeMedium{},
		mediaRefs:  map[uuid.UUID][]db.CreateStoryInfoMediaRefParams{},
		characters: map[uuid.UUID]db.ThemeCharacter{},
		clues:      map[uuid.UUID]db.ThemeClue{},
		locations:  map[uuid.UUID]db.ThemeLocation{},
		infos:      map[uuid.UUID]db.StoryInfo{},
	}
}

func (f *fakeStoryInfoQueries) GetTheme(_ context.Context, id uuid.UUID) (db.Theme, error) {
	if f.themeErr != nil {
		return db.Theme{}, f.themeErr
	}
	row, ok := f.themes[id]
	if !ok {
		return db.Theme{}, pgx.ErrNoRows
	}
	return row, nil
}

func (f *fakeStoryInfoQueries) GetMedia(_ context.Context, id uuid.UUID) (db.ThemeMedium, error) {
	if f.mediaErr != nil {
		return db.ThemeMedium{}, f.mediaErr
	}
	row, ok := f.media[id]
	if !ok {
		return db.ThemeMedium{}, pgx.ErrNoRows
	}
	return row, nil
}

func (f *fakeStoryInfoQueries) GetThemeCharacter(_ context.Context, id uuid.UUID) (db.ThemeCharacter, error) {
	if f.charErr != nil {
		return db.ThemeCharacter{}, f.charErr
	}
	row, ok := f.characters[id]
	if !ok {
		return db.ThemeCharacter{}, pgx.ErrNoRows
	}
	return row, nil
}

func (f *fakeStoryInfoQueries) GetClue(_ context.Context, id uuid.UUID) (db.ThemeClue, error) {
	if f.clueErr != nil {
		return db.ThemeClue{}, f.clueErr
	}
	row, ok := f.clues[id]
	if !ok {
		return db.ThemeClue{}, pgx.ErrNoRows
	}
	return row, nil
}

func (f *fakeStoryInfoQueries) GetLocation(_ context.Context, id uuid.UUID) (db.ThemeLocation, error) {
	if f.locationErr != nil {
		return db.ThemeLocation{}, f.locationErr
	}
	row, ok := f.locations[id]
	if !ok {
		return db.ThemeLocation{}, pgx.ErrNoRows
	}
	return row, nil
}

func (f *fakeStoryInfoQueries) ListStoryInfosByTheme(_ context.Context, arg db.ListStoryInfosByThemeParams) ([]db.StoryInfo, error) {
	if f.listErr != nil {
		return nil, f.listErr
	}
	out := []db.StoryInfo{}
	for _, info := range f.infos {
		theme, ok := f.themes[info.ThemeID]
		if info.ThemeID == arg.ThemeID && ok && theme.CreatorID == arg.CreatorID {
			out = append(out, info)
		}
	}
	return out, nil
}

func (f *fakeStoryInfoQueries) GetStoryInfoWithOwner(_ context.Context, arg db.GetStoryInfoWithOwnerParams) (db.StoryInfo, error) {
	if f.getInfoErr != nil {
		return db.StoryInfo{}, f.getInfoErr
	}
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
	if f.createErr != nil {
		return db.StoryInfo{}, f.createErr
	}
	theme, ok := f.themes[arg.ThemeID]
	if !ok || theme.CreatorID != arg.CreatorID {
		return db.StoryInfo{}, pgx.ErrNoRows
	}
	info := db.StoryInfo{
		ID:                  uuid.New(),
		ThemeID:             arg.ThemeID,
		Title:               arg.Title,
		Body:                arg.Body,
		ContentFormat:       arg.ContentFormat,
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
	if f.updateErr != nil {
		return db.StoryInfo{}, f.updateErr
	}
	info, ok := f.infos[arg.ID]
	if !ok || info.Version != arg.Version {
		return db.StoryInfo{}, pgx.ErrNoRows
	}
	theme, ok := f.themes[info.ThemeID]
	if !ok || theme.CreatorID != arg.CreatorID {
		return db.StoryInfo{}, pgx.ErrNoRows
	}
	info.Title = arg.Title
	info.Body = arg.Body
	info.ContentFormat = arg.ContentFormat
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

func (f *fakeStoryInfoQueries) DeleteStoryInfoWithOwner(_ context.Context, arg db.DeleteStoryInfoWithOwnerParams) (uuid.UUID, error) {
	if f.deleteErr != nil {
		return uuid.Nil, f.deleteErr
	}
	info, ok := f.infos[arg.ID]
	if !ok {
		return uuid.Nil, pgx.ErrNoRows
	}
	theme, ok := f.themes[info.ThemeID]
	if !ok || theme.CreatorID != arg.CreatorID {
		return uuid.Nil, pgx.ErrNoRows
	}
	delete(f.infos, arg.ID)
	return info.ThemeID, nil
}

func (f *fakeStoryInfoQueries) DeleteStoryInfoMediaRefs(_ context.Context, storyInfoID uuid.UUID) error {
	if f.refDeleteErr != nil {
		return f.refDeleteErr
	}
	delete(f.mediaRefs, storyInfoID)
	return nil
}

func (f *fakeStoryInfoQueries) CreateStoryInfoMediaRef(_ context.Context, arg db.CreateStoryInfoMediaRefParams) error {
	if f.refCreateErr != nil {
		return f.refCreateErr
	}
	f.mediaRefs[arg.StoryInfoID] = append(f.mediaRefs[arg.StoryInfoID], arg)
	return nil
}

type storyInfoFixture struct {
	q           *fakeStoryInfoQueries
	svc         *storyInfoService
	creatorID   uuid.UUID
	themeID     uuid.UUID
	imageID     uuid.UUID
	videoID     uuid.UUID
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
	videoID := uuid.New()
	bgmID := uuid.New()
	q.media[imageID] = db.ThemeMedium{ID: imageID, ThemeID: themeID, Type: MediaTypeImage}
	q.media[videoID] = db.ThemeMedium{ID: videoID, ThemeID: themeID, Type: MediaTypeVideo, SourceType: SourceTypeYouTube}
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
		videoID:     videoID,
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
	if resp.ContentFormat != StoryInfoContentFormatMDXV1 {
		t.Fatalf("content format default not applied: %q", resp.ContentFormat)
	}
	if len(resp.RelatedCharacterIDs) != 1 || resp.RelatedCharacterIDs[0] != f.characterID.String() {
		t.Fatalf("character refs not normalized: %+v", resp.RelatedCharacterIDs)
	}
	if resp.RelatedClueIDs[0] != f.clueID.String() || resp.RelatedLocationIDs[0] != f.locationID.String() {
		t.Fatalf("related refs not persisted: %+v", resp)
	}
}

func TestStoryInfoService_Create_StoresCoverAndEmbeddedMediaRefs(t *testing.T) {
	f := newStoryInfoFixture(t)
	image := f.imageID.String()
	body := "현장 사진\n\n<MediaEmbed type=\"image\" mediaId=\"" + f.imageID.String() + "\" />\n\n<MediaEmbed mediaId=\"" + f.videoID.String() + "\" type=\"video\" />"

	resp, err := f.svc.Create(context.Background(), f.creatorID, f.themeID, CreateStoryInfoRequest{
		Title:        "미디어 정보",
		Body:         body,
		ImageMediaID: &image,
	})
	if err != nil {
		t.Fatalf("create failed: %v", err)
	}
	refs := f.q.mediaRefs[resp.ID]
	if len(refs) != 3 {
		t.Fatalf("expected cover + 2 embeds, got %#v", refs)
	}
	if refs[0].MediaID != f.imageID || refs[0].Usage != "cover" || refs[0].SortOrder != 0 {
		t.Fatalf("unexpected cover ref: %#v", refs[0])
	}
	if refs[1].MediaID != f.imageID || refs[1].Usage != "embedded_image" || refs[1].SortOrder != 1 {
		t.Fatalf("unexpected image ref: %#v", refs[1])
	}
	if refs[2].MediaID != f.videoID || refs[2].Usage != "embedded_video" || refs[2].SortOrder != 2 {
		t.Fatalf("unexpected video ref: %#v", refs[2])
	}
}

func TestStoryInfoService_Create_ReturnsInternalAndKeepsRefsEmptyWhenRefDeleteFails(t *testing.T) {
	f := newStoryInfoFixture(t)
	f.q.refDeleteErr = context.DeadlineExceeded
	image := f.imageID.String()

	resp, err := f.svc.Create(context.Background(), f.creatorID, f.themeID, CreateStoryInfoRequest{
		Title:        "ref delete 실패",
		Body:         `<MediaEmbed mediaId="` + f.videoID.String() + `" type="video" />`,
		ImageMediaID: &image,
	})
	if resp != nil {
		t.Fatalf("expected nil response, got %+v", resp)
	}
	assertAppCode(t, err, apperror.ErrInternal)
	if len(f.q.mediaRefs) != 0 {
		t.Fatalf("expected no media refs after delete failure, got %#v", f.q.mediaRefs)
	}
}

func TestStoryInfoService_Create_ReturnsInternalAndKeepsRefsEmptyWhenRefCreateFails(t *testing.T) {
	f := newStoryInfoFixture(t)
	f.q.refCreateErr = context.DeadlineExceeded
	image := f.imageID.String()

	resp, err := f.svc.Create(context.Background(), f.creatorID, f.themeID, CreateStoryInfoRequest{
		Title:        "ref create 실패",
		Body:         `<MediaEmbed mediaId="` + f.videoID.String() + `" type="video" />`,
		ImageMediaID: &image,
	})
	if resp != nil {
		t.Fatalf("expected nil response, got %+v", resp)
	}
	assertAppCode(t, err, apperror.ErrInternal)
	if len(f.q.mediaRefs) != 0 {
		t.Fatalf("expected no partial media refs after create failure, got %#v", f.q.mediaRefs)
	}
}

func TestStoryInfoService_Create_RejectsInvalidEmbeddedMediaRefs(t *testing.T) {
	f := newStoryInfoFixture(t)
	_, err := f.svc.Create(context.Background(), f.creatorID, f.themeID, CreateStoryInfoRequest{
		Title: "잘못된 embed",
		Body:  `<MediaEmbed mediaId="not-a-uuid" type="image" />`,
	})
	assertAppCode(t, err, apperror.ErrMediaNotInTheme)

	_, err = f.svc.Create(context.Background(), f.creatorID, f.themeID, CreateStoryInfoRequest{
		Title: "타입 불일치 embed",
		Body:  `<MediaEmbed mediaId="` + f.imageID.String() + `" type="video" />`,
	})
	assertAppCode(t, err, apperror.ErrMediaNotInTheme)

	_, err = f.svc.Create(context.Background(), f.creatorID, f.themeID, CreateStoryInfoRequest{
		Title: "지원하지 않는 embed",
		Body:  `<MediaEmbed mediaId="` + f.imageID.String() + `" type="audio" />`,
	})
	assertAppCode(t, err, apperror.ErrValidation)

	fileVideoID := uuid.New()
	f.q.media[fileVideoID] = db.ThemeMedium{ID: fileVideoID, ThemeID: f.themeID, Type: MediaTypeVideo, SourceType: SourceTypeFile}
	_, err = f.svc.Create(context.Background(), f.creatorID, f.themeID, CreateStoryInfoRequest{
		Title: "YouTube가 아닌 영상 embed",
		Body:  `<MediaEmbed mediaId="` + fileVideoID.String() + `" />`,
	})
	assertAppCode(t, err, apperror.ErrMediaNotInTheme)
}

func TestStoryInfoService_NewConstructsConcreteService(t *testing.T) {
	if svc := NewStoryInfoService(nil, nil, zerolog.Nop()); svc == nil {
		t.Fatal("expected service")
	}
}

func TestStoryInfoService_List_RejectsUnknownAndForeignTheme(t *testing.T) {
	f := newStoryInfoFixture(t)

	_, err := f.svc.List(context.Background(), f.creatorID, uuid.New())
	assertAppCode(t, err, apperror.ErrNotFound)

	_, err = f.svc.List(context.Background(), uuid.New(), f.themeID)
	assertAppCode(t, err, apperror.ErrNotFound)
}

func TestStoryInfoService_List_ReturnsInternalForThemeListAndDecodeFailures(t *testing.T) {
	f := newStoryInfoFixture(t)
	f.q.themeErr = context.DeadlineExceeded
	_, err := f.svc.List(context.Background(), f.creatorID, f.themeID)
	assertAppCode(t, err, apperror.ErrInternal)

	f = newStoryInfoFixture(t)
	f.q.listErr = context.DeadlineExceeded
	_, err = f.svc.List(context.Background(), f.creatorID, f.themeID)
	assertAppCode(t, err, apperror.ErrInternal)

	f = newStoryInfoFixture(t)
	f.q.infos[uuid.New()] = db.StoryInfo{
		ID:                  uuid.New(),
		ThemeID:             f.themeID,
		Title:               "손상 정보",
		RelatedCharacterIds: json.RawMessage(`{`),
		RelatedClueIds:      json.RawMessage(`[]`),
		RelatedLocationIds:  json.RawMessage(`[]`),
	}
	_, err = f.svc.List(context.Background(), f.creatorID, f.themeID)
	assertAppCode(t, err, apperror.ErrInternal)
}

func TestStoryInfoService_Create_ValidatesRequiredAndLengthLimits(t *testing.T) {
	f := newStoryInfoFixture(t)

	_, err := f.svc.Create(context.Background(), f.creatorID, uuid.New(), CreateStoryInfoRequest{Title: "없는 테마"})
	assertAppCode(t, err, apperror.ErrNotFound)

	_, err = f.svc.Create(context.Background(), f.creatorID, f.themeID, CreateStoryInfoRequest{Title: "   "})
	assertAppCode(t, err, apperror.ErrValidation)

	_, err = f.svc.Create(context.Background(), f.creatorID, f.themeID, CreateStoryInfoRequest{
		Title: strings.Repeat("가", MaxStoryInfoTitleLength+1),
	})
	assertAppCode(t, err, apperror.ErrValidation)

	_, err = f.svc.Create(context.Background(), f.creatorID, f.themeID, CreateStoryInfoRequest{
		Title: "본문 초과",
		Body:  strings.Repeat("가", MaxStoryInfoBodyLength+1),
	})
	assertAppCode(t, err, apperror.ErrValidation)
}

func TestStoryInfoService_Create_ValidatesImageReference(t *testing.T) {
	f := newStoryInfoFixture(t)
	invalid := "not-a-uuid"
	_, err := f.svc.Create(context.Background(), f.creatorID, f.themeID, CreateStoryInfoRequest{
		Title:        "잘못된 이미지",
		ImageMediaID: &invalid,
	})
	assertAppCode(t, err, apperror.ErrMediaNotInTheme)

	missing := uuid.New().String()
	_, err = f.svc.Create(context.Background(), f.creatorID, f.themeID, CreateStoryInfoRequest{
		Title:        "없는 이미지",
		ImageMediaID: &missing,
	})
	assertAppCode(t, err, apperror.ErrMediaNotInTheme)

	f.q.mediaErr = context.DeadlineExceeded
	image := f.imageID.String()
	_, err = f.svc.Create(context.Background(), f.creatorID, f.themeID, CreateStoryInfoRequest{
		Title:        "이미지 조회 실패",
		ImageMediaID: &image,
	})
	assertAppCode(t, err, apperror.ErrInternal)
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

func TestStoryInfoService_Create_ReturnsInternalForRelatedLookupFailure(t *testing.T) {
	f := newStoryInfoFixture(t)
	f.q.charErr = context.DeadlineExceeded

	_, err := f.svc.Create(context.Background(), f.creatorID, f.themeID, CreateStoryInfoRequest{
		Title:               "DB 장애",
		RelatedCharacterIDs: []string{f.characterID.String()},
	})
	assertAppCode(t, err, apperror.ErrInternal)
}

func TestStoryInfoService_Create_ValidatesRelatedIDsAndLookupErrors(t *testing.T) {
	f := newStoryInfoFixture(t)
	tooMany := make([]string, MaxStoryInfoRefs+1)
	for i := range tooMany {
		tooMany[i] = uuid.New().String()
	}
	_, err := f.svc.Create(context.Background(), f.creatorID, f.themeID, CreateStoryInfoRequest{
		Title:               "참조 초과",
		RelatedCharacterIDs: tooMany,
	})
	assertAppCode(t, err, apperror.ErrValidation)

	_, err = f.svc.Create(context.Background(), f.creatorID, f.themeID, CreateStoryInfoRequest{
		Title:          "잘못된 단서",
		RelatedClueIDs: []string{"bad-clue-id"},
	})
	assertAppCode(t, err, apperror.ErrValidation)

	_, err = f.svc.Create(context.Background(), f.creatorID, f.themeID, CreateStoryInfoRequest{
		Title:              "없는 장소",
		RelatedLocationIDs: []string{uuid.New().String()},
	})
	assertAppCode(t, err, apperror.ErrValidation)

	f.q.clueErr = context.DeadlineExceeded
	_, err = f.svc.Create(context.Background(), f.creatorID, f.themeID, CreateStoryInfoRequest{
		Title:          "단서 조회 실패",
		RelatedClueIDs: []string{f.clueID.String()},
	})
	assertAppCode(t, err, apperror.ErrInternal)

	f = newStoryInfoFixture(t)
	f.q.locationErr = context.DeadlineExceeded
	_, err = f.svc.Create(context.Background(), f.creatorID, f.themeID, CreateStoryInfoRequest{
		Title:              "장소 조회 실패",
		RelatedLocationIDs: []string{f.locationID.String()},
	})
	assertAppCode(t, err, apperror.ErrInternal)
}

func TestStoryInfoService_Create_ReturnsInternalForInsertFailure(t *testing.T) {
	f := newStoryInfoFixture(t)
	f.q.createErr = context.DeadlineExceeded

	_, err := f.svc.Create(context.Background(), f.creatorID, f.themeID, CreateStoryInfoRequest{Title: "저장 실패"})
	assertAppCode(t, err, apperror.ErrInternal)
}

func TestStoryInfoService_Create_RollsBackStoryRowWhenMediaRefInsertFails(t *testing.T) {
	f := setupFixture(t)
	ctx := context.Background()
	creatorID := f.createUser(t)
	themeID := f.createThemeForUser(t, creatorID)
	svc := NewStoryInfoService(f.q, f.pool, zerolog.Nop()).(*storyInfoService)

	_, err := svc.createStoryInfoWithRefs(ctx, db.CreateStoryInfoParams{
		ThemeID:             themeID,
		Title:               "tx create rollback",
		Body:                "본문",
		ContentFormat:       StoryInfoContentFormatMDXV1,
		RelatedCharacterIds: json.RawMessage(`[]`),
		RelatedClueIds:      json.RawMessage(`[]`),
		RelatedLocationIds:  json.RawMessage(`[]`),
		CreatorID:           creatorID,
	}, []storyInfoMediaRef{{
		mediaID:   uuid.New(),
		usage:     "embedded_image",
		sortOrder: 0,
	}})
	if err == nil {
		t.Fatal("expected media ref insert failure")
	}
	assertStoryInfoTitleCount(t, f.pool, themeID, "tx create rollback", 0)
}

func TestStoryInfoService_List_ScopesRowsToCreatorTheme(t *testing.T) {
	f := newStoryInfoFixture(t)
	otherCreator := uuid.New()
	otherThemeID := uuid.New()
	f.q.themes[otherThemeID] = db.Theme{ID: otherThemeID, CreatorID: otherCreator}
	owned := db.StoryInfo{ID: uuid.New(), ThemeID: f.themeID, Title: "소유 정보", RelatedCharacterIds: json.RawMessage(`[]`), RelatedClueIds: json.RawMessage(`[]`), RelatedLocationIds: json.RawMessage(`[]`)}
	foreign := db.StoryInfo{ID: uuid.New(), ThemeID: otherThemeID, Title: "외부 정보", RelatedCharacterIds: json.RawMessage(`[]`), RelatedClueIds: json.RawMessage(`[]`), RelatedLocationIds: json.RawMessage(`[]`)}
	f.q.infos[owned.ID] = owned
	f.q.infos[foreign.ID] = foreign

	got, err := f.svc.List(context.Background(), f.creatorID, f.themeID)
	if err != nil {
		t.Fatalf("list failed: %v", err)
	}
	if len(got) != 1 || got[0].ID != owned.ID {
		t.Fatalf("unexpected scoped rows: %+v", got)
	}
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

func TestStoryInfoService_Update_RejectsMissingForeignAndCorruptRows(t *testing.T) {
	f := newStoryInfoFixture(t)
	_, err := f.svc.Update(context.Background(), f.creatorID, uuid.New(), UpdateStoryInfoRequest{Version: 1})
	assertAppCode(t, err, apperror.ErrNotFound)

	created, err := f.svc.Create(context.Background(), f.creatorID, f.themeID, CreateStoryInfoRequest{Title: "수정 정보"})
	if err != nil {
		t.Fatalf("create failed: %v", err)
	}
	_, err = f.svc.Update(context.Background(), uuid.New(), created.ID, UpdateStoryInfoRequest{Version: created.Version})
	assertAppCode(t, err, apperror.ErrNotFound)

	f.q.infos[created.ID] = db.StoryInfo{
		ID:                  created.ID,
		ThemeID:             f.themeID,
		Title:               "손상 정보",
		RelatedCharacterIds: json.RawMessage(`[]`),
		RelatedClueIds:      json.RawMessage(`{`),
		RelatedLocationIds:  json.RawMessage(`[]`),
		Version:             created.Version,
	}
	_, err = f.svc.Update(context.Background(), f.creatorID, created.ID, UpdateStoryInfoRequest{Version: created.Version})
	assertAppCode(t, err, apperror.ErrInternal)
}

func TestStoryInfoService_Update_ChangesRefsSortAndImage(t *testing.T) {
	f := newStoryInfoFixture(t)
	created, err := f.svc.Create(context.Background(), f.creatorID, f.themeID, CreateStoryInfoRequest{Title: "수정 전"})
	if err != nil {
		t.Fatalf("create failed: %v", err)
	}
	body := "수정 본문"
	sortOrder := int32(7)
	image := f.imageID.String()
	imagePtr := &image

	updated, err := f.svc.Update(context.Background(), f.creatorID, created.ID, UpdateStoryInfoRequest{
		Body:                &body,
		ImageMediaID:        &imagePtr,
		RelatedCharacterIDs: &[]string{f.characterID.String()},
		RelatedClueIDs:      &[]string{f.clueID.String()},
		RelatedLocationIDs:  &[]string{f.locationID.String()},
		SortOrder:           &sortOrder,
		Version:             created.Version,
	})
	if err != nil {
		t.Fatalf("update failed: %v", err)
	}
	if updated.Body != body || updated.SortOrder != sortOrder || updated.ImageMediaID == nil || *updated.ImageMediaID != image {
		t.Fatalf("unexpected update response: %+v", updated)
	}
	if len(updated.RelatedClueIDs) != 1 || updated.RelatedClueIDs[0] != f.clueID.String() {
		t.Fatalf("related refs not updated: %+v", updated)
	}
}

func TestStoryInfoService_Update_ReplacesStoryInfoMediaRefs(t *testing.T) {
	f := newStoryInfoFixture(t)
	image := f.imageID.String()
	created, err := f.svc.Create(context.Background(), f.creatorID, f.themeID, CreateStoryInfoRequest{
		Title:        "수정 전",
		Body:         `<MediaEmbed mediaId="` + f.imageID.String() + `" type="image" />`,
		ImageMediaID: &image,
	})
	if err != nil {
		t.Fatalf("create failed: %v", err)
	}
	if len(f.q.mediaRefs[created.ID]) != 2 {
		t.Fatalf("expected initial refs, got %#v", f.q.mediaRefs[created.ID])
	}

	body := `<MediaEmbed mediaId="` + f.videoID.String() + `" type="video" />`
	clearImage := (*string)(nil)
	updated, err := f.svc.Update(context.Background(), f.creatorID, created.ID, UpdateStoryInfoRequest{
		Body:         &body,
		ImageMediaID: &clearImage,
		Version:      created.Version,
	})
	if err != nil {
		t.Fatalf("update failed: %v", err)
	}
	refs := f.q.mediaRefs[updated.ID]
	if len(refs) != 1 || refs[0].MediaID != f.videoID || refs[0].Usage != "embedded_video" || refs[0].SortOrder != 0 {
		t.Fatalf("expected replaced video ref only, got %#v", refs)
	}
}

func TestStoryInfoService_Update_ReturnsInternalAndKeepsExistingRefsWhenRefDeleteFails(t *testing.T) {
	f := newStoryInfoFixture(t)
	image := f.imageID.String()
	created, err := f.svc.Create(context.Background(), f.creatorID, f.themeID, CreateStoryInfoRequest{
		Title:        "수정 전",
		Body:         `<MediaEmbed mediaId="` + f.imageID.String() + `" type="image" />`,
		ImageMediaID: &image,
	})
	if err != nil {
		t.Fatalf("create failed: %v", err)
	}
	before := append([]db.CreateStoryInfoMediaRefParams(nil), f.q.mediaRefs[created.ID]...)
	body := `<MediaEmbed mediaId="` + f.videoID.String() + `" type="video" />`
	f.q.refDeleteErr = context.DeadlineExceeded

	resp, err := f.svc.Update(context.Background(), f.creatorID, created.ID, UpdateStoryInfoRequest{
		Body:    &body,
		Version: created.Version,
	})
	if resp != nil {
		t.Fatalf("expected nil response, got %+v", resp)
	}
	assertAppCode(t, err, apperror.ErrInternal)
	after := f.q.mediaRefs[created.ID]
	if len(after) != len(before) {
		t.Fatalf("expected existing refs to remain after delete failure, before=%#v after=%#v", before, after)
	}
	for i := range before {
		if after[i] != before[i] {
			t.Fatalf("expected existing refs to remain after delete failure, before=%#v after=%#v", before, after)
		}
	}
}

func TestStoryInfoService_Update_ReturnsInternalAndKeepsNoPartialRefsWhenRefCreateFails(t *testing.T) {
	f := newStoryInfoFixture(t)
	image := f.imageID.String()
	created, err := f.svc.Create(context.Background(), f.creatorID, f.themeID, CreateStoryInfoRequest{
		Title:        "수정 전",
		Body:         `<MediaEmbed mediaId="` + f.imageID.String() + `" type="image" />`,
		ImageMediaID: &image,
	})
	if err != nil {
		t.Fatalf("create failed: %v", err)
	}
	body := `<MediaEmbed mediaId="` + f.videoID.String() + `" type="video" />`
	f.q.refCreateErr = context.DeadlineExceeded

	resp, err := f.svc.Update(context.Background(), f.creatorID, created.ID, UpdateStoryInfoRequest{
		Body:    &body,
		Version: created.Version,
	})
	if resp != nil {
		t.Fatalf("expected nil response, got %+v", resp)
	}
	assertAppCode(t, err, apperror.ErrInternal)
	if refs := f.q.mediaRefs[created.ID]; len(refs) != 0 {
		t.Fatalf("expected no partial media refs after create failure, got %#v", refs)
	}
}

func TestStoryInfoService_Update_ReturnsInternalForReadAndWriteFailures(t *testing.T) {
	f := newStoryInfoFixture(t)
	f.q.getInfoErr = context.DeadlineExceeded
	_, err := f.svc.Update(context.Background(), f.creatorID, uuid.New(), UpdateStoryInfoRequest{Version: 1})
	assertAppCode(t, err, apperror.ErrInternal)

	f = newStoryInfoFixture(t)
	created, err := f.svc.Create(context.Background(), f.creatorID, f.themeID, CreateStoryInfoRequest{Title: "수정 실패"})
	if err != nil {
		t.Fatalf("create failed: %v", err)
	}
	f.q.updateErr = context.DeadlineExceeded
	_, err = f.svc.Update(context.Background(), f.creatorID, created.ID, UpdateStoryInfoRequest{Version: created.Version})
	assertAppCode(t, err, apperror.ErrInternal)
}

func TestStoryInfoService_Update_RollsBackStoryRowAndRefsWhenMediaRefInsertFails(t *testing.T) {
	f := setupFixture(t)
	ctx := context.Background()
	creatorID := f.createUser(t)
	themeID := f.createThemeForUser(t, creatorID)
	image := createLocationMedia(t, f.q, themeID, "tx-image", MediaTypeImage)
	svc := NewStoryInfoService(f.q, f.pool, zerolog.Nop()).(*storyInfoService)

	created, err := svc.createStoryInfoWithRefs(ctx, db.CreateStoryInfoParams{
		ThemeID:             themeID,
		Title:               "tx update before",
		Body:                "본문",
		ContentFormat:       StoryInfoContentFormatMDXV1,
		RelatedCharacterIds: json.RawMessage(`[]`),
		RelatedClueIds:      json.RawMessage(`[]`),
		RelatedLocationIds:  json.RawMessage(`[]`),
		CreatorID:           creatorID,
	}, []storyInfoMediaRef{{
		mediaID:   image.ID,
		usage:     "embedded_image",
		sortOrder: 0,
	}})
	if err != nil {
		t.Fatalf("createStoryInfoWithRefs: %v", err)
	}

	_, err = svc.updateStoryInfoWithRefs(ctx, db.UpdateStoryInfoParams{
		ID:                  created.ID,
		Title:               "tx update after",
		Body:                "변경 본문",
		ContentFormat:       StoryInfoContentFormatMDXV1,
		RelatedCharacterIds: json.RawMessage(`[]`),
		RelatedClueIds:      json.RawMessage(`[]`),
		RelatedLocationIds:  json.RawMessage(`[]`),
		Version:             created.Version,
		CreatorID:           creatorID,
	}, []storyInfoMediaRef{{
		mediaID:   uuid.New(),
		usage:     "embedded_image",
		sortOrder: 0,
	}})
	if err == nil {
		t.Fatal("expected media ref insert failure")
	}
	assertStoryInfoRow(t, f.pool, created.ID, "tx update before", created.Version)
	assertStoryInfoMediaRefCount(t, f.pool, created.ID, 1)
}

func TestStoryInfoService_Delete_ReturnsThemeIDAndRemovesRow(t *testing.T) {
	f := newStoryInfoFixture(t)
	created, err := f.svc.Create(context.Background(), f.creatorID, f.themeID, CreateStoryInfoRequest{Title: "삭제 정보"})
	if err != nil {
		t.Fatalf("create failed: %v", err)
	}

	themeID, err := f.svc.Delete(context.Background(), f.creatorID, created.ID)
	if err != nil {
		t.Fatalf("delete failed: %v", err)
	}
	if themeID != f.themeID {
		t.Fatalf("theme id: want %s, got %s", f.themeID, themeID)
	}
	if _, ok := f.q.infos[created.ID]; ok {
		t.Fatal("expected story info row to be deleted")
	}
}

func TestStoryInfoService_Delete_NotFoundForWrongOwner(t *testing.T) {
	f := newStoryInfoFixture(t)
	created, err := f.svc.Create(context.Background(), f.creatorID, f.themeID, CreateStoryInfoRequest{Title: "삭제 정보"})
	if err != nil {
		t.Fatalf("create failed: %v", err)
	}

	_, err = f.svc.Delete(context.Background(), uuid.New(), created.ID)
	assertAppCode(t, err, apperror.ErrNotFound)
}

func TestStoryInfoService_Delete_ReturnsInternalForDeleteFailure(t *testing.T) {
	f := newStoryInfoFixture(t)
	f.q.deleteErr = context.DeadlineExceeded

	_, err := f.svc.Delete(context.Background(), f.creatorID, uuid.New())
	assertAppCode(t, err, apperror.ErrInternal)
}

func assertStoryInfoTitleCount(t *testing.T, pool *pgxpool.Pool, themeID uuid.UUID, title string, want int) {
	t.Helper()
	var got int
	err := pool.QueryRow(context.Background(), `
		SELECT count(*)
		FROM story_infos
		WHERE theme_id = $1 AND title = $2
	`, themeID, title).Scan(&got)
	if err != nil {
		t.Fatalf("count story_infos: %v", err)
	}
	if got != want {
		t.Fatalf("story info count = %d, want %d", got, want)
	}
}

func assertStoryInfoRow(t *testing.T, pool *pgxpool.Pool, infoID uuid.UUID, wantTitle string, wantVersion int32) {
	t.Helper()
	var title string
	var version int32
	err := pool.QueryRow(context.Background(), `
		SELECT title, version
		FROM story_infos
		WHERE id = $1
	`, infoID).Scan(&title, &version)
	if err != nil {
		t.Fatalf("select story_info: %v", err)
	}
	if title != wantTitle || version != wantVersion {
		t.Fatalf("story info row = title %q version %d, want title %q version %d", title, version, wantTitle, wantVersion)
	}
}

func assertStoryInfoMediaRefCount(t *testing.T, pool *pgxpool.Pool, infoID uuid.UUID, want int) {
	t.Helper()
	var got int
	err := pool.QueryRow(context.Background(), `
		SELECT count(*)
		FROM story_info_media_refs
		WHERE story_info_id = $1
	`, infoID).Scan(&got)
	if err != nil {
		t.Fatalf("count story_info_media_refs: %v", err)
	}
	if got != want {
		t.Fatalf("story info media ref count = %d, want %d", got, want)
	}
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

func TestDecodeStoryInfoRefs_TreatsEmptyAndNullAsEmpty(t *testing.T) {
	for _, raw := range []json.RawMessage{nil, json.RawMessage(`null`)} {
		got, err := decodeStoryInfoRefs(raw)
		if err != nil {
			t.Fatalf("decode failed: %v", err)
		}
		if len(got) != 0 {
			t.Fatalf("expected empty refs, got %+v", got)
		}
	}
}
