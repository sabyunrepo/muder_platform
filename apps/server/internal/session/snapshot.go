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
	cache        cache.Provider
	sender       ClientSender
	dirty        bool
	lastPersist  time.Time
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

// SendSnapshot reads the snapshot from Redis and sends it to the reconnecting
// player via the hub. Safe to call from any goroutine (reads Redis directly).
func (s *Session) SendSnapshot(playerID uuid.UUID) {
	if s.cache == nil || s.sender == nil {
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
		Msg("snapshot: sent to reconnecting player")
}
