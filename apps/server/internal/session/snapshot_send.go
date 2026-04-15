package session

import (
	"context"
	"encoding/json"
	"time"

	"github.com/google/uuid"
	"github.com/mmp-platform/server/internal/ws"
)

// SendSnapshot dispatches a player-aware snapshot rebuild to the session actor
// so the PhaseEngine (non-thread-safe) is touched only from its own goroutine.
// The actor reconstructs state via engine.BuildStateFor(playerID) so role-
// private data never reaches the wrong client. (Phase 18.1 B-2)
//
// When the session is not StatusRunning (recovery path), we fall back to the
// player-specific Redis blob written by persistSnapshot (M-7 fix).
//
// Safe to call from any goroutine.
func (s *Session) SendSnapshot(playerID uuid.UUID) {
	if s.sender == nil {
		return
	}

	if s.Status() == StatusRunning {
		// Dispatch rebuild into the actor; errors are logged there.
		if err := s.Send(SessionMessage{
			Kind:     KindSnapshotFor,
			PlayerID: playerID,
		}); err != nil {
			s.logger.Warn().Err(err).
				Str("player_id", playerID.String()).
				Msg("snapshot: could not enqueue player-aware rebuild, falling back to Redis")
			s.sendSnapshotFromCache(playerID)
		}
		return
	}

	// Session is not running — use player-specific Redis blob (M-7).
	s.sendSnapshotFromCache(playerID)
}

// sendSnapshotFromCache reads the player-specific Redis blob and sends it.
// Falls back to a session-level key if the player-specific key is missing
// (e.g. old data written before M-7 fix). Uses s.Ctx() (L-2).
// MUST only be used when the actor cannot be invoked (session not running).
func (s *Session) sendSnapshotFromCache(playerID uuid.UUID) {
	if s.cache == nil {
		return
	}

	ctx, cancel := context.WithTimeout(s.Ctx(), 3*time.Second)
	defer cancel()

	// Try player-specific key first (M-7).
	data, err := s.cache.Get(ctx, playerSnapshotKey(s.ID, playerID))
	if err != nil {
		// Fall back to legacy session-level key.
		data, err = s.cache.Get(ctx, snapshotKey(s.ID))
		if err != nil {
			s.logger.Warn().Err(err).
				Str("player_id", playerID.String()).
				Msg("snapshot: redis get failed on reconnect (no player or session blob)")
			return
		}
	}

	var raw json.RawMessage = data
	env, err := ws.NewEnvelope(TypeSessionState, raw)
	if err != nil {
		s.logger.Error().Err(err).Msg("snapshot: envelope build failed")
		return
	}

	s.sender.SendToPlayer(playerID, env)
	s.logger.Debug().
		Str("player_id", playerID.String()).
		Str("session_id", s.ID.String()).
		Msg("snapshot: sent player-specific blob to reconnecting player (recovery path)")
}

// sendSnapshotForActor is called by the actor goroutine in response to
// KindSnapshotFor. Reconstructs a per-player engine state and emits the WS
// envelope directly. MUST be called only from the actor.
func (s *Session) sendSnapshotForActor(playerID uuid.UUID) {
	if s.sender == nil || s.engine == nil {
		return
	}

	raw, err := s.engine.BuildStateFor(playerID)
	if err != nil {
		s.logger.Error().Err(err).
			Str("player_id", playerID.String()).
			Msg("snapshot: engine BuildStateFor failed, falling back to cache")
		s.sendSnapshotFromCache(playerID)
		return
	}

	env, err := ws.NewEnvelope(TypeSessionState, raw)
	if err != nil {
		s.logger.Error().Err(err).Msg("snapshot: envelope build failed")
		return
	}

	s.sender.SendToPlayer(playerID, env)
	s.logger.Debug().
		Str("player_id", playerID.String()).
		Str("session_id", s.ID.String()).
		Msg("snapshot: sent player-aware state to reconnecting player")
}
