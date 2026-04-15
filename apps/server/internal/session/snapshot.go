package session

import (
	"context"
	"encoding/json"
	"time"

	"github.com/google/uuid"
	"github.com/mmp-platform/server/internal/infra/cache"
	"github.com/mmp-platform/server/internal/ws"
)

// snapshotDebounceInterval is the minimum time between consecutive Redis writes.
// Calls within this window set the dirty flag; the next ticker fires the flush.
const snapshotDebounceInterval = 5 * time.Second

// TypeSessionState is the WS envelope type sent to reconnecting clients.
const TypeSessionState = "session:state"

// ClientSender abstracts Hub.SendToPlayer so snapshot.go does not import ws.Hub directly.
type ClientSender interface {
	SendToPlayer(playerID uuid.UUID, env *ws.Envelope)
}

// snapshotFields holds the mutable snapshot-related fields injected into Session.
// Kept separate so newSession signature stays minimal.
type snapshotFields struct {
	cache       cache.Provider
	sender      ClientSender
	dirty       bool
	lastPersist time.Time
}

// injectSnapshot wires the optional snapshot dependencies after construction.
// Called by SessionManager.Start when a cache and hub are available.
func (s *Session) injectSnapshot(c cache.Provider, sender ClientSender) {
	s.snapshotFields.cache = c
	s.snapshotFields.sender = sender
}

// markDirty records that the session state has changed and should be persisted.
// MUST be called only from the actor goroutine.
func (s *Session) markDirty() {
	s.dirty = true
}

// maybeSnapshot is called on each snapshotInterval tick.
// It flushes the snapshot to Redis if the session is dirty and the debounce
// window has elapsed.
func (s *Session) maybeSnapshot() {
	if !s.dirty {
		return
	}
	if time.Since(s.lastPersist) < snapshotDebounceInterval {
		return
	}
	s.persistSnapshot()
}

// persistSnapshot serialises the current session state and writes it to Redis.
// On serialisation failure it logs and continues — the game is never interrupted.
// MUST be called only from the actor goroutine (race-free by design).
func (s *Session) persistSnapshot() {
	if s.cache == nil {
		return
	}

	data, err := s.marshalSnapshot()
	if err != nil {
		s.logger.Error().Err(err).Msg("snapshot: marshal failed, skipping persist")
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()

	if err := s.cache.Set(ctx, snapshotKey(s.ID), data, snapshotTTL); err != nil {
		s.logger.Error().Err(err).Str("key", snapshotKey(s.ID)).Msg("snapshot: redis write failed")
		return
	}

	s.dirty = false
	s.lastPersist = time.Now()
	s.logger.Debug().Str("session_id", s.ID.String()).Msg("snapshot: persisted to redis")
}

// flushSnapshot forces an immediate persist regardless of dirty/debounce state.
// Used for critical events (phase transition, game end).
// MUST be called only from the actor goroutine.
func (s *Session) flushSnapshot() {
	s.dirty = true
	s.persistSnapshot()
}

// SendSnapshot dispatches a player-aware snapshot rebuild to the session actor
// so the PhaseEngine (non-thread-safe) is touched only from its own goroutine.
// The actor reconstructs state via engine.BuildStateFor(playerID) so role-
// private data never reaches the wrong client. (Phase 18.1 B-2)
//
// When the session is not StatusRunning (e.g. still recovering, or stopped),
// we fall back to the Redis snapshot blob. WARNING: that blob is NOT yet
// redacted per-player — this fallback MUST be revisited if we ever serve real
// reconnects during recovery. Tracked as M-7 in Phase 18.2.
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

	// Session is not running — fall back to the (non-redacted) Redis blob.
	s.sendSnapshotFromCache(playerID)
}

// sendSnapshotFromCache is the legacy Redis-blob path. MUST only be used when
// the actor cannot be invoked (session not running). The blob is NOT redacted
// per-player; tolerable because recovery-path reconnects should be rare and
// the blob carries the same data the player could see before disconnect.
func (s *Session) sendSnapshotFromCache(playerID uuid.UUID) {
	if s.cache == nil {
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()

	data, err := s.cache.Get(ctx, snapshotKey(s.ID))
	if err != nil {
		s.logger.Warn().Err(err).
			Str("player_id", playerID.String()).
			Msg("snapshot: redis get failed on reconnect")
		return
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
		Msg("snapshot: sent cached blob to reconnecting player (recovery path)")
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
