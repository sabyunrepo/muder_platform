package editor

import (
	"bytes"
	"encoding/json"

	"github.com/google/uuid"
)

func removeClueReferencesFromConfigJSON(raw json.RawMessage, clueID uuid.UUID) (json.RawMessage, bool, error) {
	if len(bytes.TrimSpace(raw)) == 0 {
		return raw, false, nil
	}
	var value any
	if err := json.Unmarshal(raw, &value); err != nil {
		return nil, false, err
	}
	cleaned, changed := removeClueIDFromConfigValue(value, clueID.String())
	if !changed {
		return raw, false, nil
	}
	encoded, err := json.Marshal(cleaned)
	if err != nil {
		return nil, false, err
	}
	return encoded, true, nil
}

var deletedConfigNode = &struct{}{}

func removeClueIDFromConfigValue(value any, clueID string) (any, bool) {
	switch v := value.(type) {
	case nil:
		return nil, false
	case string:
		if v == clueID {
			return deletedConfigNode, true
		}
		return v, false
	case []any:
		changed := false
		items := make([]any, 0, len(v))
		for _, item := range v {
			cleaned, itemChanged := removeClueIDFromConfigValue(item, clueID)
			changed = changed || itemChanged
			if cleaned != deletedConfigNode {
				items = append(items, cleaned)
			}
		}
		return items, changed
	case map[string]any:
		if placement, ok := v["placement"].(map[string]any); ok {
			entityID, hasEntityID := placement["entityId"].(string)
			placementKind, hasKind := placement["kind"].(string)
			if hasKind && placementKind == "clue" && hasEntityID && entityID == clueID {
				return deletedConfigNode, true
			}
		}
		if currentClueID, ok := v["clueId"].(string); ok && currentClueID == clueID {
			if _, hasLocation := v["locationId"].(string); hasLocation {
				return deletedConfigNode, true
			}
		}

		changed := false
		out := make(map[string]any, len(v))
		for key, child := range v {
			cleaned, childChanged := removeClueIDFromConfigValue(child, clueID)
			changed = changed || childChanged
			if cleaned != deletedConfigNode {
				out[key] = cleaned
			}
		}
		return out, changed
	default:
		return value, false
	}
}
