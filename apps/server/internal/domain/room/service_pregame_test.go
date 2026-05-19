package room

import (
	"context"
	"errors"
	"net/http"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/rs/zerolog"

	"github.com/mmp-platform/server/internal/db"
)

type fakeRoomQueries struct {
	room                     db.Room
	roomErr                  error
	players                  []db.RoomPlayer
	playersErr               error
	theme                    db.Theme
	themeErr                 error
	playersWithUser          []db.GetRoomPlayersWithUserRow
	playersWithUserErr       error
	characters               []db.ThemeCharacter
	charactersErr            error
	setReadyParams           *db.SetPlayerReadyParams
	setReadyErr              error
	updateRoomStatusParams   *db.UpdateRoomStatusParams
	statusUpdates            []db.UpdateRoomStatusParams
	updateRoomStatusErr      error
	getRoomPlayersCalled     bool
	getPlayersWithUserCalled bool
	getThemeCalled           bool
}

func (f *fakeRoomQueries) AddRoomPlayer(context.Context, db.AddRoomPlayerParams) error {
	panic("unexpected AddRoomPlayer call")
}

func (f *fakeRoomQueries) CreateRoom(context.Context, db.CreateRoomParams) (db.Room, error) {
	panic("unexpected CreateRoom call")
}

func (f *fakeRoomQueries) GetRoom(context.Context, uuid.UUID) (db.Room, error) {
	return f.room, f.roomErr
}

func (f *fakeRoomQueries) GetRoomByCode(context.Context, string) (db.Room, error) {
	panic("unexpected GetRoomByCode call")
}

func (f *fakeRoomQueries) GetRoomForUpdate(context.Context, uuid.UUID) (db.Room, error) {
	panic("unexpected GetRoomForUpdate call")
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

func TestStartRoomServiceGateWiring(t *testing.T) {
	roomID := uuid.New()
	themeID := uuid.New()
	hostID := uuid.New()
	guestID := uuid.New()
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
				{UserID: hostID, Nickname: "호스트", IsReady: false, JoinedAt: joinedAt},
				{UserID: guestID, Nickname: "참가자", IsReady: true, JoinedAt: joinedAt.Add(time.Second)},
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
		if starter.players[1].UserID != guestID || !starter.players[1].IsReady {
			t.Fatalf("guest roster mismatch: %+v", starter.players[1])
		}
		if queries.updateRoomStatusParams == nil {
			t.Fatal("expected room status to be updated after successful game start")
		}
		if queries.updateRoomStatusParams.ID != roomID || queries.updateRoomStatusParams.Status != "PLAYING" {
			t.Fatalf("room status update mismatch: %+v", queries.updateRoomStatusParams)
		}
	})

	t.Run("status update failure stops before game starter", func(t *testing.T) {
		starter := &fakeGameStarter{}
		queries := &fakeRoomQueries{
			room:  room,
			theme: theme,
			playersWithUser: []db.GetRoomPlayersWithUserRow{
				{UserID: hostID, Nickname: "호스트", IsReady: false},
				{UserID: guestID, Nickname: "참가자", IsReady: true},
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
				{UserID: hostID, Nickname: "호스트", IsReady: false},
				{UserID: guestID, Nickname: "참가자", IsReady: true},
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
}
