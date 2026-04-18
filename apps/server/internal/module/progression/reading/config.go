package reading

import "encoding/json"

// readingConfig is the JSON representation of the module's init config.
type readingConfig struct {
	AdvanceMode    string              `json:"AdvanceMode"`
	DefaultVoiceID string              `json:"DefaultVoiceID"`
	TotalLines     int                 `json:"TotalLines"`
	Lines          []readingLineConfig `json:"Lines,omitempty"`
	BGMId          string              `json:"BGMId,omitempty"`
}

// readingLineConfig describes a single script line's storage representation.
type readingLineConfig struct {
	Index        int    `json:"Index"`
	Text         string `json:"Text,omitempty"`
	VoiceID      string `json:"VoiceID,omitempty"`
	AdvanceBy    string `json:"AdvanceBy,omitempty"`
	Speaker      string `json:"Speaker,omitempty"`
	VoiceMediaID string `json:"VoiceMediaID,omitempty"`
}

// Schema returns the JSON Schema for ReadingModule settings.
func (m *ReadingModule) Schema() json.RawMessage {
	return json.RawMessage(`{
		"type": "object",
		"properties": {
			"AdvanceMode": {"type": "string", "enum": ["gm", "auto", "player"], "default": "gm"},
			"DefaultVoiceID": {"type": "string"},
			"TotalLines": {"type": "integer", "minimum": 0},
			"BGMId": {"type": "string"},
			"Lines": {
				"type": "array",
				"items": {
					"type": "object",
					"properties": {
						"VoiceID": {"type": "string"}
					}
				}
			}
		}
	}`)
}
