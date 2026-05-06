package engine

import (
	"encoding/json"
	"testing"
)

func strPtr(value string) *string {
	return &value
}

func TestParseCharacterAliasRules(t *testing.T) {
	rules := ParseCharacterAliasRules(json.RawMessage(`[
		{"id":"alias-1","display_name":"목격자","priority":2,"condition":{"id":"group-1","operator":"AND","rules":[]}}
	]`))

	if len(rules) != 1 || rules[0].ID != "alias-1" || rules[0].DisplayName == nil || *rules[0].DisplayName != "목격자" {
		t.Fatalf("ParseCharacterAliasRules() = %+v", rules)
	}

	for _, raw := range []json.RawMessage{nil, json.RawMessage(`null`), json.RawMessage(`{`)} {
		if got := ParseCharacterAliasRules(raw); len(got) != 0 {
			t.Fatalf("ParseCharacterAliasRules(%s) len = %d, want 0", string(raw), len(got))
		}
	}
}

func TestResolveCharacterDisplay_AppliesHighestPriorityMatchingRule(t *testing.T) {
	baseIcon := "https://cdn.example/base.webp"
	baseMediaID := "00000000-0000-4000-8000-000000000001"
	lowName := "낮은 우선순위"
	highIcon := "https://cdn.example/high.webp"
	highName := "밤의 목격자"

	display := ResolveCharacterDisplay(CharacterDisplayBase{
		Name:         "홍길동",
		ImageURL:     &baseIcon,
		ImageMediaID: &baseMediaID,
		AliasRules: []CharacterAliasRule{
			{
				ID:          "low",
				DisplayName: &lowName,
				Priority:    1,
				Condition:   matchingAliasCondition(),
			},
			{
				ID:             "high",
				DisplayName:    &highName,
				DisplayIconURL: &highIcon,
				Priority:       3,
				Condition:      matchingAliasCondition(),
			},
		},
	}, json.RawMessage(`{"flags":{"alias_ready":true}}`))

	if display.Name != highName || display.ImageURL == nil || *display.ImageURL != highIcon {
		t.Fatalf("ResolveCharacterDisplay() = %+v", display)
	}
	if display.AppliedAliasRuleID == nil || *display.AppliedAliasRuleID != "high" {
		t.Fatalf("AppliedAliasRuleID = %v, want high", display.AppliedAliasRuleID)
	}
	if display.ImageMediaID != nil {
		t.Fatalf("ImageMediaID = %v, want nil when URL alias is applied", display.ImageMediaID)
	}
}

func TestResolveCharacterDisplay_AppliesAliasIconMediaID(t *testing.T) {
	baseIcon := "https://cdn.example/base.webp"
	baseMediaID := "00000000-0000-4000-8000-000000000001"
	aliasMediaID := "00000000-0000-4000-8000-000000000002"

	display := ResolveCharacterDisplay(CharacterDisplayBase{
		Name:         "홍길동",
		ImageURL:     &baseIcon,
		ImageMediaID: &baseMediaID,
		AliasRules: []CharacterAliasRule{{
			ID:                 "media",
			DisplayIconMediaID: &aliasMediaID,
			Priority:           1,
			Condition:          matchingAliasCondition(),
		}},
	}, json.RawMessage(`{"flags":{"alias_ready":true}}`))

	if display.ImageURL != nil {
		t.Fatalf("ImageURL = %v, want nil when media alias is applied", display.ImageURL)
	}
	if display.ImageMediaID == nil || *display.ImageMediaID != aliasMediaID {
		t.Fatalf("ImageMediaID = %v, want %s", display.ImageMediaID, aliasMediaID)
	}
}

func TestResolveCharacterDisplay_FallsBackWhenConditionMissesOrContextMissing(t *testing.T) {
	baseMediaID := "00000000-0000-4000-8000-000000000001"
	base := CharacterDisplayBase{
		Name:         "홍길동",
		ImageURL:     strPtr("https://cdn.example/base.webp"),
		ImageMediaID: &baseMediaID,
		AliasRules: []CharacterAliasRule{{
			ID:          "alias-1",
			DisplayName: strPtr("목격자"),
			Priority:    1,
			Condition:   matchingAliasCondition(),
		}},
	}

	for _, context := range []json.RawMessage{
		nil,
		json.RawMessage(`null`),
		json.RawMessage(`{"flags":{"alias_ready":false}}`),
	} {
		display := ResolveCharacterDisplay(base, context)
		if display.Name != base.Name || display.ImageURL != base.ImageURL || display.ImageMediaID != base.ImageMediaID || display.AppliedAliasRuleID != nil {
			t.Fatalf("ResolveCharacterDisplay(%s) = %+v, want base display", string(context), display)
		}
	}
}

func matchingAliasCondition() json.RawMessage {
	return json.RawMessage(`{
		"id":"group-1",
		"operator":"AND",
		"rules":[{
			"id":"rule-1",
			"variable":"custom_flag",
			"target_flag_key":"alias_ready",
			"comparator":"=",
			"value":"true"
		}]
	}`)
}
