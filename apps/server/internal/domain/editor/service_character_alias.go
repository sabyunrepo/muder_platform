package editor

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/url"
	"strings"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"

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
	rule.DisplayIconMediaID = trimOptionalText(rule.DisplayIconMediaID)
	if rule.DisplayName == nil && rule.DisplayIconURL == nil && rule.DisplayIconMediaID == nil {
		return CharacterAliasRule{}, apperror.BadRequest(fmt.Sprintf("alias_rules[%d] requires display_name, display_icon_url, or display_icon_media_id", index))
	}
	if rule.DisplayName != nil && len([]rune(*rule.DisplayName)) > 50 {
		return CharacterAliasRule{}, apperror.BadRequest(fmt.Sprintf("alias_rules[%d].display_name is too long", index))
	}
	if rule.DisplayIconURL != nil {
		if _, err := url.ParseRequestURI(*rule.DisplayIconURL); err != nil {
			return CharacterAliasRule{}, apperror.BadRequest(fmt.Sprintf("alias_rules[%d].display_icon_url must be a valid URL", index))
		}
	}
	if rule.DisplayIconMediaID != nil {
		if _, err := uuid.Parse(*rule.DisplayIconMediaID); err != nil {
			return CharacterAliasRule{}, apperror.BadRequest(fmt.Sprintf("alias_rules[%d].display_icon_media_id must be a valid media id", index))
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

func (s *service) validateCharacterAliasMedia(ctx context.Context, themeID uuid.UUID, rules []CharacterAliasRule) error {
	for i, rule := range rules {
		if rule.DisplayIconMediaID == nil {
			continue
		}
		mediaID, err := uuid.Parse(*rule.DisplayIconMediaID)
		if err != nil {
			return apperror.BadRequest(fmt.Sprintf("alias_rules[%d].display_icon_media_id must be a valid media id", i))
		}
		media, err := s.q.GetMedia(ctx, mediaID)
		if err != nil {
			if errors.Is(err, pgx.ErrNoRows) {
				return apperror.BadRequest(fmt.Sprintf("alias_rules[%d].display_icon_media_id media not found", i))
			}
			s.logger.Error().Err(err).Str("media_id", mediaID.String()).Msg("failed to get character alias icon media")
			return apperror.Internal("failed to validate character alias icon media")
		}
		if media.ThemeID != themeID || media.Type != MediaTypeImage {
			return apperror.BadRequest(fmt.Sprintf("alias_rules[%d].display_icon_media_id must be an image in this theme", i))
		}
	}
	return nil
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
