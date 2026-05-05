package editor

import (
	"encoding/json"
	"fmt"
	"net/url"
	"strings"

	"github.com/mmp-platform/server/internal/apperror"
	"github.com/mmp-platform/server/internal/engine"
)

const MaxCharacterAliasRules = 8

func normalizeCharacterAliasRules(rules []CharacterAliasRule) ([]CharacterAliasRule, error) {
	if rules == nil {
		return nil, nil
	}
	if len(rules) > MaxCharacterAliasRules {
		return nil, apperror.BadRequest(fmt.Sprintf("alias_rules supports at most %d rules", MaxCharacterAliasRules))
	}
	normalized := make([]CharacterAliasRule, 0, len(rules))
	seen := make(map[string]struct{}, len(rules))
	for i, rule := range rules {
		clean, err := normalizeCharacterAliasRule(rule, i)
		if err != nil {
			return nil, err
		}
		if _, ok := seen[clean.ID]; ok {
			return nil, apperror.BadRequest(fmt.Sprintf("alias_rules[%d].id is duplicated", i))
		}
		seen[clean.ID] = struct{}{}
		normalized = append(normalized, clean)
	}
	return normalized, nil
}

func normalizeCharacterAliasRule(rule CharacterAliasRule, index int) (CharacterAliasRule, error) {
	rule.ID = strings.TrimSpace(rule.ID)
	rule.Label = strings.TrimSpace(rule.Label)
	if rule.ID == "" {
		return CharacterAliasRule{}, apperror.BadRequest(fmt.Sprintf("alias_rules[%d].id is required", index))
	}
	if rule.Priority < 0 {
		return CharacterAliasRule{}, apperror.BadRequest(fmt.Sprintf("alias_rules[%d].priority must be non-negative", index))
	}
	rule.DisplayName = trimOptionalText(rule.DisplayName)
	rule.DisplayIconURL = trimOptionalText(rule.DisplayIconURL)
	if rule.DisplayName == nil && rule.DisplayIconURL == nil {
		return CharacterAliasRule{}, apperror.BadRequest(fmt.Sprintf("alias_rules[%d] requires display_name or display_icon_url", index))
	}
	if rule.DisplayName != nil && len([]rune(*rule.DisplayName)) > 50 {
		return CharacterAliasRule{}, apperror.BadRequest(fmt.Sprintf("alias_rules[%d].display_name is too long", index))
	}
	if rule.DisplayIconURL != nil {
		if _, err := url.ParseRequestURI(*rule.DisplayIconURL); err != nil {
			return CharacterAliasRule{}, apperror.BadRequest(fmt.Sprintf("alias_rules[%d].display_icon_url must be a valid URL", index))
		}
	}
	if len(rule.Condition) == 0 || string(rule.Condition) == "null" {
		return CharacterAliasRule{}, apperror.BadRequest(fmt.Sprintf("alias_rules[%d].condition is required", index))
	}
	if _, err := engine.ParseConditionGroup(rule.Condition); err != nil {
		return CharacterAliasRule{}, apperror.BadRequest(fmt.Sprintf("alias_rules[%d].condition invalid: %v", index, err))
	}
	return rule, nil
}

func trimOptionalText(value *string) *string {
	if value == nil {
		return nil
	}
	trimmed := strings.TrimSpace(*value)
	if trimmed == "" {
		return nil
	}
	return &trimmed
}

func marshalCharacterAliasRules(rules []CharacterAliasRule) (json.RawMessage, error) {
	if rules == nil {
		return json.RawMessage(`[]`), nil
	}
	raw, err := json.Marshal(rules)
	if err != nil {
		return nil, err
	}
	return raw, nil
}

func unmarshalCharacterAliasRules(raw json.RawMessage) []CharacterAliasRule {
	return engine.ParseCharacterAliasRules(raw)
}
