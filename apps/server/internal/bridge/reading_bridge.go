package bridge

import (
	"context"
	"encoding/json"

	"github.com/google/uuid"

	"github.com/mmp-platform/server/internal/module/progression"
	"github.com/mmp-platform/server/internal/ws"
)

// ReadingModuleAdapter wraps a *progression.ReadingModule so it satisfies the
// ws.ReadingModuleAPI interface. The progression module persists per-line
// configuration with PascalCase JSON tags (matching the JSONB storage
// contract); the WS wire format is camelCase. This adapter sits between the
// two and converts the lines slice on the read path so the FE always sees a
// consistent camelCase payload.
type ReadingModuleAdapter struct {
	Module *progression.ReadingModule
}

// Compile-time interface satisfaction check.
var _ ws.ReadingModuleAPI = (*ReadingModuleAdapter)(nil)

// readingLineWire is the camelCase JSON shape sent across the WS for each
// reading line. Mirrors the storage struct in progression.readingLineConfig
// but with the wire-friendly tags FE consumers expect. Index and text are
// required so the FE can render dialogue correctly; the ReadingOverlay keys
// off index and renders text via TypewriterEffect.
type readingLineWire struct {
	Index        int    `json:"index"`
	Text         string `json:"text,omitempty"`
	VoiceID      string `json:"voiceId,omitempty"`
	AdvanceBy    string `json:"advanceBy,omitempty"`
	Speaker      string `json:"speaker,omitempty"`
	VoiceMediaID string `json:"voiceMediaId,omitempty"`
}

// readingLineStorage is the PascalCase shape stored in JSONB and returned by
// progression.GetReadingStateWire(). It's intentionally local to the adapter
// so the ws and progression packages stay decoupled.
type readingLineStorage struct {
	Index        int    `json:"Index"`
	Text         string `json:"Text,omitempty"`
	VoiceID      string `json:"VoiceID,omitempty"`
	AdvanceBy    string `json:"AdvanceBy,omitempty"`
	Speaker      string `json:"Speaker,omitempty"`
	VoiceMediaID string `json:"VoiceMediaID,omitempty"`
}

// ConvertReadingLinesToCamelCase is the exported version used by the WS
// layer when forwarding the reading.started engine event, where the payload
// carries lines in the raw storage (PascalCase) shape and must be converted
// before broadcast. See convertLinesToCamelCase for the internal helper the
// adapter uses on the reconnect snapshot path.
func ConvertReadingLinesToCamelCase(raw json.RawMessage) json.RawMessage {
	return convertLinesToCamelCase(raw)
}

// convertLinesToCamelCase reads PascalCase-tagged lines from the storage
// representation and re-marshals them with camelCase tags suitable for the
// wire. On any unmarshal failure it falls back to an empty array so the
// outer envelope stays valid JSON.
func convertLinesToCamelCase(raw json.RawMessage) json.RawMessage {
	if len(raw) == 0 {
		return json.RawMessage(`[]`)
	}
	var storage []readingLineStorage
	if err := json.Unmarshal(raw, &storage); err != nil {
		return json.RawMessage(`[]`)
	}
	wire := make([]readingLineWire, len(storage))
	for i, s := range storage {
		wire[i] = readingLineWire{
			Index:        s.Index,
			Text:         s.Text,
			VoiceID:      s.VoiceID,
			AdvanceBy:    s.AdvanceBy,
			Speaker:      s.Speaker,
			VoiceMediaID: s.VoiceMediaID,
		}
	}
	out, err := json.Marshal(wire)
	if err != nil {
		return json.RawMessage(`[]`)
	}
	return out
}

func (a *ReadingModuleAdapter) HandleAdvance(ctx context.Context, playerID uuid.UUID, isHost bool, roleID string) error {
	return a.Module.HandleAdvance(ctx, playerID, isHost, roleID)
}

func (a *ReadingModuleAdapter) HandleVoiceEnded(ctx context.Context, voiceID string) error {
	return a.Module.HandleVoiceEnded(ctx, voiceID)
}

func (a *ReadingModuleAdapter) HandlePlayerLeft(ctx context.Context, hostLeaving bool, leftRoleIDs []string) {
	a.Module.HandlePlayerLeft(ctx, hostLeaving, leftRoleIDs)
}

func (a *ReadingModuleAdapter) HandlePlayerRejoined(ctx context.Context, hostRejoining bool, rejoinedRoleIDs []string) {
	a.Module.HandlePlayerRejoined(ctx, hostRejoining, rejoinedRoleIDs)
}

func (a *ReadingModuleAdapter) GetReadingStateSnapshot() ws.ReadingStateSnapshot {
	wire := a.Module.GetReadingStateWire()
	return ws.ReadingStateSnapshot{
		SectionID:    wire.SectionID,
		CurrentIndex: wire.CurrentIndex,
		Status:       wire.Status,
		BgmMediaID:   wire.BgmMediaID,
		Lines:        convertLinesToCamelCase(wire.Lines),
	}
}
