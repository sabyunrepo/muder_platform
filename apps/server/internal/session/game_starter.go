package session

import (
	"context"
	"encoding/json"

	"github.com/google/uuid"
	"github.com/mmp-platform/server/internal/domain/room"
	"github.com/mmp-platform/server/internal/engine"
	"github.com/rs/zerolog"
)

// GameStarterAdapter implements room.GameStarter by delegating to
// startModularGame. It satisfies the interface without the room package
// needing to import the session package directly.
type GameStarterAdapter struct {
	manager       *SessionManager
	broadcaster   Broadcaster
	featureFlag   bool
	mediaResolver engine.MediaResolver
	logger        zerolog.Logger
}

// NewGameStarter creates a GameStarterAdapter. featureFlag mirrors
// cfg.GameRuntimeV2; when false, Start returns ErrGameRuntimeDisabled.
func NewGameStarter(
	manager *SessionManager,
	broadcaster Broadcaster,
	featureFlag bool,
	mediaResolver engine.MediaResolver,
	logger zerolog.Logger,
) *GameStarterAdapter {
	return &GameStarterAdapter{
		manager:       manager,
		broadcaster:   broadcaster,
		featureFlag:   featureFlag,
		mediaResolver: mediaResolver,
		logger:        logger.With().Str("component", "session.game_starter").Logger(),
	}
}

// Start implements room.GameStarter. roomID is used as the sessionID (1:1
// mapping between room and game session). configJSON is the editor-produced
// scenario config. Returns errGameRuntimeDisabled when the feature flag is off.
func (g *GameStarterAdapter) Start(ctx context.Context, roomID, themeID uuid.UUID, configJSON []byte, players []room.GameStartPlayer) error {
	cfg := StartConfig{
		SessionID:     roomID,
		ThemeID:       themeID,
		Players:       toSessionPlayers(players),
		ConfigJSON:    configJSON,
		FeatureFlag:   g.featureFlag,
		Broadcaster:   g.broadcaster,
		MediaResolver: g.mediaResolver,
	}
	_, err := startModularGame(ctx, g.manager, cfg, g.logger)
	return err
}

func toSessionPlayers(players []room.GameStartPlayer) []PlayerState {
	if len(players) == 0 {
		return nil
	}
	result := make([]PlayerState, 0, len(players))
	for _, player := range players {
		state := PlayerState{
			PlayerID:    player.UserID,
			Nickname:    player.Nickname,
			Connected:   true,
			IsAlive:     boolPtr(true),
			IsHost:      player.IsHost,
			IsReady:     player.IsReady,
			ConnectedAt: player.JoinedAt.UnixMilli(),
		}
		if player.CharacterID != nil {
			state.TargetCode = player.CharacterID.String()
			state.DisplayBase = engine.CharacterDisplayBase{
				Name:         player.CharacterName,
				ImageURL:     player.CharacterImageURL,
				ImageMediaID: player.CharacterImageMediaID,
				AliasRules:   engine.ParseCharacterAliasRules(json.RawMessage(player.CharacterAliasRules)),
			}
		}
		result = append(result, state)
	}
	return result
}

func boolPtr(value bool) *bool {
	return &value
}
