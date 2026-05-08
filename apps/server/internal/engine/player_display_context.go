package engine

import (
	"encoding/json"
	"strings"
)

// PlayerDisplayContext is the backend-owned condition context for character
// alias presets. It keeps creator-authored "from round/node" presets tied to
// actual engine progress instead of frontend-only labels.
func (e *PhaseEngine) PlayerDisplayContext() json.RawMessage {
	phase := e.CurrentPhase()
	if phase == nil {
		return json.RawMessage(`{"flags":{}}`)
	}
	firstIntro, lastIntro := e.introPhaseBounds()
	introStarted := firstIntro >= 0 && e.current >= firstIntro
	introFinished := lastIntro >= 0 && e.current > lastIntro

	scenes := make(map[string]map[string]any, len(e.sceneVisitCounts))
	for id, count := range e.sceneVisitCounts {
		scenes[id] = map[string]any{"visitCount": count, "reached": count > 0}
	}

	payload := map[string]any{
		"phase": phase.ID,
		"round": e.currentRound,
		"flags": map[string]any{
			"game_started":       e.started && !e.stopped,
			"intro_started":      introStarted,
			"intro_finished":     introFinished,
			"round_started":      e.currentRound,
			"story_node_reached": phase.ID,
		},
		"scenes": scenes,
	}
	data, _ := json.Marshal(payload)
	return data
}

func (e *PhaseEngine) introPhaseBounds() (int, int) {
	first, last := -1, -1
	for idx, phase := range e.phases {
		if isIntroPhase(phase) {
			if first == -1 {
				first = idx
			}
			last = idx
		}
	}
	return first, last
}

func isIntroPhase(phase PhaseDefinition) bool {
	id := strings.ToLower(string(phase.ID))
	name := strings.ToLower(phase.Name)
	return strings.Contains(id, "intro") ||
		strings.Contains(id, "introduction") ||
		strings.Contains(name, "intro") ||
		strings.Contains(name, "introduction") ||
		strings.Contains(name, "자기소개")
}
