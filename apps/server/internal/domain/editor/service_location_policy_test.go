package editor

import (
	"context"
	"errors"
	"testing"

	"github.com/mmp-platform/server/internal/apperror"
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

func isBadRequest(err error) bool {
	var appErr *apperror.AppError
	return errors.As(err, &appErr) && appErr.Code == apperror.ErrBadRequest
}
