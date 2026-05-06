package editor

import (
	"context"
	"encoding/json"
	"errors"
	"testing"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"

	"github.com/mmp-platform/server/internal/apperror"
	"github.com/mmp-platform/server/internal/db"
)

func int32Value(value int32) *int32 { return &value }

func TestBuildLocationAccessPolicy(t *testing.T) {
	t.Parallel()

	t.Run("restricted character CSV를 trim/dedupe하고 저장용 문자열을 정규화한다", func(t *testing.T) {
		t.Parallel()
		policy, err := BuildLocationAccessPolicy(stringPtr(" char-1, char-2, char-1,  "), int32Value(2), int32Value(4))
		if err != nil {
			t.Fatalf("BuildLocationAccessPolicy returned error: %v", err)
		}

		if got, want := policy.RestrictedCharacterIDs, []string{"char-1", "char-2"}; !stringSlicesEqual(got, want) {
			t.Fatalf("RestrictedCharacterIDs = %v, want %v", got, want)
		}
		if policy.RestrictedCharacters == nil || *policy.RestrictedCharacters != "char-1,char-2" {
			t.Fatalf("RestrictedCharacters = %v, want char-1,char-2", policy.RestrictedCharacters)
		}
		if policy.IsPublic() {
			t.Fatal("restricted policy should not be public")
		}
	})

	t.Run("빈 제한값은 공개 장소로 해석한다", func(t *testing.T) {
		t.Parallel()
		policy, err := BuildLocationAccessPolicy(stringPtr(" , "), nil, nil)
		if err != nil {
			t.Fatalf("BuildLocationAccessPolicy returned error: %v", err)
		}

		if !policy.IsPublic() {
			t.Fatal("empty restricted characters should be public")
		}
		if policy.RestrictedCharacters != nil {
			t.Fatalf("RestrictedCharacters = %v, want nil", *policy.RestrictedCharacters)
		}
	})

	t.Run("라운드 범위와 캐릭터 제한으로 접근 가능 여부를 판단한다", func(t *testing.T) {
		t.Parallel()
		policy, err := BuildLocationAccessPolicy(stringPtr("char-2"), int32Value(2), int32Value(4))
		if err != nil {
			t.Fatalf("BuildLocationAccessPolicy returned error: %v", err)
		}

		cases := []struct {
			name        string
			characterID string
			round       int32
			want        bool
		}{
			{name: "before visible round", characterID: "char-1", round: 1, want: false},
			{name: "allowed character in range", characterID: "char-1", round: 2, want: true},
			{name: "missing character context on restricted location", characterID: " ", round: 2, want: false},
			{name: "restricted character in range", characterID: "char-2", round: 3, want: false},
			{name: "restricted character with whitespace in range", characterID: " char-2 ", round: 3, want: false},
			{name: "after visible round", characterID: "char-1", round: 5, want: false},
		}

		for _, tc := range cases {
			tc := tc
			t.Run(tc.name, func(t *testing.T) {
				t.Parallel()
				if got := policy.CanCharacterAccess(tc.characterID, tc.round); got != tc.want {
					t.Fatalf("CanCharacterAccess(%q, %d) = %v, want %v", tc.characterID, tc.round, got, tc.want)
				}
			})
		}
	})

	t.Run("from_round이 until_round보다 크면 거부한다", func(t *testing.T) {
		t.Parallel()
		if _, err := BuildLocationAccessPolicy(nil, int32Value(5), int32Value(3)); err == nil {
			t.Fatal("expected invalid round order error")
		}
	})
}

func TestOptionalUUIDUnmarshal(t *testing.T) {
	t.Parallel()

	type patch struct {
		ImageMediaID OptionalUUID `json:"image_media_id"`
	}
	var omitted patch
	if err := json.Unmarshal([]byte(`{}`), &omitted); err != nil {
		t.Fatalf("unmarshal omitted: %v", err)
	}
	if omitted.ImageMediaID.Set {
		t.Fatal("omitted image_media_id should not be marked as set")
	}

	var cleared patch
	if err := json.Unmarshal([]byte(`{"image_media_id":null}`), &cleared); err != nil {
		t.Fatalf("unmarshal null: %v", err)
	}
	if !cleared.ImageMediaID.Set || cleared.ImageMediaID.Value != nil {
		t.Fatalf("null image_media_id = %+v, want set with nil value", cleared.ImageMediaID)
	}

	rawID := uuid.New()
	var selected patch
	if err := json.Unmarshal([]byte(`{"image_media_id":"`+rawID.String()+`"}`), &selected); err != nil {
		t.Fatalf("unmarshal uuid: %v", err)
	}
	if !selected.ImageMediaID.Set || selected.ImageMediaID.Value == nil || *selected.ImageMediaID.Value != rawID {
		t.Fatalf("uuid image_media_id = %+v, want %s", selected.ImageMediaID, rawID)
	}
}

func stringSlicesEqual(a, b []string) bool {
	if len(a) != len(b) {
		return false
	}
	for i := range a {
		if a[i] != b[i] {
			return false
		}
	}
	return true
}

func TestService_LocationRestrictedCharactersMustBelongToTheme(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test in short mode")
	}
	f := setupFixture(t)
	ctx := context.Background()
	creatorID := f.createUser(t)
	themeID := f.createThemeForUser(t, creatorID)
	otherThemeID := f.createThemeForUser(t, creatorID)
	mapResp, err := f.svc.CreateMap(ctx, creatorID, themeID, CreateMapRequest{Name: "지도"})
	if err != nil {
		t.Fatalf("CreateMap: %v", err)
	}
	allowedChar, err := f.svc.CreateCharacter(ctx, creatorID, themeID, CreateCharacterRequest{Name: "탐정"})
	if err != nil {
		t.Fatalf("CreateCharacter allowed: %v", err)
	}
	otherChar, err := f.svc.CreateCharacter(ctx, creatorID, otherThemeID, CreateCharacterRequest{Name: "다른 테마 캐릭터"})
	if err != nil {
		t.Fatalf("CreateCharacter other: %v", err)
	}

	allowedCSV := allowedChar.ID.String() + "," + allowedChar.ID.String()
	created, err := f.svc.CreateLocation(ctx, creatorID, themeID, mapResp.ID, CreateLocationRequest{
		Name:                 "서재",
		RestrictedCharacters: &allowedCSV,
	})
	if err != nil {
		t.Fatalf("CreateLocation with theme character: %v", err)
	}
	if created.RestrictedCharacters == nil || *created.RestrictedCharacters != allowedChar.ID.String() {
		t.Fatalf("RestrictedCharacters = %v, want normalized allowed id", created.RestrictedCharacters)
	}

	invalidCSV := otherChar.ID.String()
	if _, err := f.svc.CreateLocation(ctx, creatorID, themeID, mapResp.ID, CreateLocationRequest{
		Name:                 "금지 장소",
		RestrictedCharacters: &invalidCSV,
	}); !isBadRequest(err) {
		t.Fatalf("CreateLocation with other theme character error = %T %v, want bad request", err, err)
	}
	if _, err := f.svc.UpdateLocation(ctx, creatorID, created.ID, UpdateLocationRequest{
		Name:                 created.Name,
		RestrictedCharacters: &invalidCSV,
		SortOrder:            created.SortOrder,
		FromRound:            created.FromRound,
		UntilRound:           created.UntilRound,
	}); !isBadRequest(err) {
		t.Fatalf("UpdateLocation with other theme character error = %T %v, want bad request", err, err)
	}
}

func TestService_LocationImageMediaReference(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test in short mode")
	}
	f := setupFixture(t)
	ctx := context.Background()
	creatorID := f.createUser(t)
	themeID := f.createThemeForUser(t, creatorID)
	otherThemeID := f.createThemeForUser(t, creatorID)
	mapResp, err := f.svc.CreateMap(ctx, creatorID, themeID, CreateMapRequest{Name: "지도"})
	if err != nil {
		t.Fatalf("CreateMap: %v", err)
	}
	media := createLocationMedia(t, f.q, themeID, "장소 이미지", MediaTypeImage)
	otherThemeMedia := createLocationMedia(t, f.q, otherThemeID, "다른 테마 이미지", MediaTypeImage)
	voiceMedia := createLocationMedia(t, f.q, themeID, "효과음", MediaTypeVoice)

	imageID := media.ID
	created, err := f.svc.CreateLocation(ctx, creatorID, themeID, mapResp.ID, CreateLocationRequest{
		Name:         "서재",
		ImageMediaID: &imageID,
	})
	if err != nil {
		t.Fatalf("CreateLocation with image media: %v", err)
	}
	if created.ImageMediaID == nil || *created.ImageMediaID != media.ID {
		t.Fatalf("ImageMediaID = %v, want %s", created.ImageMediaID, media.ID)
	}

	otherThemeImageID := otherThemeMedia.ID
	otherThemeImageRef := &otherThemeImageID
	if _, err := f.svc.UpdateLocation(ctx, creatorID, created.ID, UpdateLocationRequest{
		Name:         created.Name,
		ImageMediaID: OptionalUUID{Set: true, Value: otherThemeImageRef},
	}); !isMediaNotInTheme(err) {
		t.Fatalf("UpdateLocation with other theme image error = %T %v, want media not in theme", err, err)
	}
	voiceID := voiceMedia.ID
	voiceRef := &voiceID
	if _, err := f.svc.UpdateLocation(ctx, creatorID, created.ID, UpdateLocationRequest{
		Name:         created.Name,
		ImageMediaID: OptionalUUID{Set: true, Value: voiceRef},
	}); !isMediaNotInTheme(err) {
		t.Fatalf("UpdateLocation with non-image media error = %T %v, want media not in theme", err, err)
	}

	updated, err := f.svc.UpdateLocation(ctx, creatorID, created.ID, UpdateLocationRequest{
		Name:         created.Name,
		SortOrder:    created.SortOrder,
		ImageMediaID: OptionalUUID{Set: true},
	})
	if err != nil {
		t.Fatalf("UpdateLocation clear image media: %v", err)
	}
	if updated.ImageMediaID != nil {
		t.Fatalf("ImageMediaID after clear = %v, want nil", updated.ImageMediaID)
	}
}

func TestService_MapImageMediaReference(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test in short mode")
	}
	f := setupFixture(t)
	ctx := context.Background()
	creatorID := f.createUser(t)
	themeID := f.createThemeForUser(t, creatorID)
	otherThemeID := f.createThemeForUser(t, creatorID)
	media := createLocationMedia(t, f.q, themeID, "지도 이미지", MediaTypeImage)
	otherThemeMedia := createLocationMedia(t, f.q, otherThemeID, "다른 테마 이미지", MediaTypeImage)
	voiceMedia := createLocationMedia(t, f.q, themeID, "효과음", MediaTypeVoice)

	created, err := f.svc.CreateMap(ctx, creatorID, themeID, CreateMapRequest{
		Name:         "1층 지도",
		ImageMediaID: uuidPtr(media.ID),
	})
	if err != nil {
		t.Fatalf("CreateMap with image media: %v", err)
	}
	if created.ImageMediaID == nil || *created.ImageMediaID != media.ID {
		t.Fatalf("ImageMediaID = %v, want %s", created.ImageMediaID, media.ID)
	}
	if created.ImageURL != nil {
		t.Fatalf("ImageURL = %q, want nil when ImageMediaID is set", *created.ImageURL)
	}

	if _, err := f.svc.UpdateMap(ctx, creatorID, created.ID, UpdateMapRequest{
		Name:         created.Name,
		ImageMediaID: OptionalUUID{Set: true, Value: uuidPtr(otherThemeMedia.ID)},
	}); !isMediaNotInTheme(err) {
		t.Fatalf("UpdateMap with other theme image error = %T %v, want media not in theme", err, err)
	}
	if _, err := f.svc.UpdateMap(ctx, creatorID, created.ID, UpdateMapRequest{
		Name:         created.Name,
		ImageMediaID: OptionalUUID{Set: true, Value: uuidPtr(voiceMedia.ID)},
	}); !isMediaNotInTheme(err) {
		t.Fatalf("UpdateMap with non-image media error = %T %v, want media not in theme", err, err)
	}

	updated, err := f.svc.UpdateMap(ctx, creatorID, created.ID, UpdateMapRequest{
		Name:         created.Name,
		SortOrder:    created.SortOrder,
		ImageMediaID: OptionalUUID{Set: true},
	})
	if err != nil {
		t.Fatalf("UpdateMap clear image media: %v", err)
	}
	if updated.ImageMediaID != nil {
		t.Fatalf("ImageMediaID after clear = %v, want nil", updated.ImageMediaID)
	}
}

func isBadRequest(err error) bool {
	var appErr *apperror.AppError
	return errors.As(err, &appErr) && appErr.Code == apperror.ErrBadRequest
}

func isMediaNotInTheme(err error) bool {
	var appErr *apperror.AppError
	return errors.As(err, &appErr) && appErr.Code == apperror.ErrMediaNotInTheme
}

func createLocationMedia(t *testing.T, q *db.Queries, themeID uuid.UUID, name string, mediaType string) db.ThemeMedium {
	t.Helper()
	media, err := q.CreateMedia(context.Background(), db.CreateMediaParams{
		ThemeID:    themeID,
		Name:       name,
		Type:       mediaType,
		SourceType: SourceTypeFile,
		StorageKey: pgtype.Text{String: "themes/test/" + uuid.New().String(), Valid: true},
		FileSize:   pgtype.Int8{Int64: 1024, Valid: true},
		MimeType:   pgtype.Text{String: "image/png", Valid: true},
		Tags:       []string{},
	})
	if err != nil {
		t.Fatalf("CreateMedia(%s): %v", name, err)
	}
	return media
}
