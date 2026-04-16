package session

import (
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
