package session

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/google/uuid"
	"github.com/mmp-platform/server/internal/engine"
)

func (s *Session) ResolvePlayerID(_ context.Context, targetCode string) (uuid.UUID, bool) {
	if playerID, err := uuid.Parse(targetCode); err == nil {
		if _, ok := s.players[playerID]; ok {
			return playerID, true
		}
		return uuid.Nil, false
	}
	for playerID, player := range s.players {
		if player.TargetCode == targetCode {
			return playerID, true
		}
	}
	return uuid.Nil, false
}

func (s *Session) PlayerRuntimeInfo(_ context.Context, playerID uuid.UUID) (engine.PlayerRuntimeInfo, bool) {
	player, ok := s.players[playerID]
	if !ok {
		return engine.PlayerRuntimeInfo{}, false
	}
	return playerRuntimeInfo(*player, nil), true
}

func (s *Session) PlayerRuntimeRoster(_ context.Context) []engine.PlayerRuntimeInfo {
	return s.PlayerRuntimeRosterWithContext(context.Background(), nil)
}

func (s *Session) PlayerRuntimeRosterWithContext(_ context.Context, displayContext json.RawMessage) []engine.PlayerRuntimeInfo {
	players := make([]engine.PlayerRuntimeInfo, 0, len(s.players))
	for _, player := range s.players {
		players = append(players, playerRuntimeInfo(*player, displayContext))
	}
	return players
}

func (s *Session) ApplyPlayerStatus(_ context.Context, action engine.PlayerStatusAction) (engine.PlayerRuntimeInfo, error) {
	actor, ok := s.players[action.ActorID]
	if !ok {
		return engine.PlayerRuntimeInfo{}, fmt.Errorf("session: actor player %s not found", action.ActorID)
	}
	if !isPlayerAlive(actor) {
		return engine.PlayerRuntimeInfo{}, fmt.Errorf("session: actor player %s is not alive", action.ActorID)
	}

	target, ok := s.players[action.TargetID]
	if !ok {
		return engine.PlayerRuntimeInfo{}, fmt.Errorf("session: target player %s not found", action.TargetID)
	}
	if !action.IsAlive && !isPlayerAlive(target) {
		return engine.PlayerRuntimeInfo{}, fmt.Errorf("session: target player %s is already dead", action.TargetID)
	}

	target.IsAlive = playerAlivePtr(action.IsAlive)
	info := playerRuntimeInfo(*target, nil)
	if bus := s.engine.EventBus(); bus != nil {
		payload := map[string]any{
			"actorId":  action.ActorID.String(),
			"playerId": action.TargetID.String(),
			"isAlive":  action.IsAlive,
			"reason":   action.Reason,
			"source":   action.Source,
		}
		if action.ClueID != uuid.Nil {
			payload["clueId"] = action.ClueID.String()
		}
		bus.Publish(engine.Event{Type: "player.status_changed", Payload: payload})
	}
	s.markDirty()
	return info, nil
}

func playerRuntimeInfo(player PlayerState, displayContext json.RawMessage) engine.PlayerRuntimeInfo {
	info := engine.PlayerRuntimeInfo{
		PlayerID:    player.PlayerID,
		TargetCode:  player.TargetCode,
		Nickname:    player.Nickname,
		Role:        player.Role,
		IsAlive:     isPlayerAlive(&player),
		IsHost:      player.IsHost,
		IsReady:     player.IsReady,
		ConnectedAt: player.ConnectedAt,
	}
	if player.DisplayBase.Name == "" {
		return info
	}
	if len(displayContext) == 0 || string(displayContext) == "null" {
		displayContext = player.DisplayContext
	}
	display := engine.ResolveCharacterDisplay(player.DisplayBase, displayContext)
	info.DisplayName = display.Name
	info.DisplayIconURL = display.ImageURL
	info.DisplayIconMediaID = display.ImageMediaID
	return info
}

func isPlayerAlive(player *PlayerState) bool {
	if player == nil || player.IsAlive == nil {
		return true
	}
	return *player.IsAlive
}

func playerAlivePtr(value bool) *bool {
	return &value
}
