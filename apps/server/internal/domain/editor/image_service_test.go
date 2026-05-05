package editor

import (
	"context"
	"io"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/rs/zerolog"

	"github.com/mmp-platform/server/internal/db"
	"github.com/mmp-platform/server/internal/infra/storage"
)

func TestParseUploadKey_Location(t *testing.T) {
	key := "themes/11111111-1111-1111-1111-111111111111/locations/22222222-2222-2222-2222-222222222222/image.webp"
	target, id, err := parseUploadKey(key)
	if err != nil {
		t.Fatalf("parseUploadKey returned error: %v", err)
	}
	if target != ImageTargetLocation {
		t.Fatalf("target = %q, want %q", target, ImageTargetLocation)
	}
	if got := id.String(); got != "22222222-2222-2222-2222-222222222222" {
		t.Fatalf("id = %q", got)
	}
}

func TestConfirmImageUpload_PreservesExistingTargetFields(t *testing.T) {
	creatorID := uuid.MustParse("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa")
	themeID := uuid.MustParse("11111111-1111-1111-1111-111111111111")
	charID := uuid.MustParse("22222222-2222-2222-2222-222222222222")
	clueID := uuid.MustParse("33333333-3333-3333-3333-333333333333")
	locationID := uuid.MustParse("44444444-4444-4444-4444-444444444444")

	cases := []struct {
		name      string
		uploadKey string
		assert    func(*testing.T, *fakeImageQueries)
	}{
		{
			name:      "character visibility fields",
			uploadKey: "themes/11111111-1111-1111-1111-111111111111/characters/22222222-2222-2222-2222-222222222222/avatar.webp",
			assert: func(t *testing.T, q *fakeImageQueries) {
				arg := q.updateCharacterArg
				if arg.MysteryRole != "detective" || arg.IsPlayable || arg.ShowInIntro || !arg.CanSpeakInReading || arg.IsVotingCandidate {
					t.Fatalf("character fields not preserved: %+v", arg)
				}
			},
		},
		{
			name:      "clue gameplay fields",
			uploadKey: "themes/11111111-1111-1111-1111-111111111111/clues/33333333-3333-3333-3333-333333333333/image.webp",
			assert: func(t *testing.T, q *fakeImageQueries) {
				arg := q.updateClueArg
				if !arg.IsUsable || arg.UseEffect.String != "peek" || arg.UseTarget.String != "player" || !arg.UseConsumed || arg.RevealRound.Int32 != 2 || arg.HideRound.Int32 != 5 {
					t.Fatalf("clue fields not preserved: %+v", arg)
				}
			},
		},
		{
			name:      "location metadata fields",
			uploadKey: "themes/11111111-1111-1111-1111-111111111111/locations/44444444-4444-4444-4444-444444444444/image.webp",
			assert: func(t *testing.T, q *fakeImageQueries) {
				arg := q.updateLocationArg
				if arg.RestrictedCharacters.String != "char-a,char-b" || arg.FromRound.Int32 != 1 || arg.UntilRound.Int32 != 4 {
					t.Fatalf("location fields not preserved: %+v", arg)
				}
			},
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			q := newFakeImageQueries(creatorID, themeID, charID, clueID, locationID)
			svc := &ImageService{q: q, storage: fakeImageStorage{}, logger: zerolog.Nop()}
			_, err := svc.ConfirmImageUpload(context.Background(), creatorID, themeID, ConfirmImageUploadRequest{UploadKey: tc.uploadKey})
			if err != nil {
				t.Fatalf("ConfirmImageUpload returned error: %v", err)
			}
			tc.assert(t, q)
		})
	}
}

type fakeImageQueries struct {
	theme              db.Theme
	character          db.ThemeCharacter
	clue               db.ThemeClue
	location           db.ThemeLocation
	updateCharacterArg db.UpdateThemeCharacterParams
	updateClueArg      db.UpdateClueParams
	updateLocationArg  db.UpdateLocationParams
}

func newFakeImageQueries(creatorID, themeID, charID, clueID, locationID uuid.UUID) *fakeImageQueries {
	return &fakeImageQueries{
		theme: db.Theme{ID: themeID, CreatorID: creatorID},
		character: db.ThemeCharacter{
			ID:                charID,
			ThemeID:           themeID,
			Name:              "탐정",
			MysteryRole:       "detective",
			IsCulprit:         true,
			IsPlayable:        false,
			ShowInIntro:       false,
			CanSpeakInReading: true,
			IsVotingCandidate: false,
		},
		clue:     db.ThemeClue{ID: clueID, ThemeID: themeID, Name: "단서", IsUsable: true, UseEffect: text("peek"), UseTarget: text("player"), UseConsumed: true, RevealRound: int4(2), HideRound: int4(5)},
		location: db.ThemeLocation{ID: locationID, ThemeID: themeID, Name: "서재", RestrictedCharacters: text("char-a,char-b"), FromRound: int4(1), UntilRound: int4(4)},
	}
}

func (f *fakeImageQueries) GetTheme(context.Context, uuid.UUID) (db.Theme, error) {
	return f.theme, nil
}
func (f *fakeImageQueries) GetThemeCharacter(context.Context, uuid.UUID) (db.ThemeCharacter, error) {
	return f.character, nil
}
func (f *fakeImageQueries) UpdateThemeCharacter(_ context.Context, arg db.UpdateThemeCharacterParams) (db.ThemeCharacter, error) {
	f.updateCharacterArg = arg
	return f.character, nil
}
func (f *fakeImageQueries) GetClue(context.Context, uuid.UUID) (db.ThemeClue, error) {
	return f.clue, nil
}
func (f *fakeImageQueries) UpdateClue(_ context.Context, arg db.UpdateClueParams) (db.ThemeClue, error) {
	f.updateClueArg = arg
	return f.clue, nil
}
func (f *fakeImageQueries) GetLocation(context.Context, uuid.UUID) (db.ThemeLocation, error) {
	return f.location, nil
}
func (f *fakeImageQueries) UpdateLocation(_ context.Context, arg db.UpdateLocationParams) (db.ThemeLocation, error) {
	f.updateLocationArg = arg
	return f.location, nil
}
func (f *fakeImageQueries) UpdateThemeCoverImage(context.Context, db.UpdateThemeCoverImageParams) error {
	return nil
}

type fakeImageStorage struct{}

func (fakeImageStorage) GenerateUploadURL(context.Context, string, string, int64, time.Duration) (string, error) {
	return "https://upload", nil
}
func (fakeImageStorage) GenerateDownloadURL(_ context.Context, key string, _ time.Duration) (string, error) {
	return "https://cdn.example/" + key, nil
}
func (fakeImageStorage) HeadObject(_ context.Context, key string) (*storage.ObjectMeta, error) {
	return &storage.ObjectMeta{Key: key}, nil
}
func (fakeImageStorage) GetObjectRange(context.Context, string, int64, int64) (io.ReadCloser, error) {
	return nil, storage.ErrObjectNotFound
}
func (fakeImageStorage) DeleteObject(context.Context, string) error    { return nil }
func (fakeImageStorage) DeleteObjects(context.Context, []string) error { return nil }

func text(value string) pgtype.Text { return pgtype.Text{String: value, Valid: true} }
func int4(value int32) pgtype.Int4  { return pgtype.Int4{Int32: value, Valid: true} }
