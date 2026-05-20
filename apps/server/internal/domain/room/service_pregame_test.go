package room

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/rs/zerolog"

	"github.com/mmp-platform/server/internal/db"
)

type fakeRoomQueries struct {
	room                     db.Room
	roomAfterCharacterNoRows *db.Room
	roomErr                  error
	players                  []db.RoomPlayer
	playersErr               error
	theme                    db.Theme
	themeErr                 error
	playersWithUser          []db.GetRoomPlayersWithUserRow
	playersWithUserErr       error
	characters               []db.ThemeCharacter
	charactersErr            error
	character                db.ThemeCharacter
	characterErr             error
	users                    map[uuid.UUID]db.User
	userErr                  error
	friendships              map[uuid.UUID]db.Friendship
	friendshipErr            error
	blockedUsers             map[uuid.UUID]bool
	blockErr                 error
	gameInvitePrefs          map[uuid.UUID]bool
	notificationPrefsErr     error
	setReadyParams           *db.SetPlayerReadyParams
	setReadyErr              error
	setCharacterParams       *db.SetRoomPlayerCharacterParams
	setCharacterErr          error
	setCharacterRowsAffected *int64
	updateRoomStatusParams   *db.UpdateRoomStatusParams
	statusUpdates            []db.UpdateRoomStatusParams
	updateRoomStatusErr      error
	getRoomPlayersCalled     bool
	getPlayersWithUserCalled bool
	getRoomForUpdateCalled   bool
	getThemeCalled           bool
}

func (f *fakeRoomQueries) AddRoomPlayer(context.Context, db.AddRoomPlayerParams) error {
	panic("unexpected AddRoomPlayer call")
}

func (f *fakeRoomQueries) CreateRoom(context.Context, db.CreateRoomParams) (db.Room, error) {
	panic("unexpected CreateRoom call")
}

func (f *fakeRoomQueries) GetRoom(context.Context, uuid.UUID) (db.Room, error) {
	if f.setCharacterParams != nil && f.roomAfterCharacterNoRows != nil {
		return *f.roomAfterCharacterNoRows, f.roomErr
	}
	return f.room, f.roomErr
}

func (f *fakeRoomQueries) GetRoomByCode(context.Context, string) (db.Room, error) {
	panic("unexpected GetRoomByCode call")
}

func (f *fakeRoomQueries) GetRoomForUpdate(context.Context, uuid.UUID) (db.Room, error) {
	f.getRoomForUpdateCalled = true
	return f.room, f.roomErr
}

func (f *fakeRoomQueries) GetRoomPlayerCount(context.Context, uuid.UUID) (int64, error) {
	panic("unexpected GetRoomPlayerCount call")
}

func (f *fakeRoomQueries) GetRoomPlayers(context.Context, uuid.UUID) ([]db.RoomPlayer, error) {
	f.getRoomPlayersCalled = true
	return f.players, f.playersErr
}

func (f *fakeRoomQueries) GetRoomPlayersWithUser(context.Context, uuid.UUID) ([]db.GetRoomPlayersWithUserRow, error) {
	f.getPlayersWithUserCalled = true
	return f.playersWithUser, f.playersWithUserErr
}

func (f *fakeRoomQueries) GetTheme(context.Context, uuid.UUID) (db.Theme, error) {
	f.getThemeCalled = true
	return f.theme, f.themeErr
}

func (f *fakeRoomQueries) GetThemeCharacters(context.Context, uuid.UUID) ([]db.ThemeCharacter, error) {
	return f.characters, f.charactersErr
}

func (f *fakeRoomQueries) GetThemeCharacter(context.Context, uuid.UUID) (db.ThemeCharacter, error) {
	return f.character, f.characterErr
}

func (f *fakeRoomQueries) GetUser(_ context.Context, id uuid.UUID) (db.User, error) {
	if f.userErr != nil {
		return db.User{}, f.userErr
	}
	if f.users != nil {
		if user, ok := f.users[id]; ok {
			return user, nil
		}
	}
	return db.User{}, pgx.ErrNoRows
}

func (f *fakeRoomQueries) GetFriendshipBetween(_ context.Context, arg db.GetFriendshipBetweenParams) (db.Friendship, error) {
	if f.friendshipErr != nil {
		return db.Friendship{}, f.friendshipErr
	}
	if f.friendships != nil {
		if friendship, ok := f.friendships[arg.AddresseeID]; ok {
			return friendship, nil
		}
		if friendship, ok := f.friendships[arg.RequesterID]; ok {
			return friendship, nil
		}
	}
	return db.Friendship{}, pgx.ErrNoRows
}

func (f *fakeRoomQueries) IsBlocked(_ context.Context, arg db.IsBlockedParams) (bool, error) {
	if f.blockErr != nil {
		return false, f.blockErr
	}
	return f.blockedUsers[arg.BlockedID], nil
}

func (f *fakeRoomQueries) GetNotificationPrefs(_ context.Context, userID uuid.UUID) (db.NotificationPreference, error) {
	if f.notificationPrefsErr != nil {
		return db.NotificationPreference{}, f.notificationPrefsErr
	}
	if f.gameInvitePrefs != nil {
		if enabled, ok := f.gameInvitePrefs[userID]; ok {
			return db.NotificationPreference{UserID: userID, GameInvite: enabled}, nil
		}
	}
	return db.NotificationPreference{}, pgx.ErrNoRows
}

func (f *fakeRoomQueries) ListWaitingRoomsWithCount(context.Context, db.ListWaitingRoomsWithCountParams) ([]db.ListWaitingRoomsWithCountRow, error) {
	panic("unexpected ListWaitingRoomsWithCount call")
}

func (f *fakeRoomQueries) RemoveRoomPlayer(context.Context, db.RemoveRoomPlayerParams) error {
	panic("unexpected RemoveRoomPlayer call")
}

func (f *fakeRoomQueries) SetPlayerReady(_ context.Context, arg db.SetPlayerReadyParams) error {
	f.setReadyParams = &arg
	return f.setReadyErr
}

func (f *fakeRoomQueries) SetRoomPlayerCharacter(_ context.Context, arg db.SetRoomPlayerCharacterParams) (int64, error) {
	f.setCharacterParams = &arg
	if f.setCharacterErr != nil {
		return 0, f.setCharacterErr
	}
	if f.setCharacterRowsAffected != nil {
		return *f.setCharacterRowsAffected, nil
	}
	return 1, nil
}

func (f *fakeRoomQueries) UpdateRoomStatus(_ context.Context, arg db.UpdateRoomStatusParams) error {
	f.updateRoomStatusParams = &arg
	f.statusUpdates = append(f.statusUpdates, arg)
	return f.updateRoomStatusErr
}

func (f *fakeRoomQueries) WithTx(pgx.Tx) *db.Queries {
	panic("unexpected WithTx call")
}

func TestSetReadyServiceBranches(t *testing.T) {
	roomID := uuid.New()
	userID := uuid.New()
	waitingRoom := db.Room{ID: roomID, Status: "WAITING"}

	tests := []struct {
		name        string
		queries     *fakeRoomQueries
		wantStatus  int
		wantUpdated bool
	}{
		{
			name:       "room missing",
			queries:    &fakeRoomQueries{roomErr: pgx.ErrNoRows},
			wantStatus: http.StatusNotFound,
		},
		{
			name:       "room lookup failure",
			queries:    &fakeRoomQueries{roomErr: errors.New("db unavailable")},
			wantStatus: http.StatusInternalServerError,
		},
		{
			name:       "room not waiting",
			queries:    &fakeRoomQueries{room: db.Room{ID: roomID, Status: "PLAYING"}},
			wantStatus: http.StatusConflict,
		},
		{
			name: "player lookup failure",
			queries: &fakeRoomQueries{
				room:       waitingRoom,
				playersErr: errors.New("db unavailable"),
			},
			wantStatus: http.StatusInternalServerError,
		},
		{
			name: "user is not a participant",
			queries: &fakeRoomQueries{
				room:    waitingRoom,
				players: []db.RoomPlayer{{RoomID: roomID, UserID: uuid.New()}},
			},
			wantStatus: http.StatusForbidden,
		},
		{
			name: "ready update failure",
			queries: &fakeRoomQueries{
				room:        waitingRoom,
				players:     []db.RoomPlayer{{RoomID: roomID, UserID: userID}},
				setReadyErr: errors.New("db update failed"),
			},
			wantStatus: http.StatusInternalServerError,
		},
		{
			name: "success",
			queries: &fakeRoomQueries{
				room:    waitingRoom,
				players: []db.RoomPlayer{{RoomID: roomID, UserID: userID}},
			},
			wantUpdated: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			svc := &service{queries: tt.queries, logger: zerolog.Nop()}

			err := svc.SetReady(context.Background(), roomID, userID, true)

			if tt.wantStatus != 0 {
				assertAppError(t, err, tt.wantStatus)
				return
			}
			if err != nil {
				t.Fatalf("SetReady returned error: %v", err)
			}
			if tt.wantUpdated {
				if tt.queries.setReadyParams == nil {
					t.Fatal("expected SetPlayerReady to be called")
				}
				if tt.queries.setReadyParams.RoomID != roomID || tt.queries.setReadyParams.UserID != userID || !tt.queries.setReadyParams.IsReady {
					t.Fatalf("SetPlayerReady params mismatch: %+v", tt.queries.setReadyParams)
				}
			}
		})
	}
}

func TestSelectCharacterServiceBranches(t *testing.T) {
	roomID := uuid.New()
	themeID := uuid.New()
	userID := uuid.New()
	otherUserID := uuid.New()
	charID := uuid.New()
	otherCharID := uuid.New()
	waitingRoom := db.Room{ID: roomID, ThemeID: themeID, Status: "WAITING"}
	playingRoom := db.Room{ID: roomID, ThemeID: themeID, Status: "PLAYING"}
	participant := db.RoomPlayer{RoomID: roomID, UserID: userID}
	playableChar := db.ThemeCharacter{ID: charID, ThemeID: themeID, IsPlayable: true}
	zeroRows := int64(0)

	tests := []struct {
		name        string
		queries     *fakeRoomQueries
		wantStatus  int
		wantUpdated bool
	}{
		{
			name:       "room missing",
			queries:    &fakeRoomQueries{roomErr: pgx.ErrNoRows},
			wantStatus: http.StatusNotFound,
		},
		{
			name:       "room not waiting",
			queries:    &fakeRoomQueries{room: db.Room{ID: roomID, ThemeID: themeID, Status: "PLAYING"}},
			wantStatus: http.StatusConflict,
		},
		{
			name: "caller is not participant",
			queries: &fakeRoomQueries{
				room:    waitingRoom,
				players: []db.RoomPlayer{{RoomID: roomID, UserID: otherUserID}},
			},
			wantStatus: http.StatusForbidden,
		},
		{
			name: "character missing",
			queries: &fakeRoomQueries{
				room:         waitingRoom,
				players:      []db.RoomPlayer{participant},
				characterErr: pgx.ErrNoRows,
			},
			wantStatus: http.StatusNotFound,
		},
		{
			name: "character belongs to another theme",
			queries: &fakeRoomQueries{
				room:      waitingRoom,
				players:   []db.RoomPlayer{participant},
				character: db.ThemeCharacter{ID: charID, ThemeID: uuid.New(), IsPlayable: true},
			},
			wantStatus: http.StatusBadRequest,
		},
		{
			name: "character is not playable",
			queries: &fakeRoomQueries{
				room:      waitingRoom,
				players:   []db.RoomPlayer{participant},
				character: db.ThemeCharacter{ID: charID, ThemeID: themeID, IsPlayable: false},
			},
			wantStatus: http.StatusBadRequest,
		},
		{
			name: "character already selected by another player",
			queries: &fakeRoomQueries{
				room: waitingRoom,
				players: []db.RoomPlayer{
					participant,
					{
						RoomID: roomID,
						UserID: otherUserID,
						CharacterID: pgtype.UUID{
							Bytes: charID,
							Valid: true,
						},
					},
				},
				character: playableChar,
			},
			wantStatus: http.StatusConflict,
		},
		{
			name: "same player reselecting same character is harmless",
			queries: &fakeRoomQueries{
				room: waitingRoom,
				players: []db.RoomPlayer{{
					RoomID: roomID,
					UserID: userID,
					CharacterID: pgtype.UUID{
						Bytes: charID,
						Valid: true,
					},
				}},
				character: playableChar,
			},
			wantUpdated: true,
		},
		{
			name: "success changes from previous character",
			queries: &fakeRoomQueries{
				room: waitingRoom,
				players: []db.RoomPlayer{{
					RoomID: roomID,
					UserID: userID,
					CharacterID: pgtype.UUID{
						Bytes: otherCharID,
						Valid: true,
					},
				}},
				character: playableChar,
			},
			wantUpdated: true,
		},
		{
			name: "update failure",
			queries: &fakeRoomQueries{
				room:            waitingRoom,
				players:         []db.RoomPlayer{participant},
				character:       playableChar,
				setCharacterErr: errors.New("db update failed"),
			},
			wantStatus: http.StatusInternalServerError,
		},
		{
			name: "room starts before final update",
			queries: &fakeRoomQueries{
				room:                     waitingRoom,
				roomAfterCharacterNoRows: &playingRoom,
				players:                  []db.RoomPlayer{participant},
				character:                playableChar,
				setCharacterRowsAffected: &zeroRows,
			},
			wantStatus: http.StatusConflict,
		},
		{
			name: "participant leaves before final update",
			queries: &fakeRoomQueries{
				room:                     waitingRoom,
				players:                  []db.RoomPlayer{participant},
				character:                playableChar,
				setCharacterRowsAffected: &zeroRows,
			},
			wantStatus: http.StatusForbidden,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			svc := &service{queries: tt.queries, logger: zerolog.Nop()}

			err := svc.SelectCharacter(context.Background(), roomID, userID, SelectCharacterRequest{CharacterID: charID})

			if tt.wantStatus != 0 {
				assertAppError(t, err, tt.wantStatus)
				return
			}
			if err != nil {
				t.Fatalf("SelectCharacter returned error: %v", err)
			}
			if tt.wantUpdated {
				if tt.queries.setCharacterParams == nil {
					t.Fatal("expected SetRoomPlayerCharacter to be called")
				}
				if tt.queries.setCharacterParams.RoomID != roomID ||
					tt.queries.setCharacterParams.UserID != userID ||
					!tt.queries.setCharacterParams.CharacterID.Valid ||
					uuid.UUID(tt.queries.setCharacterParams.CharacterID.Bytes) != charID {
					t.Fatalf("SetRoomPlayerCharacter params mismatch: %+v", tt.queries.setCharacterParams)
				}
			}
		})
	}
}

func TestBuildRoomDetailIncludesNullableCharacterID(t *testing.T) {
	roomID := uuid.New()
	themeID := uuid.New()
	hostID := uuid.New()
	guestID := uuid.New()
	charID := uuid.New()
	queries := &fakeRoomQueries{
		room:  db.Room{ID: roomID, ThemeID: themeID, HostID: hostID, Status: "WAITING"},
		theme: db.Theme{ID: themeID, Title: "테마", Slug: "theme"},
		playersWithUser: []db.GetRoomPlayersWithUserRow{
			{
				UserID: hostID,
				CharacterID: pgtype.UUID{
					Bytes: charID,
					Valid: true,
				},
				Nickname: "호스트",
			},
			{
				UserID:   guestID,
				Nickname: "게스트",
			},
		},
	}
	svc := &service{queries: queries, logger: zerolog.Nop()}

	resp, err := svc.buildRoomDetail(context.Background(), queries.room, true)
	if err != nil {
		t.Fatalf("buildRoomDetail returned error: %v", err)
	}
	if len(resp.Players) != 2 {
		t.Fatalf("players len = %d, want 2", len(resp.Players))
	}
	if resp.Players[0].CharacterID == nil || *resp.Players[0].CharacterID != charID {
		t.Fatalf("host character_id mismatch: %+v", resp.Players[0])
	}
	if resp.Players[1].CharacterID != nil {
		t.Fatalf("guest character_id should be nil: %+v", resp.Players[1])
	}

	body, err := json.Marshal(resp.Players[1])
	if err != nil {
		t.Fatalf("marshal player: %v", err)
	}
	if bytes.Contains(body, []byte(`"character_id"`)) {
		t.Fatalf("expected empty character_id to be omitted in JSON, got %s", body)
	}
}

func TestBuildRoomDetailRedactsCharacterIDForPublicDetail(t *testing.T) {
	roomID := uuid.New()
	themeID := uuid.New()
	hostID := uuid.New()
	charID := uuid.New()
	queries := &fakeRoomQueries{
		room:  db.Room{ID: roomID, ThemeID: themeID, HostID: hostID, Status: "WAITING"},
		theme: db.Theme{ID: themeID, Title: "테마", Slug: "theme"},
		playersWithUser: []db.GetRoomPlayersWithUserRow{
			{
				UserID: hostID,
				CharacterID: pgtype.UUID{
					Bytes: charID,
					Valid: true,
				},
				Nickname: "호스트",
			},
		},
	}
	svc := &service{queries: queries, logger: zerolog.Nop()}

	resp, err := svc.buildRoomDetail(context.Background(), queries.room, false)
	if err != nil {
		t.Fatalf("buildRoomDetail returned error: %v", err)
	}
	if resp.Players[0].CharacterID != nil {
		t.Fatalf("public room detail should redact character_id: %+v", resp.Players[0])
	}
	body, err := json.Marshal(resp.Players[0])
	if err != nil {
		t.Fatalf("marshal public player: %v", err)
	}
	if bytes.Contains(body, []byte(`"character_id"`)) {
		t.Fatalf("public room detail should omit character_id, got %s", body)
	}
}

func TestGetRoomForUserRejectsNonParticipant(t *testing.T) {
	roomID := uuid.New()
	themeID := uuid.New()
	hostID := uuid.New()
	queries := &fakeRoomQueries{
		room:  db.Room{ID: roomID, ThemeID: themeID, HostID: hostID, Status: "WAITING"},
		theme: db.Theme{ID: themeID, Title: "테마", Slug: "theme"},
		playersWithUser: []db.GetRoomPlayersWithUserRow{
			{UserID: hostID, Nickname: "호스트"},
		},
	}
	svc := &service{queries: queries, logger: zerolog.Nop()}

	_, err := svc.GetRoomForUser(context.Background(), roomID, uuid.New())

	assertAppError(t, err, http.StatusForbidden)
}

func TestStartRoomServiceGateWiring(t *testing.T) {
	roomID := uuid.New()
	themeID := uuid.New()
	hostID := uuid.New()
	guestID := uuid.New()
	hostCharID := uuid.New()
	guestCharID := uuid.New()
	room := db.Room{ID: roomID, ThemeID: themeID, HostID: hostID, Status: "WAITING"}
	theme := db.Theme{ID: themeID, MinPlayers: 2}

	t.Run("gate failure stops before game starter", func(t *testing.T) {
		starter := &fakeGameStarter{}
		queries := &fakeRoomQueries{
			room: room,
			playersWithUser: []db.GetRoomPlayersWithUserRow{
				{UserID: hostID, Nickname: "호스트", IsReady: false},
				{UserID: guestID, Nickname: "참가자", IsReady: false},
			},
			theme: theme,
		}
		svc := &service{queries: queries, logger: zerolog.Nop(), gameStarter: starter}

		err := svc.StartRoom(context.Background(), roomID, hostID, StartRoomRequest{})

		assertAppError(t, err, http.StatusConflict)
		if starter.called {
			t.Fatal("expected gate failure to stop before GameStarter.Start")
		}
		if !queries.getPlayersWithUserCalled || !queries.getThemeCalled {
			t.Fatal("expected StartRoom to load players and theme before gate validation")
		}
	})

	t.Run("minimum player gate stops before game starter and status update", func(t *testing.T) {
		starter := &fakeGameStarter{}
		queries := &fakeRoomQueries{
			room:  room,
			theme: db.Theme{ID: themeID, MinPlayers: 3},
			playersWithUser: []db.GetRoomPlayersWithUserRow{
				{UserID: hostID, Nickname: "호스트", IsReady: false},
				{UserID: guestID, Nickname: "참가자", IsReady: true},
			},
		}
		svc := &service{queries: queries, logger: zerolog.Nop(), gameStarter: starter}

		err := svc.StartRoom(context.Background(), roomID, hostID, StartRoomRequest{})

		assertAppError(t, err, http.StatusConflict)
		if starter.called {
			t.Fatal("expected minimum player gate to stop before GameStarter.Start")
		}
		if queries.updateRoomStatusParams != nil {
			t.Fatalf("room status should not update when minimum player gate fails: %+v", queries.updateRoomStatusParams)
		}
		if !queries.getPlayersWithUserCalled || !queries.getThemeCalled {
			t.Fatal("expected StartRoom to load players and theme before minimum player gate validation")
		}
	})

	t.Run("gate pass calls game starter with roster", func(t *testing.T) {
		starter := &fakeGameStarter{}
		joinedAt := time.Unix(1700, 0)
		queries := &fakeRoomQueries{
			room:  room,
			theme: theme,
			playersWithUser: []db.GetRoomPlayersWithUserRow{
				{UserID: hostID, CharacterID: pgtype.UUID{Bytes: hostCharID, Valid: true}, Nickname: "호스트", IsReady: false, JoinedAt: joinedAt},
				{UserID: guestID, CharacterID: pgtype.UUID{Bytes: guestCharID, Valid: true}, Nickname: "참가자", IsReady: true, JoinedAt: joinedAt.Add(time.Second)},
			},
		}
		svc := &service{queries: queries, logger: zerolog.Nop(), gameStarter: starter}

		if err := svc.StartRoom(context.Background(), roomID, hostID, StartRoomRequest{}); err != nil {
			t.Fatalf("StartRoom returned error: %v", err)
		}
		if !starter.called {
			t.Fatal("expected GameStarter.Start to be called")
		}
		if len(starter.players) != 2 {
			t.Fatalf("starter players len = %d, want 2", len(starter.players))
		}
		if starter.players[0].UserID != hostID || !starter.players[0].IsHost {
			t.Fatalf("host roster mismatch: %+v", starter.players[0])
		}
		if starter.players[0].CharacterID == nil || *starter.players[0].CharacterID != hostCharID {
			t.Fatalf("host character roster mismatch: %+v", starter.players[0])
		}
		if starter.players[1].UserID != guestID || !starter.players[1].IsReady {
			t.Fatalf("guest roster mismatch: %+v", starter.players[1])
		}
		if starter.players[1].CharacterID == nil || *starter.players[1].CharacterID != guestCharID {
			t.Fatalf("guest character roster mismatch: %+v", starter.players[1])
		}
		if queries.updateRoomStatusParams == nil {
			t.Fatal("expected room status to be updated after successful game start")
		}
		if queries.updateRoomStatusParams.ID != roomID || queries.updateRoomStatusParams.Status != "PLAYING" {
			t.Fatalf("room status update mismatch: %+v", queries.updateRoomStatusParams)
		}
		if !queries.getRoomForUpdateCalled {
			t.Fatal("expected StartRoom to lock room before reading players")
		}
	})

	t.Run("status update failure stops before game starter", func(t *testing.T) {
		starter := &fakeGameStarter{}
		queries := &fakeRoomQueries{
			room:  room,
			theme: theme,
			playersWithUser: []db.GetRoomPlayersWithUserRow{
				{UserID: hostID, CharacterID: pgtype.UUID{Bytes: hostCharID, Valid: true}, Nickname: "호스트", IsReady: false},
				{UserID: guestID, CharacterID: pgtype.UUID{Bytes: guestCharID, Valid: true}, Nickname: "참가자", IsReady: true},
			},
			updateRoomStatusErr: errors.New("status update failed"),
		}
		svc := &service{queries: queries, logger: zerolog.Nop(), gameStarter: starter}

		err := svc.StartRoom(context.Background(), roomID, hostID, StartRoomRequest{})

		assertAppError(t, err, http.StatusInternalServerError)
		if starter.called {
			t.Fatal("expected status update failure to stop before GameStarter.Start")
		}
		if len(queries.statusUpdates) != 1 || queries.statusUpdates[0].Status != "PLAYING" {
			t.Fatalf("status update attempt mismatch: %+v", queries.statusUpdates)
		}
	})

	t.Run("starter failure rolls room status back to waiting", func(t *testing.T) {
		starter := &fakeGameStarter{returnErr: errors.New("runtime unavailable")}
		queries := &fakeRoomQueries{
			room:  room,
			theme: theme,
			playersWithUser: []db.GetRoomPlayersWithUserRow{
				{UserID: hostID, CharacterID: pgtype.UUID{Bytes: hostCharID, Valid: true}, Nickname: "호스트", IsReady: false},
				{UserID: guestID, CharacterID: pgtype.UUID{Bytes: guestCharID, Valid: true}, Nickname: "참가자", IsReady: true},
			},
		}
		svc := &service{queries: queries, logger: zerolog.Nop(), gameStarter: starter}

		err := svc.StartRoom(context.Background(), roomID, hostID, StartRoomRequest{})

		if err == nil {
			t.Fatal("expected GameStarter failure")
		}
		if len(queries.statusUpdates) != 2 {
			t.Fatalf("status updates len = %d, want 2: %+v", len(queries.statusUpdates), queries.statusUpdates)
		}
		if queries.statusUpdates[0].Status != "PLAYING" || queries.statusUpdates[1].Status != "WAITING" {
			t.Fatalf("status update order mismatch: %+v", queries.statusUpdates)
		}
	})

	t.Run("missing host character stops before game starter", func(t *testing.T) {
		starter := &fakeGameStarter{}
		queries := &fakeRoomQueries{
			room:  room,
			theme: theme,
			playersWithUser: []db.GetRoomPlayersWithUserRow{
				{UserID: hostID, Nickname: "호스트", IsReady: false},
				{UserID: guestID, CharacterID: pgtype.UUID{Bytes: guestCharID, Valid: true}, Nickname: "참가자", IsReady: true},
			},
		}
		svc := &service{queries: queries, logger: zerolog.Nop(), gameStarter: starter}

		err := svc.StartRoom(context.Background(), roomID, hostID, StartRoomRequest{})

		assertAppError(t, err, http.StatusConflict)
		if starter.called {
			t.Fatal("expected missing character gate to stop before GameStarter.Start")
		}
		if queries.updateRoomStatusParams != nil {
			t.Fatalf("room status should not update when character gate fails: %+v", queries.updateRoomStatusParams)
		}
	})
}
