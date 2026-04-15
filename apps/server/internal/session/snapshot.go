package session

import (
	"context"
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
// Errors are logged but never bubbled up — snapshots auto-expire via TTL.
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
