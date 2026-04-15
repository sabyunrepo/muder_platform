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
const snapshotKeyPrefix = "session:"

// snapshotKeySuffix is the Redis key suffix for session snapshots.
const snapshotKeySuffix = ":snapshot"

// sessionSnapshot is the serializable form of the critical session state.
// It intentionally excludes ephemeral or in-memory-only fields (inbox, done,
// engine goroutine state) so that the persisted blob remains compact and
// deterministic across restarts.
type sessionSnapshot struct {
	SessionID     uuid.UUID              `json:"sessionId"`
	CurrentPhase  string                 `json:"currentPhase"`
	PhaseIndex    int                    `json:"phaseIndex"`
	Players       []snapshotPlayer       `json:"players"`
	ModuleStates  map[string]interface{} `json:"moduleStates"`
	PersistedAt   int64                  `json:"persistedAt"` // UnixMilli
}

// snapshotPlayer is the serializable form of a PlayerState.
type snapshotPlayer struct {
	PlayerID  uuid.UUID `json:"playerId"`
	Connected bool      `json:"connected"`
}

// snapshotKey returns the Redis key for the given session ID.
func snapshotKey(id uuid.UUID) string {
	return snapshotKeyPrefix + id.String() + snapshotKeySuffix
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
		ModuleStates: make(map[string]interface{}),
		PersistedAt:  time.Now().UnixMilli(),
	}

	data, err := json.Marshal(snap)
	if err != nil {
		return nil, fmt.Errorf("session: marshal snapshot: %w", err)
	}
	return data, nil
}
