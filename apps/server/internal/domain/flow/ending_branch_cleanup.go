package flow

import (
	"bytes"
	"encoding/json"

	"github.com/google/uuid"
)

func removeEndingReferencesFromConfigJSON(raw json.RawMessage, endingID uuid.UUID) (json.RawMessage, bool, error) {
	if len(bytes.TrimSpace(raw)) == 0 {
		return raw, false, nil
	}

	var root map[string]any
	if err := json.Unmarshal(raw, &root); err != nil {
		return nil, false, err
	}

	changed := false
	if modules, ok := root["modules"].(map[string]any); ok {
		if endingBranch, ok := modules["ending_branch"].(map[string]any); ok {
			if config, ok := endingBranch["config"].(map[string]any); ok {
				changed = removeEndingReferencesFromBranchConfig(config, endingID.String()) || changed
			}
			changed = removeEndingReferencesFromBranchConfig(endingBranch, endingID.String()) || changed
		}
	}

	if !changed {
		return raw, false, nil
	}
	encoded, err := json.Marshal(root)
	if err != nil {
		return nil, false, err
	}
	return encoded, true, nil
}

func removeEndingReferencesFromBranchConfig(config map[string]any, endingID string) bool {
	changed := false
	if value, ok := config["defaultEnding"].(string); ok && value == endingID {
		delete(config, "defaultEnding")
		changed = true
	}

	matrix, ok := config["matrix"].([]any)
	if !ok {
		return changed
	}

	cleaned := make([]any, 0, len(matrix))
	for _, item := range matrix {
		row, ok := item.(map[string]any)
		if ok {
			if value, ok := row["ending"].(string); ok && value == endingID {
				changed = true
				continue
			}
		}
		cleaned = append(cleaned, item)
	}
	if changed {
		config["matrix"] = cleaned
	}
	return changed
}
