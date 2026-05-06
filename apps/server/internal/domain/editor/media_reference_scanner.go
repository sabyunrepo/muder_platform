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

func findMediaReferencesInThemeConfig(raw json.RawMessage, mediaID uuid.UUID) ([]mediaReferenceInfo, error) {
	if len(raw) == 0 || string(raw) == "null" {
		return nil, nil
	}
	var cfg struct {
		Phases  json.RawMessage         `json:"phases"`
		Modules map[string]configModule `json:"modules"`
	}
	if err := json.Unmarshal(raw, &cfg); err != nil {
		return nil, fmt.Errorf("parse theme config: %w", err)
	}

	mediaIDText := mediaID.String()
	refs := []mediaReferenceInfo{}
	phases, err := parseConfigMediaPhases(cfg.Phases)
	if err != nil {
		return nil, fmt.Errorf("parse theme config phases: %w", err)
	}
	for _, phase := range phases {
		phaseID := phase.ID
		if phaseID == "" {
			phaseID = phase.Name
		}
		if phaseID == "" {
			phaseID = "phase"
		}
		phaseRefs, err := findMediaReferencesInActionConfig(
			phase.OnEnter,
			mediaIDText,
			"phase_action",
			phaseID+":onEnter",
			fmt.Sprintf("%s 시작 트리거", phaseDisplayName(phase)),
		)
		if err != nil {
			return nil, fmt.Errorf("parse phase %q onEnter media actions: %w", phaseID, err)
		}
		refs = append(refs, phaseRefs...)
		phaseRefs, err = findMediaReferencesInActionConfig(
			phase.OnExit,
			mediaIDText,
			"phase_action",
			phaseID+":onExit",
			fmt.Sprintf("%s 종료 트리거", phaseDisplayName(phase)),
		)
		if err != nil {
			return nil, fmt.Errorf("parse phase %q onExit media actions: %w", phaseID, err)
		}
		refs = append(refs, phaseRefs...)
	}

	eventModule, ok := cfg.Modules["event_progression"]
	if !ok || len(eventModule.Config) == 0 {
		return refs, nil
	}
	var eventCfg struct {
		Triggers []configMediaTrigger `json:"Triggers"`
	}
	if err := json.Unmarshal(eventModule.Config, &eventCfg); err != nil {
		return nil, fmt.Errorf("parse event_progression config: %w", err)
	}
	for _, trigger := range eventCfg.Triggers {
		triggerID := trigger.ID
		if triggerID == "" {
			triggerID = "trigger"
		}
		triggerRefs, err := findMediaReferencesInActionConfig(
			trigger.Actions,
			mediaIDText,
			"event_progression_trigger_action",
			triggerID,
			fmt.Sprintf("%s 실행 결과", triggerDisplayName(trigger)),
		)
		if err != nil {
			return nil, fmt.Errorf("parse event_progression trigger %q media actions: %w", triggerID, err)
		}
		refs = append(refs, triggerRefs...)
	}
	return refs, nil
}

func clearMediaReferencesInThemeConfig(raw json.RawMessage, mediaID uuid.UUID) (json.RawMessage, bool, error) {
	if len(raw) == 0 || string(raw) == "null" {
		return raw, false, nil
	}
	var cfg map[string]any
	if err := json.Unmarshal(raw, &cfg); err != nil {
		return nil, false, fmt.Errorf("parse theme config: %w", err)
	}
	changed := false
	mediaIDText := mediaID.String()
	if phases, ok := cfg["phases"].([]any); ok {
		for _, phaseAny := range phases {
			phase, ok := phaseAny.(map[string]any)
			if !ok {
				continue
			}
			if clearMediaReferencesInActionNode(phase["onEnter"], mediaIDText) {
				changed = true
			}
			if clearMediaReferencesInActionNode(phase["onExit"], mediaIDText) {
				changed = true
			}
		}
	}
	modules, _ := cfg["modules"].(map[string]any)
	eventModule, _ := modules["event_progression"].(map[string]any)
	eventConfig, _ := eventModule["config"].(map[string]any)
	if triggers, ok := eventConfig["Triggers"].([]any); ok {
		for _, triggerAny := range triggers {
			trigger, ok := triggerAny.(map[string]any)
			if !ok {
				continue
			}
			if clearMediaReferencesInActionNode(trigger["actions"], mediaIDText) {
				changed = true
			}
		}
	}
	if !changed {
		return raw, false, nil
	}
	out, err := json.Marshal(cfg)
	if err != nil {
		return nil, false, fmt.Errorf("marshal theme config: %w", err)
	}
	return out, true, nil
}

func clearMediaReferencesInActionNode(node any, mediaID string) bool {
	changed := false
	switch v := node.(type) {
	case []any:
		for _, item := range v {
			action, ok := item.(map[string]any)
			if !ok {
				continue
			}
			if clearMediaReferenceInAction(action, mediaID) {
				changed = true
			}
		}
	case map[string]any:
		if actions, ok := v["actions"]; ok {
			if clearMediaReferencesInActionNode(actions, mediaID) {
				changed = true
			}
		} else if clearMediaReferenceInAction(v, mediaID) {
			changed = true
		}
	}
	return changed
}

func clearMediaReferenceInAction(action map[string]any, mediaID string) bool {
	params, ok := action["params"].(map[string]any)
	if !ok {
		return false
	}
	if current, ok := params["mediaId"].(string); ok && current == mediaID {
		delete(params, "mediaId")
		return true
	}
	return false
}

func parseConfigMediaPhases(raw json.RawMessage) ([]configMediaPhase, error) {
	if len(raw) == 0 || string(raw) == "null" {
		return nil, nil
	}
	var phases []configMediaPhase
	if err := json.Unmarshal(raw, &phases); err != nil {
		return nil, err
	}
	return phases, nil
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

func findMediaReferencesInActionConfig(raw json.RawMessage, mediaID string, refType string, ownerID string, ownerLabel string) ([]mediaReferenceInfo, error) {
	actions, err := parseConfigMediaActions(raw)
	if err != nil {
		return nil, err
	}
	if len(actions) == 0 {
		return nil, nil
	}
	refs := []mediaReferenceInfo{}
	for i, action := range actions {
		actionID, err := actionMediaID(action)
		if err != nil {
			return nil, fmt.Errorf("parse action %d params: %w", i, err)
		}
		if actionID != mediaID {
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
			Name: fmt.Sprintf("%s에서 %s으로 사용 중", ownerLabel, mediaActionLabel(action)),
		})
	}
	return refs, nil
}

func parseConfigMediaActions(raw json.RawMessage) ([]configMediaAction, error) {
	if len(raw) == 0 || string(raw) == "null" {
		return nil, nil
	}
	var direct []configMediaAction
	if err := json.Unmarshal(raw, &direct); err == nil {
		return direct, nil
	}
	var wrapped struct {
		Actions []configMediaAction `json:"actions"`
	}
	if err := json.Unmarshal(raw, &wrapped); err == nil {
		return wrapped.Actions, nil
	}
	return nil, fmt.Errorf("parse media actions")
}

func actionMediaID(action configMediaAction) (string, error) {
	if len(action.Params) == 0 || string(action.Params) == "null" {
		return "", nil
	}
	var params struct {
		MediaID string `json:"mediaId"`
	}
	if err := json.Unmarshal(action.Params, &params); err != nil {
		return "", err
	}
	return params.MediaID, nil
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
