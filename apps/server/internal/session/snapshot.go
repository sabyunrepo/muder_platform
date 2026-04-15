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

// persistSnapshot serialises a per-player snapshot for every known player and
// writes each to Redis under session:{id}:snapshot:{playerID} (M-7).
// Uses s.Ctx() so the write is cancelled when the session stops (L-2).
// On any failure it logs and continues — the game is never interrupted.
// MUST be called only from the actor goroutine (race-free by design).
func (s *Session) persistSnapshot() {
	if s.cache == nil || s.engine == nil {
		return
	}

	ctx, cancel := context.WithTimeout(s.Ctx(), 3*time.Second)
	defer cancel()

	for playerID := range s.players {
		raw, err := s.engine.BuildStateFor(playerID)
		if err != nil {
			s.logger.Error().Err(err).
				Str("player_id", playerID.String()).
				Msg("snapshot: BuildStateFor failed, skipping player blob")
			continue
		}
		key := playerSnapshotKey(s.ID, playerID)
		if err := s.cache.Set(ctx, key, raw, snapshotTTL); err != nil {
			s.logger.Error().Err(err).
				Str("key", key).
				Msg("snapshot: redis write failed for player blob")
		}
	}

	s.dirty = false
	s.lastPersist = time.Now()
	s.logger.Debug().
		Str("session_id", s.ID.String()).
		Int("players", len(s.players)).
		Msg("snapshot: per-player blobs persisted to redis")
}

// flushSnapshot forces an immediate persist regardless of dirty/debounce state.
// Used for critical events (phase transition, game end).
// MUST be called only from the actor goroutine.
func (s *Session) flushSnapshot() {
	s.dirty = true
	s.persistSnapshot()
}

// deleteSnapshot proactively removes all per-player Redis blobs for this session.
// Called on KindStop so PII (role, chat, clues) does not linger for 24h
// after the game ends (M-5 + M-7 fix).
// Uses s.Ctx() so the delete inherits session lifetime (L-2).
// Errors are logged but never bubbled up — snapshots auto-expire via TTL if delete fails.
// MUST be called only from the actor goroutine.
func (s *Session) deleteSnapshot() {
	if s.cache == nil {
		return
	}
	ctx, cancel := context.WithTimeout(s.Ctx(), 3*time.Second)
	defer cancel()

	keys := make([]string, 0, len(s.players)+1)
	for playerID := range s.players {
		keys = append(keys, playerSnapshotKey(s.ID, playerID))
	}
	// Also delete the legacy session-level key (if it exists from older runs).
	keys = append(keys, snapshotKey(s.ID))

	if err := s.cache.Del(ctx, keys...); err != nil {
		s.logger.Warn().Err(err).
			Str("session_id", s.ID.String()).
			Msg("snapshot: redis delete failed (will expire via TTL)")
		return
	}
	s.logger.Debug().
		Str("session_id", s.ID.String()).
		Msg("snapshot: per-player blobs deleted from redis on session stop")
}

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
