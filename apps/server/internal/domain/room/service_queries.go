package room

import (
	"context"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"

	"github.com/mmp-platform/server/internal/db"
)

type roomQueries interface {
	AddRoomPlayer(ctx context.Context, arg db.AddRoomPlayerParams) error
	CreateRoom(ctx context.Context, arg db.CreateRoomParams) (db.Room, error)
	GetRoom(ctx context.Context, id uuid.UUID) (db.Room, error)
	GetRoomByCode(ctx context.Context, code string) (db.Room, error)
	GetRoomForUpdate(ctx context.Context, id uuid.UUID) (db.Room, error)
	GetRoomPlayerCount(ctx context.Context, roomID uuid.UUID) (int64, error)
	GetRoomPlayers(ctx context.Context, roomID uuid.UUID) ([]db.RoomPlayer, error)
	GetRoomPlayersWithUser(ctx context.Context, roomID uuid.UUID) ([]db.GetRoomPlayersWithUserRow, error)
	GetTheme(ctx context.Context, id uuid.UUID) (db.Theme, error)
	GetThemeCharacter(ctx context.Context, id uuid.UUID) (db.ThemeCharacter, error)
	GetThemeCharacters(ctx context.Context, themeID uuid.UUID) ([]db.ThemeCharacter, error)
	ListWaitingRoomsWithCount(ctx context.Context, arg db.ListWaitingRoomsWithCountParams) ([]db.ListWaitingRoomsWithCountRow, error)
	RemoveRoomPlayer(ctx context.Context, arg db.RemoveRoomPlayerParams) error
	SetRoomPlayerCharacter(ctx context.Context, arg db.SetRoomPlayerCharacterParams) (int64, error)
	SetPlayerReady(ctx context.Context, arg db.SetPlayerReadyParams) error
	UpdateRoomStatus(ctx context.Context, arg db.UpdateRoomStatusParams) error
	WithTx(tx pgx.Tx) *db.Queries
}
