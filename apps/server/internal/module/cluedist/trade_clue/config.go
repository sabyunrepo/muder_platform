package trade_clue

import (
	"encoding/json"
	"time"

	"github.com/google/uuid"
)

// TradeClueConfig defines settings for the trade clue module.
type TradeClueConfig struct {
	AllowTrade           bool `json:"allowTrade"`
	AllowShow            bool `json:"allowShow"`
	ShowDuration         int  `json:"showDuration"` // seconds
	ShowMaxViewers       int  `json:"showMaxViewers"`
	RequireMutualTrade   bool `json:"requireMutualTrade"`
	TradeProposalTimeout int  `json:"tradeProposalTimeout"` // seconds
}

// TradeProposal represents an active clue trade proposal.
type TradeProposal struct {
	ID              string    `json:"id"`
	ProposerID      uuid.UUID `json:"proposerId"`
	TargetID        string    `json:"targetId"` // character code
	OfferedClueID   string    `json:"offeredClueId"`
	RequestedClueID string    `json:"requestedClueId"`
	CreatedAt       time.Time `json:"createdAt"`
	Status          string    `json:"status"` // "pending", "accepted", "declined", "expired"
}

// ShowSession represents an active clue-showing session.
type ShowSession struct {
	ID        string    `json:"id"`
	OwnerID   uuid.UUID `json:"ownerId"`
	ViewerID  string    `json:"viewerId"` // character code
	ClueID    string    `json:"clueId"`
	ExpiresAt time.Time `json:"expiresAt"`
	Status    string    `json:"status"` // "pending", "active", "declined", "expired"
}

// Schema returns the JSON Schema describing the module's init config.
func (m *TradeClueModule) Schema() json.RawMessage {
	schema := map[string]any{
		"type": "object",
		"properties": map[string]any{
			"allowTrade":           map[string]any{"type": "boolean", "default": true, "description": "Allow clue trading between players"},
			"allowShow":            map[string]any{"type": "boolean", "default": true, "description": "Allow showing clues to other players"},
			"showDuration":         map[string]any{"type": "integer", "default": 30, "minimum": 1, "description": "Duration in seconds for show sessions"},
			"showMaxViewers":       map[string]any{"type": "integer", "default": 1, "minimum": 1, "description": "Maximum concurrent viewers per clue show"},
			"requireMutualTrade":   map[string]any{"type": "boolean", "default": false, "description": "Require both parties to offer a clue"},
			"tradeProposalTimeout": map[string]any{"type": "integer", "default": 60, "minimum": 1, "description": "Seconds before a trade proposal expires"},
		},
		"additionalProperties": false,
	}
	data, _ := json.Marshal(schema)
	return data
}
