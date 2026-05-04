package engine

import (
	"encoding/json"
	"strings"
	"testing"
)

func TestConditionGroupToJSONLogic_EvaluatesSharedMMPShape(t *testing.T) {
	raw := json.RawMessage(`{
		"id":"group-1",
		"operator":"AND",
		"rules":[
			{"id":"rule-1","variable":"clue_held","target_character_id":"character-1","target_clue_id":"clue-1","comparator":"=","value":"true"},
			{"id":"rule-2","variable":"investigation_token","target_character_id":"character-1","target_token_id":"basic-token","comparator":">=","value":"2"},
			{"id":"group-2","operator":"OR","rules":[
				{"id":"rule-3","variable":"scene_visit_count","target_scene_id":"scene-1","comparator":">","value":"0"},
				{"id":"rule-4","variable":"custom_flag","target_flag_key":"manual_override","comparator":"=","value":"true"}
			]}
		]
	}`)

	result, err := EvaluateConditionGroup(raw, json.RawMessage(`{
		"clues":{"heldByCharacter":{"character-1":{"clue-1":true}}},
		"tokens":{"byCharacter":{"character-1":{"basic-token":2}}},
		"scenes":{"scene-1":{"visitCount":1}},
		"flags":{"manual_override":false}
	}`))
	if err != nil {
		t.Fatalf("EvaluateConditionGroup: %v", err)
	}
	if !result.Bool {
		t.Fatalf("condition should evaluate true, raw=%s", result.Value)
	}
}

func TestParseConditionGroup_RejectsInvalidContract(t *testing.T) {
	tests := []struct {
		name string
		raw  string
	}{
		{
			name: "unknown variable",
			raw:  `{"id":"g1","operator":"AND","rules":[{"id":"r1","variable":"raw_engine_key","comparator":"=","value":"x"}]}`,
		},
		{
			name: "missing token target",
			raw:  `{"id":"g1","operator":"AND","rules":[{"id":"r1","variable":"investigation_token","target_character_id":"c1","comparator":">","value":"0"}]}`,
		},
		{
			name: "too deep",
			raw:  `{"id":"g0","operator":"AND","rules":[{"id":"g1","operator":"AND","rules":[{"id":"g2","operator":"AND","rules":[{"id":"g3","operator":"AND","rules":[{"id":"g4","operator":"AND","rules":[]}]}]}]}]}`,
		},
		{
			name: "empty group",
			raw:  `{"id":"g1","operator":"OR","rules":[]}`,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if _, err := ParseConditionGroup(json.RawMessage(tt.raw)); err == nil {
				t.Fatal("expected validation error")
			}
		})
	}
}

func TestConditionNode_MarshalPreservesSharedShape(t *testing.T) {
	raw := json.RawMessage(`{
		"id":"group-1",
		"operator":"AND",
		"rules":[
			{"id":"rule-1","variable":"custom_flag","target_flag_key":"manual_override","comparator":"=","value":"true"}
		]
	}`)
	group, err := ParseConditionGroup(raw)
	if err != nil {
		t.Fatalf("ParseConditionGroup: %v", err)
	}
	encoded, err := json.Marshal(group)
	if err != nil {
		t.Fatalf("Marshal group: %v", err)
	}
	var decoded map[string]any
	if err := json.Unmarshal(encoded, &decoded); err != nil {
		t.Fatalf("Decode marshalled group: %v", err)
	}
	rules := decoded["rules"].([]any)
	rule := rules[0].(map[string]any)
	if _, leaked := rule["Rule"]; leaked {
		t.Fatalf("marshalled condition leaked Go wrapper shape: %s", encoded)
	}
	if rule["variable"] != "custom_flag" {
		t.Fatalf("marshalled rule lost shared condition shape: %s", encoded)
	}
}

func TestConditionGroupToJSONLogic_UsesCanonicalContextPaths(t *testing.T) {
	group, err := ParseConditionGroup(json.RawMessage(`{
		"id":"group-1",
		"operator":"OR",
		"rules":[
			{"id":"rule-1","variable":"trigger_count","target_trigger_id":"trigger-1","comparator":">=","value":"1"},
			{"id":"rule-2","variable":"room_state","target_room_id":"room-1","comparator":"=","value":"open"},
			{"id":"rule-3","variable":"location_state","target_location_id":"location-1","comparator":"!=","value":"locked"}
		]
	}`))
	if err != nil {
		t.Fatalf("ParseConditionGroup: %v", err)
	}

	logic, err := ConditionGroupToJSONLogic(group)
	if err != nil {
		t.Fatalf("ConditionGroupToJSONLogic: %v", err)
	}
	if !IsValid(logic) {
		t.Fatalf("generated JSONLogic must be valid: %s", logic)
	}
	for _, path := range []string{
		"triggers.trigger-1.count",
		"rooms.room-1.state",
		"locations.location-1.state",
	} {
		if !strings.Contains(string(logic), path) {
			t.Fatalf("generated JSONLogic missing canonical path %q: %s", path, logic)
		}
	}

	evaluator := NewRuleEvaluator()
	evaluator.SetContextRaw(json.RawMessage(`{
		"triggers":{"trigger-1":{"count":0}},
		"rooms":{"room-1":{"state":"closed"}},
		"locations":{"location-1":{"state":"open"}}
	}`))
	result, err := evaluator.Evaluate(logic)
	if err != nil {
		t.Fatalf("Evaluate generated logic: %v", err)
	}
	if !result.Bool {
		t.Fatalf("OR condition should evaluate true via location state, raw=%s", result.Value)
	}
}
