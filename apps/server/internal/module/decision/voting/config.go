package voting

import "encoding/json"

// VotingCandidatePolicy controls which players can appear as voting targets.
type VotingCandidatePolicy struct {
	IncludeDetective   bool `json:"includeDetective"`
	IncludeSelf        bool `json:"includeSelf"`
	IncludeDeadPlayers bool `json:"includeDeadPlayers"`
}

// VotingConfig defines the settings for the voting module.
type VotingConfig struct {
	Mode             string                `json:"mode"`             // "open"|"secret", default "open"
	MinParticipation int                   `json:"minParticipation"` // %, default 75
	TieBreaker       string                `json:"tieBreaker"`       // "revote"|"random"|"no_result", default "revote"
	ShowRealtime     bool                  `json:"showRealtime"`     // default true (only when mode=open)
	RevealVoters     bool                  `json:"revealVoters"`     // default false (only when mode=secret)
	AllowAbstain     bool                  `json:"allowAbstain"`     // default false
	MaxRounds        int                   `json:"maxRounds"`        // default 3
	DeadCanVote      bool                  `json:"deadCanVote"`      // default false
	CandidatePolicy  VotingCandidatePolicy `json:"candidatePolicy"`
}

// Schema returns the JSON Schema describing the module's init config.
func (m *VotingModule) Schema() json.RawMessage {
	schema := map[string]any{
		"type": "object",
		"properties": map[string]any{
			"mode":             map[string]any{"type": "string", "enum": []string{"open", "secret"}, "default": "open"},
			"minParticipation": map[string]any{"type": "integer", "default": 75, "minimum": 0, "maximum": 100},
			"tieBreaker":       map[string]any{"type": "string", "enum": []string{"revote", "random", "no_result"}, "default": "revote"},
			"showRealtime":     map[string]any{"type": "boolean", "default": true, "description": "Show votes in real-time (open mode only)"},
			"revealVoters":     map[string]any{"type": "boolean", "default": false, "description": "Reveal who voted for whom (secret mode only)"},
			"allowAbstain":     map[string]any{"type": "boolean", "default": false},
			"maxRounds":        map[string]any{"type": "integer", "default": 3, "minimum": 1},
			"deadCanVote":      map[string]any{"type": "boolean", "default": false},
			"candidatePolicy": map[string]any{
				"type":        "object",
				"title":       "투표 후보 정책",
				"description": "최종 투표 후보에 누가 포함되는지 정합니다.",
				"properties": map[string]any{
					"includeDetective":   map[string]any{"type": "boolean", "default": false, "description": "탐정 캐릭터를 범인 지목 후보에 포함합니다."},
					"includeSelf":        map[string]any{"type": "boolean", "default": false, "description": "자기 자신에게 투표할 수 있게 합니다."},
					"includeDeadPlayers": map[string]any{"type": "boolean", "default": false, "description": "탈락한 플레이어도 후보에 포함합니다."},
				},
				"additionalProperties": false,
			},
		},
		"additionalProperties": false,
	}
	data, _ := json.Marshal(schema)
	return data
}
