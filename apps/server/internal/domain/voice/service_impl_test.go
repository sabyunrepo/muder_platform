package voice

import (
	"context"
	"errors"
	"net/http"
	"testing"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/rs/zerolog"

	"github.com/mmp-platform/server/internal/apperror"
	"github.com/mmp-platform/server/internal/db"
)

type fakeVoiceQueries struct {
	sessionPlayers []db.SessionPlayer
	sessionErr     error
	room           db.Room
	roomErr        error
	roomPlayers    []db.RoomPlayer
	roomPlayersErr error
}

func (f *fakeVoiceQueries) GetSessionPlayers(_ context.Context, sessionID uuid.UUID) ([]db.SessionPlayer, error) {
	if f.sessionErr != nil {
		return nil, f.sessionErr
	}
	return f.sessionPlayers, nil
}

func (f *fakeVoiceQueries) GetRoom(_ context.Context, id uuid.UUID) (db.Room, error) {
	if f.roomErr != nil {
		return db.Room{}, f.roomErr
	}
	return f.room, nil
}

func (f *fakeVoiceQueries) GetRoomPlayers(_ context.Context, roomID uuid.UUID) ([]db.RoomPlayer, error) {
	if f.roomPlayersErr != nil {
		return nil, f.roomPlayersErr
	}
	return f.roomPlayers, nil
}

type fakeVoiceProvider struct {
	createdRoom string
	tokenRoom   string
	createErr   error
	tokenErr    error
}

func (f *fakeVoiceProvider) GenerateToken(_ context.Context, params TokenParams) (string, error) {
	f.tokenRoom = params.RoomName
	if f.tokenErr != nil {
		return "", f.tokenErr
	}
	return "voice-token", nil
}

func (f *fakeVoiceProvider) CreateRoom(_ context.Context, name string) error {
	f.createdRoom = name
	return f.createErr
}

func (f *fakeVoiceProvider) DestroyRoom(context.Context, string) error {
	return nil
}

func TestGetTokenForWaitingRoomUsesRoomPlayers(t *testing.T) {
	roomID := uuid.New()
	userID := uuid.New()
	provider := &fakeVoiceProvider{}
	svc := &serviceImpl{
		provider: provider,
		queries: &fakeVoiceQueries{
			room:        db.Room{ID: roomID, Status: "WAITING"},
			roomPlayers: []db.RoomPlayer{{RoomID: roomID, UserID: userID}},
		},
		lkURL:  "ws://livekit",
		logger: zerolog.Nop(),
	}

	resp, err := svc.GetToken(context.Background(), userID, TokenRequest{
		RoomID:   roomID.String(),
		RoomType: "main",
	})

	if err != nil {
		t.Fatalf("GetToken returned error: %v", err)
	}
	wantRoomName := "room-" + roomID.String() + "-main"
	if resp.Token != "voice-token" || resp.URL != "ws://livekit" || resp.RoomName != wantRoomName {
		t.Fatalf("response mismatch: %+v", resp)
	}
	if provider.createdRoom != wantRoomName || provider.tokenRoom != wantRoomName {
		t.Fatalf("provider room mismatch: create=%q token=%q want %q", provider.createdRoom, provider.tokenRoom, wantRoomName)
	}
}

func TestGetTokenForWaitingRoomRequiresParticipant(t *testing.T) {
	roomID := uuid.New()
	userID := uuid.New()
	svc := &serviceImpl{
		provider: &fakeVoiceProvider{},
		queries: &fakeVoiceQueries{
			room:        db.Room{ID: roomID, Status: "WAITING"},
			roomPlayers: []db.RoomPlayer{{RoomID: roomID, UserID: uuid.New()}},
		},
		logger: zerolog.Nop(),
	}

	_, err := svc.GetToken(context.Background(), userID, TokenRequest{
		RoomID:   roomID.String(),
		RoomType: "main",
	})

	assertVoiceAppError(t, err, http.StatusForbidden)
}

func TestGetTokenForWaitingRoomRequiresWaitingStatus(t *testing.T) {
	roomID := uuid.New()
	userID := uuid.New()
	svc := &serviceImpl{
		provider: &fakeVoiceProvider{},
		queries: &fakeVoiceQueries{
			room:        db.Room{ID: roomID, Status: "PLAYING"},
			roomPlayers: []db.RoomPlayer{{RoomID: roomID, UserID: userID}},
		},
		logger: zerolog.Nop(),
	}

	_, err := svc.GetToken(context.Background(), userID, TokenRequest{
		RoomID:   roomID.String(),
		RoomType: "main",
	})

	assertVoiceAppError(t, err, http.StatusConflict)
}

func TestGetTokenForWaitingRoomRejectsWhisper(t *testing.T) {
	roomID := uuid.New()
	userID := uuid.New()
	svc := &serviceImpl{
		provider: &fakeVoiceProvider{},
		queries:  &fakeVoiceQueries{},
		logger:   zerolog.Nop(),
	}

	_, err := svc.GetToken(context.Background(), userID, TokenRequest{
		RoomID:   roomID.String(),
		RoomType: "whisper",
		RoomName: "side",
	})

	assertVoiceAppError(t, err, http.StatusBadRequest)
}

func TestGetTokenRequiresExactlyOneTarget(t *testing.T) {
	svc := &serviceImpl{
		provider: &fakeVoiceProvider{},
		queries:  &fakeVoiceQueries{},
		logger:   zerolog.Nop(),
	}

	_, err := svc.GetToken(context.Background(), uuid.New(), TokenRequest{RoomType: "main"})
	assertVoiceAppError(t, err, http.StatusBadRequest)

	_, err = svc.GetToken(context.Background(), uuid.New(), TokenRequest{
		SessionID: uuid.New().String(),
		RoomID:    uuid.New().String(),
		RoomType:  "main",
	})
	assertVoiceAppError(t, err, http.StatusBadRequest)
}

func TestGetTokenForSessionStillUsesSessionPlayers(t *testing.T) {
	sessionID := uuid.New()
	userID := uuid.New()
	provider := &fakeVoiceProvider{}
	svc := &serviceImpl{
		provider: provider,
		queries: &fakeVoiceQueries{
			sessionPlayers: []db.SessionPlayer{{SessionID: sessionID, UserID: userID}},
		},
		lkURL:  "ws://livekit",
		logger: zerolog.Nop(),
	}

	resp, err := svc.GetToken(context.Background(), userID, TokenRequest{
		SessionID: sessionID.String(),
		RoomType:  "main",
	})

	if err != nil {
		t.Fatalf("GetToken returned error: %v", err)
	}
	if resp.RoomName != sessionID.String()+"_main" {
		t.Fatalf("room_name = %q", resp.RoomName)
	}
}

func TestGetTokenProviderFailures(t *testing.T) {
	roomID := uuid.New()
	userID := uuid.New()
	baseQueries := &fakeVoiceQueries{
		room:        db.Room{ID: roomID, Status: "WAITING"},
		roomPlayers: []db.RoomPlayer{{RoomID: roomID, UserID: userID}},
	}

	tests := []struct {
		name     string
		provider *fakeVoiceProvider
	}{
		{name: "create room", provider: &fakeVoiceProvider{createErr: errors.New("livekit unavailable")}},
		{name: "generate token", provider: &fakeVoiceProvider{tokenErr: errors.New("sign failed")}},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			svc := &serviceImpl{
				provider: tt.provider,
				queries:  baseQueries,
				logger:   zerolog.Nop(),
			}

			_, err := svc.GetToken(context.Background(), userID, TokenRequest{
				RoomID:   roomID.String(),
				RoomType: "main",
			})

			assertVoiceAppError(t, err, http.StatusInternalServerError)
		})
	}
}

func TestGetTokenWaitingRoomMissing(t *testing.T) {
	svc := &serviceImpl{
		provider: &fakeVoiceProvider{},
		queries:  &fakeVoiceQueries{roomErr: pgx.ErrNoRows},
		logger:   zerolog.Nop(),
	}

	_, err := svc.GetToken(context.Background(), uuid.New(), TokenRequest{
		RoomID:   uuid.New().String(),
		RoomType: "main",
	})

	assertVoiceAppError(t, err, http.StatusForbidden)
}

func assertVoiceAppError(t *testing.T, err error, wantStatus int) {
	t.Helper()
	if err == nil {
		t.Fatalf("expected error status %d, got nil", wantStatus)
	}
	var appErr *apperror.AppError
	if !errors.As(err, &appErr) {
		t.Fatalf("expected AppError, got %T: %v", err, err)
	}
	if appErr.Status != wantStatus {
		t.Fatalf("status = %d, want %d: %v", appErr.Status, wantStatus, err)
	}
}
