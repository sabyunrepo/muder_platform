package session

import (
	"context"

	"github.com/google/uuid"
	"github.com/rs/zerolog"
)

// GameStarterAdapter implements room.GameStarter by delegating to
// startModularGame. It satisfies the interface without the room package
// needing to import the session package directly.
type GameStarterAdapter struct {
	manager     *SessionManager
	broadcaster Broadcaster
	featureFlag bool
	logger      zerolog.Logger
}

// NewGameStarter creates a GameStarterAdapter. featureFlag mirrors
// cfg.GameRuntimeV2; when false, Start returns ErrGameRuntimeDisabled.
func NewGameStarter(
	manager *SessionManager,
	broadcaster Broadcaster,
	featureFlag bool,
	logger zerolog.Logger,
) *GameStarterAdapter {
	return &GameStarterAdapter{
		manager:     manager,
		broadcaster: broadcaster,
		featureFlag: featureFlag,
		logger:      logger.With().Str("component", "session.game_starter").Logger(),
	}
}

// Start implements room.GameStarter. roomID is used as the sessionID (1:1
// mapping between room and game session). configJSON is the editor-produced
// scenario config. Returns errGameRuntimeDisabled when the feature flag is off.
func (g *GameStarterAdapter) Start(ctx context.Context, roomID uuid.UUID, configJSON []byte) error {
	cfg := StartConfig{
		SessionID:   roomID,
		ThemeID:     uuid.Nil, // resolved from configJSON by engine
		Players:     nil,      // players joined via WS; session actor manages roster
		ConfigJSON:  configJSON,
		FeatureFlag: g.featureFlag,
		Broadcaster: g.broadcaster,
	}
	_, err := startModularGame(ctx, g.manager, cfg, g.logger)
	return err
}
