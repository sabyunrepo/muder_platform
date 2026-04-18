package engine

import (
	"github.com/google/uuid"
)

// FilterByPlayer returns a new map containing only the entry keyed by the
// given playerID, if present. If the player has no entry, an empty (non-nil)
// map is returned so JSON marshalling emits `{}` rather than `null`.
//
// This is the canonical shape for per-player redaction in PlayerAwareModule.BuildStateFor:
// module authors map[uuid.UUID]V across every player and must leak only the
// caller's own entry.
func FilterByPlayer[V any](src map[uuid.UUID]V, playerID uuid.UUID) map[uuid.UUID]V {
	out := make(map[uuid.UUID]V, 1)
	if v, ok := src[playerID]; ok {
		out[playerID] = v
	}
	return out
}

// FilterByPlayerStringKey is the string-keyed variant used by modules that
// snapshot their per-player map keyed by uuid string (e.g. evidence, location
// state shapes). Semantics match FilterByPlayer: only the caller's entry or an
// empty map.
func FilterByPlayerStringKey[V any](src map[string]V, playerID uuid.UUID) map[string]V {
	out := make(map[string]V, 1)
	key := playerID.String()
	if v, ok := src[key]; ok {
		out[key] = v
	}
	return out
}

// FilterByKeySet returns a new map containing only entries whose keys are in
// the allow-list. Used for redaction of grouped collections (e.g. group_chat
// messages keyed by groupID — caller can see only messages in groups they
// belong to).
func FilterByKeySet[K comparable, V any](src map[K]V, allow []K) map[K]V {
	out := make(map[K]V, len(allow))
	for _, k := range allow {
		if v, ok := src[k]; ok {
			out[k] = v
		}
	}
	return out
}
