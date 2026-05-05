package editor

import (
	"encoding/json"
	"fmt"
	"strings"

	"github.com/google/uuid"
)

func mediaReferenceParams(refs []mediaReferenceInfo) []map[string]string {
	out := make([]map[string]string, 0, len(refs))
	for _, ref := range refs {
		out = append(out, map[string]string{
			"type": ref.Type,
			"id":   ref.ID,
			"name": ref.Name,
		})
	}
	return out
}

func findMediaReferencesInThemeConfig(raw json.RawMessage, mediaID uuid.UUID) []mediaReferenceInfo {
	if len(raw) == 0 || string(raw) == "null" {
		return nil
	}
	var cfg struct {
		Phases  json.RawMessage         `json:"phases"`
		Modules map[string]configModule `json:"modules"`
	}
	if err := json.Unmarshal(raw, &cfg); err != nil {
		return nil
	}

	mediaIDText := mediaID.String()
	refs := []mediaReferenceInfo{}
	for _, phase := range parseConfigMediaPhases(cfg.Phases) {
		phaseID := phase.ID
		if phaseID == "" {
			phaseID = phase.Name
		}
		if phaseID == "" {
			phaseID = "phase"
		}
		refs = append(refs, findMediaReferencesInActionConfig(
			phase.OnEnter,
			mediaIDText,
			"phase_action",
			phaseID+":onEnter",
			fmt.Sprintf("%s 시작 트리거에서 %s으로 사용 중", phaseDisplayName(phase), mediaActionPurpose(phase.OnEnter, mediaIDText)),
		)...)
		refs = append(refs, findMediaReferencesInActionConfig(
			phase.OnExit,
			mediaIDText,
			"phase_action",
			phaseID+":onExit",
			fmt.Sprintf("%s 종료 트리거에서 %s으로 사용 중", phaseDisplayName(phase), mediaActionPurpose(phase.OnExit, mediaIDText)),
		)...)
	}

	eventModule, ok := cfg.Modules["event_progression"]
	if !ok || len(eventModule.Config) == 0 {
		return refs
	}
	var eventCfg struct {
		Triggers []configMediaTrigger `json:"Triggers"`
	}
	if err := json.Unmarshal(eventModule.Config, &eventCfg); err != nil {
		return refs
	}
	for _, trigger := range eventCfg.Triggers {
		triggerID := trigger.ID
		if triggerID == "" {
			triggerID = "trigger"
		}
		refs = append(refs, findMediaReferencesInActionConfig(
			trigger.Actions,
			mediaIDText,
			"event_progression_trigger_action",
			triggerID,
			fmt.Sprintf("%s 실행 결과에서 %s으로 사용 중", triggerDisplayName(trigger), mediaActionPurpose(trigger.Actions, mediaIDText)),
		)...)
	}
	return refs
}

func parseConfigMediaPhases(raw json.RawMessage) []configMediaPhase {
	if len(raw) == 0 || string(raw) == "null" {
		return nil
	}
	var phases []configMediaPhase
	if err := json.Unmarshal(raw, &phases); err != nil {
		return nil
	}
	return phases
}

type configModule struct {
	Config json.RawMessage `json:"config"`
}

type configMediaPhase struct {
	ID      string          `json:"id"`
	Name    string          `json:"name"`
	OnEnter json.RawMessage `json:"onEnter"`
	OnExit  json.RawMessage `json:"onExit"`
}

type configMediaTrigger struct {
	ID      string          `json:"id"`
	Label   string          `json:"label"`
	Actions json.RawMessage `json:"actions"`
}

type configMediaAction struct {
	ID     string          `json:"id"`
	Type   string          `json:"type"`
	Action string          `json:"action"`
	Params json.RawMessage `json:"params"`
}

func findMediaReferencesInActionConfig(raw json.RawMessage, mediaID string, refType string, ownerID string, label string) []mediaReferenceInfo {
	actions := parseConfigMediaActions(raw)
	if len(actions) == 0 {
		return nil
	}
	refs := []mediaReferenceInfo{}
	for i, action := range actions {
		if actionMediaID(action) != mediaID {
			continue
		}
		refID := ownerID
		if action.ID != "" {
			refID += ":" + action.ID
		} else {
			refID += fmt.Sprintf(":%d", i)
		}
		refs = append(refs, mediaReferenceInfo{
			Type: refType,
			ID:   refID,
			Name: label,
		})
	}
	return refs
}

func parseConfigMediaActions(raw json.RawMessage) []configMediaAction {
	if len(raw) == 0 || string(raw) == "null" {
		return nil
	}
	var direct []configMediaAction
	if err := json.Unmarshal(raw, &direct); err == nil {
		return direct
	}
	var wrapped struct {
		Actions []configMediaAction `json:"actions"`
	}
	if err := json.Unmarshal(raw, &wrapped); err == nil {
		return wrapped.Actions
	}
	return nil
}

func actionMediaID(action configMediaAction) string {
	if len(action.Params) == 0 || string(action.Params) == "null" {
		return ""
	}
	var params struct {
		MediaID string `json:"mediaId"`
	}
	if err := json.Unmarshal(action.Params, &params); err != nil {
		return ""
	}
	return params.MediaID
}

func phaseDisplayName(phase configMediaPhase) string {
	if phase.Name != "" {
		return phase.Name
	}
	if phase.ID != "" {
		return phase.ID
	}
	return "단계"
}

func triggerDisplayName(trigger configMediaTrigger) string {
	if trigger.Label != "" {
		return trigger.Label
	}
	if trigger.ID != "" {
		return trigger.ID
	}
	return "트리거"
}

func mediaActionPurpose(raw json.RawMessage, mediaID string) string {
	for _, action := range parseConfigMediaActions(raw) {
		if actionMediaID(action) == mediaID {
			return mediaActionLabel(action)
		}
	}
	return "미디어"
}

func mediaActionLabel(action configMediaAction) string {
	actionType := strings.ToUpper(strings.TrimSpace(action.Action))
	if actionType == "" {
		actionType = strings.ToUpper(strings.TrimSpace(action.Type))
	}
	switch actionType {
	case "SET_BACKGROUND":
		return "배경 이미지"
	case "SET_BGM", "PLAY_BGM":
		return "BGM"
	case "PLAY_SOUND", "SET_SFX":
		return "효과음"
	case "PLAY_MEDIA", "SET_VIDEO":
		return "영상"
	default:
		return "미디어"
	}
}
