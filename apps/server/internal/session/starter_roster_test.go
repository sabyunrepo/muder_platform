package session

import (
	"context"
	"encoding/json"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/mmp-platform/server/internal/domain/room"
	"github.com/rs/zerolog"
)

func TestToSessionPlayers_MapsRoomRosterCharacterDisplay(t *testing.T) {
	playerID := uuid.New()
	characterID := uuid.New()
	joinedAt := time.Unix(1700, 456_000_000)
	imageURL := "https://cdn.example/character.png"
	imageMediaID := uuid.New().String()

	got := toSessionPlayers([]room.GameStartPlayer{{
		UserID:                playerID,
		CharacterID:           &characterID,
		Nickname:              "계정 닉네임",
		IsHost:                true,
		IsReady:               true,
		JoinedAt:              joinedAt,
		CharacterName:         "홍길동",
		CharacterImageURL:     &imageURL,
		CharacterImageMediaID: &imageMediaID,
		CharacterAliasRules: json.RawMessage(`[
			{"id":"mask","display_name":"가면 쓴 탐정","priority":1}
		]`),
	}})

	if len(got) != 1 {
		t.Fatalf("players len = %d, want 1", len(got))
	}
	player := got[0]
	if player.PlayerID != playerID || player.TargetCode != characterID.String() {
		t.Fatalf("identity mismatch: %+v", player)
	}
	if player.Nickname != "계정 닉네임" || !player.Connected || !player.IsHost || !player.IsReady {
		t.Fatalf("account flags mismatch: %+v", player)
	}
	if player.IsAlive == nil || !*player.IsAlive {
		t.Fatalf("IsAlive = %v, want true pointer", player.IsAlive)
	}
	if player.ConnectedAt != joinedAt.UnixMilli() {
		t.Fatalf("ConnectedAt = %d, want %d", player.ConnectedAt, joinedAt.UnixMilli())
	}
	if player.DisplayBase.Name != "홍길동" {
		t.Fatalf("DisplayBase.Name = %q, want 홍길동", player.DisplayBase.Name)
	}
	if player.DisplayBase.ImageURL == nil || *player.DisplayBase.ImageURL != imageURL {
		t.Fatalf("DisplayBase.ImageURL = %v, want %s", player.DisplayBase.ImageURL, imageURL)
	}
	if player.DisplayBase.ImageMediaID == nil || *player.DisplayBase.ImageMediaID != imageMediaID {
		t.Fatalf("DisplayBase.ImageMediaID = %v, want %s", player.DisplayBase.ImageMediaID, imageMediaID)
	}
	if len(player.DisplayBase.AliasRules) != 1 || player.DisplayBase.AliasRules[0].DisplayName == nil {
		t.Fatalf("AliasRules not parsed: %+v", player.DisplayBase.AliasRules)
	}
}

func TestToSessionPlayers_EmptyRosterReturnsNil(t *testing.T) {
	if got := toSessionPlayers(nil); got != nil {
		t.Fatalf("toSessionPlayers(nil) = %#v, want nil", got)
	}
	if got := toSessionPlayers([]room.GameStartPlayer{}); got != nil {
		t.Fatalf("toSessionPlayers(empty) = %#v, want nil", got)
	}
}

func TestGameStarterAdapter_StartRegistersSessionWithRoomRoster(t *testing.T) {
	m := newTestManager(t)
	bc := &mockBroadcaster{}
	roomID := uuid.New()
	themeID := uuid.New()
	playerID := uuid.New()
	characterID := uuid.New()
	joinedAt := time.Unix(1700, 789_000_000)

	starter := NewGameStarter(m, bc, true, nil, zerolog.Nop())
	err := starter.Start(context.Background(), roomID, themeID, minimalConfigJSON(t), []room.GameStartPlayer{{
		UserID:      playerID,
		CharacterID: &characterID,
		Nickname:    "계정 닉네임",
		IsHost:      true,
		IsReady:     true,
		JoinedAt:    joinedAt,
	}})
	if err != nil {
		t.Fatalf("Start failed: %v", err)
	}
	s := m.Get(roomID)
	if s == nil {
		t.Fatal("session not registered")
	}
	defer func() {
		if err := m.Stop(roomID); err != nil {
			t.Fatalf("Stop failed: %v", err)
		}
	}()

	player, ok := s.players[playerID]
	if !ok {
		t.Fatalf("session player %s not registered: %+v", playerID, s.players)
	}
	if player.PlayerID != playerID || player.TargetCode != characterID.String() {
		t.Fatalf("roster identity mismatch: %+v", player)
	}
	if player.Nickname != "계정 닉네임" || !player.IsHost || !player.IsReady {
		t.Fatalf("roster flags mismatch: %+v", player)
	}
	if player.ConnectedAt != joinedAt.UnixMilli() {
		t.Fatalf("ConnectedAt = %d, want %d", player.ConnectedAt, joinedAt.UnixMilli())
	}
}
