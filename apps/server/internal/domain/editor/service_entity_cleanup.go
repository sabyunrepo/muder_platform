package editor

import (
	"bytes"
	"encoding/json"

	"github.com/google/uuid"
)

func removeCharacterReferencesFromConfigJSON(raw json.RawMessage, characterID uuid.UUID) (json.RawMessage, bool, error) {
	return removeEntityReferencesFromConfigJSON(raw, characterID.String())
}

func removeLocationReferencesFromConfigJSON(raw json.RawMessage, locationID uuid.UUID) (json.RawMessage, bool, error) {
	return removeEntityReferencesFromConfigJSON(raw, locationID.String())
}

func removeEntityReferencesFromConfigJSON(raw json.RawMessage, entityID string) (json.RawMessage, bool, error) {
	if len(bytes.TrimSpace(raw)) == 0 {
		return raw, false, nil
	}
	var value any
	if err := json.Unmarshal(raw, &value); err != nil {
		return nil, false, err
	}
	cleaned, changed := removeEntityIDFromConfigValue(value, entityID)
	if !changed {
		return raw, false, nil
	}
	encoded, err := json.Marshal(cleaned)
	if err != nil {
		return nil, false, err
	}
	return encoded, true, nil
}

func removeEntityIDFromConfigValue(value any, entityID string) (any, bool) {
	switch v := value.(type) {
	case nil:
		return nil, false
	case string:
		if v == entityID {
			return deletedConfigNode, true
		}
		return v, false
	case []any:
		changed := false
		items := make([]any, 0, len(v))
		for _, item := range v {
			cleaned, itemChanged := removeEntityIDFromConfigValue(item, entityID)
			changed = changed || itemChanged
			if cleaned != deletedConfigNode {
				items = append(items, cleaned)
			}
		}
		return items, changed
	case map[string]any:
		if placement, ok := v["placement"].(map[string]any); ok {
			if placementEntityID, ok := placement["entityId"].(string); ok && placementEntityID == entityID {
				return deletedConfigNode, true
			}
		}
		if id, ok := v["id"].(string); ok && id == entityID {
			return deletedConfigNode, true
		}
		if locationID, ok := v["locationId"].(string); ok && locationID == entityID {
			if _, hasClue := v["clueId"].(string); hasClue {
				return deletedConfigNode, true
			}
		}

		changed := false
		out := make(map[string]any, len(v))
		for key, child := range v {
			if key == entityID {
				changed = true
				continue
			}
			cleaned, childChanged := removeEntityIDFromConfigValue(child, entityID)
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
