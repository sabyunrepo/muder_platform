package room

import (
	"context"
	"encoding/json"
	"testing"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/mmp-platform/server/internal/db"
	"github.com/mmp-platform/server/internal/ws"
	"github.com/rs/zerolog"
)

type fakeLobbyChatQueries struct {
	room    db.Room
	roomErr error
	roomID  uuid.UUID
	players []db.GetRoomPlayersWithUserRow
	err     error
}

func (f *fakeLobbyChatQueries) GetRoom(_ context.Context, roomID uuid.UUID) (db.Room, error) {
	f.roomID = roomID
	return f.room, f.roomErr
}

func (f *fakeLobbyChatQueries) GetRoomPlayersWithUser(_ context.Context, roomID uuid.UUID) ([]db.GetRoomPlayersWithUserRow, error) {
	f.roomID = roomID
	return f.players, f.err
}

type sentLobbyChatMessage struct {
	playerID uuid.UUID
	env      *ws.Envelope
}

type fakeLobbyChatBroadcaster struct {
	sent []sentLobbyChatMessage
}

func (f *fakeLobbyChatBroadcaster) SendToPlayer(playerID uuid.UUID, env *ws.Envelope) {
	f.sent = append(f.sent, sentLobbyChatMessage{playerID: playerID, env: env})
}

func TestLobbyChatWSHandlerBroadcastsToRoomParticipants(t *testing.T) {
	roomID := uuid.New()
	senderID := uuid.New()
	otherID := uuid.New()
	queries := &fakeLobbyChatQueries{
		room: db.Room{ID: roomID, Status: "WAITING"},
		players: []db.GetRoomPlayersWithUserRow{
			{RoomID: roomID, UserID: senderID, Nickname: "참가자", AvatarUrl: pgtype.Text{}},
			{RoomID: roomID, UserID: otherID, Nickname: "다른 참가자", AvatarUrl: pgtype.Text{}},
		},
	}
	broadcaster := &fakeLobbyChatBroadcaster{}
	handler := NewLobbyChatWSHandler(queries, broadcaster, zerolog.Nop())

	handler.HandleChat(&ws.Client{ID: senderID}, ws.MustEnvelope("chat:send", map[string]string{
		"room_id": roomID.String(),
		"text":    "  준비됐어요  ",
	}))

	if queries.roomID != roomID {
		t.Fatalf("loaded room id %s, want %s", queries.roomID, roomID)
	}
	if len(broadcaster.sent) != 2 {
		t.Fatalf("sent messages = %d, want 2", len(broadcaster.sent))
	}
	if broadcaster.sent[0].playerID != senderID || broadcaster.sent[1].playerID != otherID {
		t.Fatalf("sent recipients = %v, %v", broadcaster.sent[0].playerID, broadcaster.sent[1].playerID)
	}
	var payload lobbyChatMessagePayload
	if err := json.Unmarshal(broadcaster.sent[0].env.Payload, &payload); err != nil {
		t.Fatalf("unmarshal payload: %v", err)
	}
	if broadcaster.sent[0].env.Type != "chat:message" {
		t.Fatalf("event type = %q, want chat:message", broadcaster.sent[0].env.Type)
	}
	if payload.Sender != senderID.String() || payload.Nickname != "참가자" || payload.Text != "준비됐어요" {
		t.Fatalf("payload = %+v", payload)
	}
}

func TestLobbyChatWSHandlerRejectsNonParticipant(t *testing.T) {
	roomID := uuid.New()
	queries := &fakeLobbyChatQueries{
		room: db.Room{ID: roomID, Status: "WAITING"},
		players: []db.GetRoomPlayersWithUserRow{
			{RoomID: roomID, UserID: uuid.New(), Nickname: "참가자", AvatarUrl: pgtype.Text{}},
		},
	}
	broadcaster := &fakeLobbyChatBroadcaster{}
	handler := NewLobbyChatWSHandler(queries, broadcaster, zerolog.Nop())

	handler.HandleChat(&ws.Client{ID: uuid.New()}, ws.MustEnvelope("chat:send", map[string]string{
		"room_id": roomID.String(),
		"text":    "hello",
	}))

	if len(broadcaster.sent) != 0 {
		t.Fatalf("sent messages = %d, want 0", len(broadcaster.sent))
	}
}

func TestLobbyChatWSHandlerRejectsNonWaitingRoom(t *testing.T) {
	roomID := uuid.New()
	senderID := uuid.New()
	queries := &fakeLobbyChatQueries{
		room: db.Room{ID: roomID, Status: "PLAYING"},
		players: []db.GetRoomPlayersWithUserRow{
			{RoomID: roomID, UserID: senderID, Nickname: "참가자", AvatarUrl: pgtype.Text{}},
		},
	}
	broadcaster := &fakeLobbyChatBroadcaster{}
	handler := NewLobbyChatWSHandler(queries, broadcaster, zerolog.Nop())

	handler.HandleChat(&ws.Client{ID: senderID}, ws.MustEnvelope("chat:send", map[string]string{
		"room_id": roomID.String(),
		"text":    "hello",
	}))

	if len(broadcaster.sent) != 0 {
		t.Fatalf("sent messages = %d, want 0", len(broadcaster.sent))
	}
}
