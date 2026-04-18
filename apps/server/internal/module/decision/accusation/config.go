package accusation

import (
	"encoding/json"
	"time"

	"github.com/google/uuid"
)

// AccusationConfig defines the settings for the accusation module.
type AccusationConfig struct {
	MaxPerRound     int  `json:"maxPerRound"`     // default 1
	DefenseTime     int  `json:"defenseTime"`     // seconds, default 60
	VoteThreshold   int  `json:"voteThreshold"`   // %, default 50
	AllowSelfAccuse bool `json:"allowSelfAccuse"` // default false
	DeadCanAccuse   bool `json:"deadCanAccuse"`   // default false
}

// Accusation represents an active accusation.
type Accusation struct {
	AccuserID       uuid.UUID          `json:"accuserId"`
	AccusedID       uuid.UUID          `json:"accusedId"`
	AccusedCode     string             `json:"accusedCode"`
	DefenseDeadline time.Time          `json:"defenseDeadline"`
	Votes           map[uuid.UUID]bool `json:"votes"`          // true=guilty, false=innocent
	EligibleVoters  int                `json:"eligibleVoters"` // total players minus accuser and accused
}

// Schema returns the JSON Schema describing the module's init config.
func (m *AccusationModule) Schema() json.RawMessage {
	schema := map[string]any{
		"type": "object",
		"properties": map[string]any{
			"maxPerRound":     map[string]any{"type": "integer", "default": 1, "minimum": 1},
			"defenseTime":     map[string]any{"type": "integer", "default": 60, "minimum": 10, "description": "Defense time in seconds"},
			"voteThreshold":   map[string]any{"type": "integer", "default": 50, "minimum": 1, "maximum": 100, "description": "Guilty vote % to expel"},
			"allowSelfAccuse": map[string]any{"type": "boolean", "default": false},
			"deadCanAccuse":   map[string]any{"type": "boolean", "default": false},
		},
		"additionalProperties": false,
	}
	data, _ := json.Marshal(schema)
	return data
}
