package session

import (
	"encoding/json"
	"fmt"
	"time"

	"github.com/google/uuid"
)

// snapshotTTL is how long a session snapshot lives in Redis.
const snapshotTTL = 24 * time.Hour

// snapshotKeyPrefix is the Redis key prefix for session snapshots.
// The "mmp:" namespace prevents collisions with other Redis tenants (L-4 fix).
// Old keys ("session:{id}:snapshot") auto-expire via snapshotTTL (24h).
const snapshotKeyPrefix = "mmp:session:"

// snapshotKeySuffix is the Redis key suffix for session snapshots.
const snapshotKeySuffix = ":snapshot"

// sessionSnapshot is the serializable form of the critical session state.
// It intentionally excludes ephemeral or in-memory-only fields (inbox, done,
// engine goroutine state) so that the persisted blob remains compact and
// deterministic across restarts.
type sessionSnapshot struct {
	SessionID    uuid.UUID                  `json:"sessionId"`
	CurrentPhase string                     `json:"currentPhase"`
	PhaseIndex   int                        `json:"phaseIndex"`
	Players      []snapshotPlayer           `json:"players"`
	ModuleStates map[string]json.RawMessage `json:"moduleStates"`
	PersistedAt  int64                      `json:"persistedAt"` // UnixMilli
}

// snapshotPlayer is the serializable form of a PlayerState.
type snapshotPlayer struct {
	PlayerID  uuid.UUID `json:"playerId"`
	Connected bool      `json:"connected"`
}

// snapshotKey returns the Redis key for the given session ID.
// Used for the legacy/fallback full-session blob (kept for backward compat).
func snapshotKey(id uuid.UUID) string {
	return snapshotKeyPrefix + id.String() + snapshotKeySuffix
}

// playerSnapshotKey returns the Redis key for a per-player snapshot blob.
// Format: session:{sessionID}:snapshot:{playerID}
// Written by persistSnapshot (M-7); read by sendSnapshotFromCache.
func playerSnapshotKey(sessionID, playerID uuid.UUID) string {
	return snapshotKeyPrefix + sessionID.String() + snapshotKeySuffix + ":" + playerID.String()
}

// marshalSnapshot converts the in-memory session state to a JSON blob.
// Returns an error if serialization fails; never panics.
func (s *Session) marshalSnapshot() ([]byte, error) {
	players := make([]snapshotPlayer, 0, len(s.players))
	for _, p := range s.players {
		players = append(players, snapshotPlayer{
			PlayerID:  p.PlayerID,
			Connected: p.Connected,
		})
	}

	phaseID := ""
	phaseIdx := 0
	if cp := s.engine.CurrentPhase(); cp != nil {
		phaseID = cp.ID
		phaseIdx = cp.Index
	}

	snap := sessionSnapshot{
		SessionID:    s.ID,
		CurrentPhase: phaseID,
		PhaseIndex:   phaseIdx,
		Players:      players,
		ModuleStates: s.buildModuleStates(),
		PersistedAt:  time.Now().UnixMilli(),
	}

	data, err := json.Marshal(snap)
	if err != nil {
		return nil, fmt.Errorf("session: marshal snapshot: %w", err)
	}
	return data, nil
}

// buildModuleStates extracts per-module state via engine.BuildState().
// On any failure it logs and returns an empty map so snapshot persistence
// never blocks on transient module errors (panic guard sits above this).
func (s *Session) buildModuleStates() map[string]json.RawMessage {
	empty := make(map[string]json.RawMessage)
	if s.engine == nil {
		return empty
	}
	raw, err := s.engine.BuildState()
	if err != nil {
		s.logger.Warn().Err(err).Msg("snapshot: engine BuildState failed, persisting without module state")
		return empty
	}
	var envelope struct {
		Modules map[string]json.RawMessage `json:"modules"`
	}
	if err := json.Unmarshal(raw, &envelope); err != nil {
		s.logger.Warn().Err(err).Msg("snapshot: cannot parse engine state envelope")
		return empty
	}
	if envelope.Modules == nil {
		return empty
	}
	return envelope.Modules
}
