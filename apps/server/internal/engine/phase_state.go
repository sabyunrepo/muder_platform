package engine

import (
	"context"
	"encoding/json"
	"fmt"
	"sort"

	"github.com/google/uuid"
)

// BuildState returns the full engine state with every module's all-player
// output combined into a single envelope.
//
// SECURITY — internal/persistence only. This method invokes Module.BuildState
// directly, bypassing the PR-2a PlayerAware gate. The resulting payload may
// contain role-private data for EVERY player (e.g. hidden missions, per-player
// clue draws, whispered messages) and MUST NEVER be broadcast to clients.
//
// Runtime broadcasts and reconnect envelopes MUST flow through BuildStateFor
// below. The only legitimate callers are:
//   - SaveState for session persistence (mirrored by RestoreState).
//   - Admin / fixture / debug tooling that explicitly surfaces the
//     all-player view.
//
// Adding a new caller that hands this payload to a WebSocket, HTTP handler,
// or user-visible log is a per-player data leakage hazard and requires a
// security review before merging.
func (e *PhaseEngine) BuildState() (json.RawMessage, error) {
	state := map[string]any{
		"sessionId": e.sessionID,
		"phase":     e.CurrentPhase(),
	}

	moduleStates := make(map[string]json.RawMessage, len(e.modules))
	for _, mod := range e.modules {
		ms, err := mod.BuildState()
		if err != nil {
			return nil, fmt.Errorf("engine: module %q state failed: %w", mod.Name(), err)
		}
		moduleStates[mod.Name()] = ms
	}
	state["modules"] = moduleStates

	return json.Marshal(state)
}

// BuildStateFor returns the engine state with player-aware module redaction
// applied. Envelope structure is identical to BuildState — only the per-module
// state maps differ based on the caller's identity. Used on reconnect so that
// role-private data never reaches the wrong client. (Phase 18.1 B-2)
func (e *PhaseEngine) BuildStateFor(playerID uuid.UUID) (json.RawMessage, error) {
	state := map[string]any{
		"sessionId": e.sessionID,
		"phase":     e.CurrentPhase(),
	}
	if rosterProvider, ok := e.playerInfoProvider.(PlayerRuntimeRosterContextProvider); ok {
		state["players"] = playerRuntimeRosterPayload(rosterProvider.PlayerRuntimeRosterWithContext(context.Background(), e.PlayerDisplayContext()))
	} else if rosterProvider, ok := e.playerInfoProvider.(PlayerRuntimeRosterProvider); ok {
		state["players"] = playerRuntimeRosterPayload(rosterProvider.PlayerRuntimeRoster(context.Background()))
	}

	moduleStates := make(map[string]json.RawMessage, len(e.modules))
	for _, mod := range e.modules {
		ms, err := BuildModuleStateFor(mod, playerID)
		if err != nil {
			return nil, fmt.Errorf("engine: module %q state_for failed: %w", mod.Name(), err)
		}
		moduleStates[mod.Name()] = ms
	}
	state["modules"] = moduleStates

	return json.Marshal(state)
}

func playerRuntimeRosterPayload(players []PlayerRuntimeInfo) []map[string]any {
	if len(players) == 0 {
		return []map[string]any{}
	}
	players = append([]PlayerRuntimeInfo(nil), players...)
	sort.SliceStable(players, func(i, j int) bool {
		if players[i].ConnectedAt != players[j].ConnectedAt {
			return players[i].ConnectedAt < players[j].ConnectedAt
		}
		return players[i].PlayerID.String() < players[j].PlayerID.String()
	})
	payload := make([]map[string]any, 0, len(players))
	for _, player := range players {
		name := player.DisplayName
		if name == "" {
			name = player.Nickname
		}
		row := map[string]any{
			"id":          player.PlayerID.String(),
			"nickname":    player.Nickname,
			"displayName": name,
			"role":        nullableString(player.Role),
			"isAlive":     player.IsAlive,
			"isHost":      player.IsHost,
			"isReady":     player.IsReady,
			"connectedAt": player.ConnectedAt,
		}
		if player.DisplayIconURL != nil {
			row["displayIconUrl"] = *player.DisplayIconURL
		}
		if player.DisplayIconMediaID != nil {
			row["displayIconMediaId"] = *player.DisplayIconMediaID
		}
		payload = append(payload, row)
	}
	return payload
}

func nullableString(value string) any {
	if value == "" {
		return nil
	}
	return value
}
