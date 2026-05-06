package engine

import (
	"encoding/json"
	"sort"
)

type CharacterAliasRule struct {
	ID                 string          `json:"id"`
	Label              string          `json:"label,omitempty"`
	DisplayName        *string         `json:"display_name,omitempty"`
	DisplayIconURL     *string         `json:"display_icon_url,omitempty"`
	DisplayIconMediaID *string         `json:"display_icon_media_id,omitempty"`
	Priority           int32           `json:"priority"`
	Condition          json.RawMessage `json:"condition"`
}

type CharacterDisplayBase struct {
	Name         string
	ImageURL     *string
	ImageMediaID *string
	AliasRules   []CharacterAliasRule
}

type CharacterDisplay struct {
	Name               string
	ImageURL           *string
	ImageMediaID       *string
	AppliedAliasRuleID *string
}

func ParseCharacterAliasRules(raw json.RawMessage) []CharacterAliasRule {
	if len(raw) == 0 || string(raw) == "null" {
		return []CharacterAliasRule{}
	}
	var rules []CharacterAliasRule
	if err := json.Unmarshal(raw, &rules); err != nil {
		return []CharacterAliasRule{}
	}
	return rules
}

func ResolveCharacterDisplay(base CharacterDisplayBase, context json.RawMessage) CharacterDisplay {
	display := CharacterDisplay{Name: base.Name, ImageURL: base.ImageURL, ImageMediaID: base.ImageMediaID}
	if len(base.AliasRules) == 0 || len(context) == 0 || string(context) == "null" {
		return display
	}
	rules := append([]CharacterAliasRule(nil), base.AliasRules...)
	sort.SliceStable(rules, func(i, j int) bool {
		return rules[i].Priority > rules[j].Priority
	})
	for _, rule := range rules {
		result, err := EvaluateConditionGroup(rule.Condition, context)
		if err != nil || !result.Bool {
			continue
		}
		if rule.DisplayName != nil {
			display.Name = *rule.DisplayName
		}
		if rule.DisplayIconURL != nil {
			display.ImageURL = rule.DisplayIconURL
			display.ImageMediaID = nil
		}
		if rule.DisplayIconMediaID != nil {
			display.ImageMediaID = rule.DisplayIconMediaID
			display.ImageURL = nil
		}
		ruleID := rule.ID
		display.AppliedAliasRuleID = &ruleID
		return display
	}
	return display
}
