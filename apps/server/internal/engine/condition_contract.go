package engine

import (
	"encoding/json"
	"fmt"
	"strings"
)

const (
	ConditionSchemaVersion = 1
	MaxConditionDepth      = 3
)

type ConditionGroup struct {
	ID       string          `json:"id"`
	Operator string          `json:"operator"`
	Rules    []ConditionNode `json:"rules"`
}

type ConditionNode struct {
	Group *ConditionGroup
	Rule  *ConditionRule
}

type ConditionRule struct {
	ID                string `json:"id"`
	Variable          string `json:"variable"`
	TargetCharacterID string `json:"target_character_id,omitempty"`
	TargetMissionID   string `json:"target_mission_id,omitempty"`
	TargetClueID      string `json:"target_clue_id,omitempty"`
	TargetTriggerID   string `json:"target_trigger_id,omitempty"`
	TargetTokenID     string `json:"target_token_id,omitempty"`
	TargetSceneID     string `json:"target_scene_id,omitempty"`
	TargetRoomID      string `json:"target_room_id,omitempty"`
	TargetLocationID  string `json:"target_location_id,omitempty"`
	TargetFlagKey     string `json:"target_flag_key,omitempty"`
	Comparator        string `json:"comparator"`
	Value             string `json:"value"`
}

func (n *ConditionNode) UnmarshalJSON(data []byte) error {
	var probe map[string]json.RawMessage
	if err := json.Unmarshal(data, &probe); err != nil {
		return err
	}
	if _, ok := probe["operator"]; ok {
		var group ConditionGroup
		if err := json.Unmarshal(data, &group); err != nil {
			return err
		}
		n.Group = &group
		return nil
	}
	var rule ConditionRule
	if err := json.Unmarshal(data, &rule); err != nil {
		return err
	}
	n.Rule = &rule
	return nil
}

func (n ConditionNode) MarshalJSON() ([]byte, error) {
	switch {
	case n.Group != nil:
		return json.Marshal(n.Group)
	case n.Rule != nil:
		return json.Marshal(n.Rule)
	default:
		return []byte("null"), nil
	}
}

func ParseConditionGroup(raw json.RawMessage) (ConditionGroup, error) {
	if len(raw) == 0 || string(raw) == "null" {
		return ConditionGroup{}, fmt.Errorf("condition: group is required")
	}
	var group ConditionGroup
	if err := json.Unmarshal(raw, &group); err != nil {
		return ConditionGroup{}, fmt.Errorf("condition: invalid group JSON: %w", err)
	}
	if err := ValidateConditionGroup(group); err != nil {
		return ConditionGroup{}, err
	}
	return group, nil
}

func ValidateConditionGroup(group ConditionGroup) error {
	return validateConditionGroup(group, 0)
}

func EvaluateConditionGroup(raw json.RawMessage, context json.RawMessage) (EvalResult, error) {
	group, err := ParseConditionGroup(raw)
	if err != nil {
		return EvalResult{}, err
	}
	logic, err := ConditionGroupToJSONLogic(group)
	if err != nil {
		return EvalResult{}, err
	}
	evaluator := NewRuleEvaluator()
	evaluator.SetContextRaw(context)
	return evaluator.Evaluate(logic)
}

func ConditionGroupToJSONLogic(group ConditionGroup) (json.RawMessage, error) {
	logic, err := conditionGroupLogic(group)
	if err != nil {
		return nil, err
	}
	return json.Marshal(logic)
}

func validateConditionGroup(group ConditionGroup, depth int) error {
	if depth > MaxConditionDepth {
		return fmt.Errorf("condition: max depth %d exceeded", MaxConditionDepth)
	}
	if group.ID == "" {
		return fmt.Errorf("condition: group id is required")
	}
	if group.Operator != "AND" && group.Operator != "OR" {
		return fmt.Errorf("condition: group %q has unsupported operator %q", group.ID, group.Operator)
	}
	if len(group.Rules) == 0 {
		return fmt.Errorf("condition: group %q requires at least one rule", group.ID)
	}
	for _, node := range group.Rules {
		switch {
		case node.Group != nil:
			if err := validateConditionGroup(*node.Group, depth+1); err != nil {
				return err
			}
		case node.Rule != nil:
			if err := validateConditionRule(*node.Rule); err != nil {
				return err
			}
		default:
			return fmt.Errorf("condition: group %q contains empty node", group.ID)
		}
	}
	return nil
}

func validateConditionRule(rule ConditionRule) error {
	if rule.ID == "" {
		return fmt.Errorf("condition: rule id is required")
	}
	if _, ok := conditionVariablePaths[rule.Variable]; !ok {
		return fmt.Errorf("condition: rule %q has unsupported variable %q", rule.ID, rule.Variable)
	}
	if _, ok := conditionComparators[rule.Comparator]; !ok {
		return fmt.Errorf("condition: rule %q has unsupported comparator %q", rule.ID, rule.Comparator)
	}
	if targetValue(rule) == "" {
		return fmt.Errorf("condition: rule %q requires target for %q", rule.ID, rule.Variable)
	}
	return nil
}

func conditionGroupLogic(group ConditionGroup) (any, error) {
	nodes := make([]any, 0, len(group.Rules))
	for _, node := range group.Rules {
		if node.Group != nil {
			child, err := conditionGroupLogic(*node.Group)
			if err != nil {
				return nil, err
			}
			nodes = append(nodes, child)
			continue
		}
		if node.Rule == nil {
			return nil, fmt.Errorf("condition: group %q contains empty node", group.ID)
		}
		rule, err := conditionRuleLogic(*node.Rule)
		if err != nil {
			return nil, err
		}
		nodes = append(nodes, rule)
	}
	if len(nodes) == 0 {
		return true, nil
	}
	key := strings.ToLower(group.Operator)
	return map[string]any{key: nodes}, nil
}

func conditionRuleLogic(rule ConditionRule) (any, error) {
	pathBuilder, ok := conditionVariablePaths[rule.Variable]
	if !ok {
		return nil, fmt.Errorf("condition: rule %q has unsupported variable %q", rule.ID, rule.Variable)
	}
	comparator, ok := conditionComparators[rule.Comparator]
	if !ok {
		return nil, fmt.Errorf("condition: rule %q has unsupported comparator %q", rule.ID, rule.Comparator)
	}
	path := pathBuilder(rule)
	if path == "" {
		return nil, fmt.Errorf("condition: rule %q requires target for %q", rule.ID, rule.Variable)
	}
	return map[string]any{comparator: []any{
		map[string]any{"var": path},
		coerceConditionValue(rule.Value),
	}}, nil
}

func targetValue(rule ConditionRule) string {
	switch rule.Variable {
	case "mission_status":
		return allTargets(rule.TargetCharacterID, rule.TargetMissionID)
	case "character_alive":
		return rule.TargetCharacterID
	case "vote_target":
		return "vote_target"
	case "clue_held":
		return allTargets(rule.TargetCharacterID, rule.TargetClueID)
	case "trigger_count":
		return rule.TargetTriggerID
	case "investigation_token":
		return allTargets(rule.TargetCharacterID, rule.TargetTokenID)
	case "scene_visit_count":
		return rule.TargetSceneID
	case "room_state":
		return rule.TargetRoomID
	case "location_state":
		return rule.TargetLocationID
	case "custom_flag":
		return rule.TargetFlagKey
	default:
		return ""
	}
}

func allTargets(values ...string) string {
	for _, value := range values {
		if value == "" {
			return ""
		}
	}
	return "ok"
}

func coerceConditionValue(value string) any {
	switch value {
	case "true":
		return true
	case "false":
		return false
	}
	var number json.Number
	if err := json.Unmarshal([]byte(value), &number); err == nil {
		return number
	}
	return value
}

var conditionComparators = map[string]string{
	"=":  "==",
	"!=": "!=",
	">":  ">",
	"<":  "<",
	">=": ">=",
	"<=": "<=",
}

var conditionVariablePaths = map[string]func(ConditionRule) string{
	"mission_status": func(rule ConditionRule) string {
		return joinConditionPath("missions", rule.TargetCharacterID, rule.TargetMissionID, "status")
	},
	"character_alive": func(rule ConditionRule) string {
		return joinConditionPath("characters", rule.TargetCharacterID, "alive")
	},
	"vote_target": func(ConditionRule) string {
		return "votes.target"
	},
	"clue_held": func(rule ConditionRule) string {
		return joinConditionPath("clues.heldByCharacter", rule.TargetCharacterID, rule.TargetClueID)
	},
	"trigger_count": func(rule ConditionRule) string {
		return joinConditionPath("triggers", rule.TargetTriggerID, "count")
	},
	"investigation_token": func(rule ConditionRule) string {
		return joinConditionPath("tokens.byCharacter", rule.TargetCharacterID, rule.TargetTokenID)
	},
	"scene_visit_count": func(rule ConditionRule) string {
		return joinConditionPath("scenes", rule.TargetSceneID, "visitCount")
	},
	"room_state": func(rule ConditionRule) string {
		return joinConditionPath("rooms", rule.TargetRoomID, "state")
	},
	"location_state": func(rule ConditionRule) string {
		return joinConditionPath("locations", rule.TargetLocationID, "state")
	},
	"custom_flag": func(rule ConditionRule) string {
		return joinConditionPath("flags", rule.TargetFlagKey)
	},
}

func joinConditionPath(parts ...string) string {
	clean := make([]string, 0, len(parts))
	for _, part := range parts {
		if part == "" {
			return ""
		}
		clean = append(clean, part)
	}
	return strings.Join(clean, ".")
}
