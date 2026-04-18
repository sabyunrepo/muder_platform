package hidden_mission

import "encoding/json"

// HiddenMissionConfig defines the settings for the hidden mission module.
type HiddenMissionConfig struct {
	VerificationMode string `json:"verificationMode"` // "auto"|"self_report"|"gm_verify", default "auto"
	ShowResultAt     string `json:"showResultAt"`     // default "ending"
	ScoreWinnerTitle string `json:"scoreWinnerTitle"` // default "MVP"
	AffectsScore     bool   `json:"affectsScore"`     // default true
}

// Mission represents a single hidden mission assigned to a player.
type Mission struct {
	ID           string `json:"id"`
	Type         string `json:"type"` // "hold_clue"|"vote_target"|"transfer_clue"|"survive"|"custom"
	Description  string `json:"description"`
	Points       int    `json:"points"`
	Verification string `json:"verification"` // "auto"|"self_report"|"gm_verify"
	TargetClueID string `json:"targetClueId,omitempty"`
	Completed    bool   `json:"completed"`
}

// Schema returns the JSON Schema describing the module's init config.
func (m *HiddenMissionModule) Schema() json.RawMessage {
	schema := map[string]any{
		"type": "object",
		"properties": map[string]any{
			"verificationMode": map[string]any{"type": "string", "enum": []string{"auto", "self_report", "gm_verify"}, "default": "auto"},
			"showResultAt":     map[string]any{"type": "string", "default": "ending"},
			"scoreWinnerTitle": map[string]any{"type": "string", "default": "MVP"},
			"affectsScore":     map[string]any{"type": "boolean", "default": true},
			"playerMissions":   map[string]any{"type": "object", "description": "Map of playerID to mission arrays"},
		},
		"additionalProperties": false,
	}
	data, _ := json.Marshal(schema)
	return data
}
