package editor

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"testing"

	"github.com/google/uuid"

	"github.com/mmp-platform/server/internal/engine"
)

func TestResolveCharacterDisplay_AppliesHighestPriorityMatchingAlias(t *testing.T) {
	icon := "https://cdn.example/revealed.webp"
	base := engine.CharacterDisplayBase{
		Name:     "홍길동",
		ImageURL: strPtr("https://cdn.example/base.webp"),
		AliasRules: []CharacterAliasRule{
			{
				ID:          "low",
				DisplayName: strPtr("낮은 우선순위"),
				Priority:    1,
				Condition:   aliasCondition("identity_revealed", "true"),
			},
			{
				ID:             "high",
				DisplayName:    strPtr("밤의 목격자"),
				DisplayIconURL: &icon,
				Priority:       5,
				Condition:      aliasCondition("identity_revealed", "true"),
			},
		},
	}

	got := engine.ResolveCharacterDisplay(base, json.RawMessage(`{"flags":{"identity_revealed":true}}`))

	if got.Name != "밤의 목격자" {
		t.Fatalf("Name = %q", got.Name)
	}
	if got.ImageURL == nil || *got.ImageURL != icon {
		t.Fatalf("ImageURL = %#v", got.ImageURL)
	}
	if got.AppliedAliasRuleID == nil || *got.AppliedAliasRuleID != "high" {
		t.Fatalf("AppliedAliasRuleID = %#v", got.AppliedAliasRuleID)
	}
}

func TestResolveCharacterDisplay_FallsBackWhenConditionFailsOrInvalid(t *testing.T) {
	base := engine.CharacterDisplayBase{
		Name: "홍길동",
		AliasRules: []CharacterAliasRule{
			{
				ID:          "false",
				DisplayName: strPtr("숨겨진 이름"),
				Priority:    10,
				Condition:   aliasCondition("identity_revealed", "true"),
			},
			{
				ID:          "invalid",
				DisplayName: strPtr("깨진 이름"),
				Priority:    20,
				Condition:   json.RawMessage(`{"broken":true}`),
			},
		},
	}

	got := engine.ResolveCharacterDisplay(base, json.RawMessage(`{"flags":{"identity_revealed":false}}`))

	if got.Name != "홍길동" {
		t.Fatalf("Name = %q", got.Name)
	}
	if got.AppliedAliasRuleID != nil {
		t.Fatalf("AppliedAliasRuleID = %#v", got.AppliedAliasRuleID)
	}
}

func TestNormalizeCharacterAliasRules_ValidatesConditionAndDisplayValue(t *testing.T) {
	longName := "가나다라마바사아자차카타파하가나다라마바사아자차카타파하가나다라마바사아자차카타파하가나다라마바사아자차카타파하"
	valid := CharacterAliasRule{
		ID:          "alias-1",
		DisplayName: strPtr("별칭"),
		Priority:    0,
		Condition:   aliasCondition("identity_revealed", "true"),
	}
	tooMany := make([]CharacterAliasRule, MaxCharacterAliasRules+1)
	for i := range tooMany {
		rule := valid
		rule.ID = fmt.Sprintf("alias-%d", i)
		tooMany[i] = rule
	}

	tests := []struct {
		name            string
		rules           []CharacterAliasRule
		wantErrContains string
	}{
		{name: "missing display", rules: []CharacterAliasRule{{ID: "missing-display", Priority: 0, Condition: aliasCondition("identity_revealed", "true")}}, wantErrContains: "display_name, display_icon_url, or display_icon_media_id"},
		{name: "bad condition", rules: []CharacterAliasRule{{ID: "bad-condition", DisplayName: strPtr("별칭"), Priority: 0, Condition: json.RawMessage(`{"id":"g","operator":"AND","rules":[]}`)}}, wantErrContains: "condition invalid"},
		{name: "empty id", rules: []CharacterAliasRule{{ID: " ", DisplayName: strPtr("별칭"), Priority: 0, Condition: aliasCondition("identity_revealed", "true")}}, wantErrContains: "id is required"},
		{name: "duplicated id", rules: []CharacterAliasRule{valid, valid}, wantErrContains: "duplicated"},
		{name: "negative priority", rules: []CharacterAliasRule{{ID: "negative", DisplayName: strPtr("별칭"), Priority: -1, Condition: aliasCondition("identity_revealed", "true")}}, wantErrContains: "priority"},
		{name: "long display name", rules: []CharacterAliasRule{{ID: "long", DisplayName: &longName, Priority: 0, Condition: aliasCondition("identity_revealed", "true")}}, wantErrContains: "display_name is too long"},
		{name: "invalid icon URL", rules: []CharacterAliasRule{{ID: "url", DisplayIconURL: strPtr("not a url"), Priority: 0, Condition: aliasCondition("identity_revealed", "true")}}, wantErrContains: "display_icon_url"},
		{name: "too many rules", rules: tooMany, wantErrContains: "at most"},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			_, err := normalizeCharacterAliasRules(tc.rules)
			if err == nil {
				t.Fatal("expected validation error")
			}
			if !strings.Contains(err.Error(), tc.wantErrContains) {
				t.Fatalf("expected error containing %q, got %v", tc.wantErrContains, err)
			}
		})
	}
}

func TestService_CreateCharacter_ValidatesAliasIconMediaID(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test in short mode")
	}
	f := setupFixture(t)
	ctx := context.Background()
	creatorID := f.createUser(t)
	themeID := f.createThemeForUser(t, creatorID)
	image := createMediaForReferenceTest(t, f.q, themeID, "alias-icon", MediaTypeImage)
	document := createMediaForReferenceTest(t, f.q, themeID, "alias-doc", MediaTypeDocument)
	otherThemeID := f.createThemeForUser(t, creatorID)
	otherThemeImage := createMediaForReferenceTest(t, f.q, otherThemeID, "other-alias-icon", MediaTypeImage)

	created, err := f.svc.CreateCharacter(ctx, creatorID, themeID, CreateCharacterRequest{
		Name: "별칭 캐릭터",
		AliasRules: []CharacterAliasRule{{
			ID:                 "alias-icon",
			DisplayIconMediaID: strPtr(image.ID.String()),
			Priority:           0,
			Condition:          aliasCondition("identity_revealed", "true"),
		}},
	})
	if err != nil {
		t.Fatalf("CreateCharacter with alias icon media id: %v", err)
	}
	if len(created.AliasRules) != 1 || created.AliasRules[0].DisplayIconMediaID == nil || *created.AliasRules[0].DisplayIconMediaID != image.ID.String() {
		t.Fatalf("alias icon media id not persisted: %+v", created.AliasRules)
	}

	_, err = f.svc.CreateCharacter(ctx, creatorID, themeID, CreateCharacterRequest{
		Name: "잘못된 별칭 캐릭터",
		AliasRules: []CharacterAliasRule{{
			ID:                 "alias-doc",
			DisplayIconMediaID: strPtr(document.ID.String()),
			Priority:           0,
			Condition:          aliasCondition("identity_revealed", "true"),
		}},
	})
	if err == nil || !strings.Contains(err.Error(), "display_icon_media_id must be an image in this theme") {
		t.Fatalf("expected wrong media type validation error, got %v", err)
	}

	_, err = f.svc.CreateCharacter(ctx, creatorID, themeID, CreateCharacterRequest{
		Name: "다른 테마 별칭 캐릭터",
		AliasRules: []CharacterAliasRule{{
			ID:                 "alias-other-theme",
			DisplayIconMediaID: strPtr(otherThemeImage.ID.String()),
			Priority:           0,
			Condition:          aliasCondition("identity_revealed", "true"),
		}},
	})
	if err == nil || !strings.Contains(err.Error(), "display_icon_media_id must be an image in this theme") {
		t.Fatalf("expected other theme media validation error, got %v", err)
	}

	_, err = f.svc.CreateCharacter(ctx, creatorID, themeID, CreateCharacterRequest{
		Name: "없는 미디어 별칭 캐릭터",
		AliasRules: []CharacterAliasRule{{
			ID:                 "alias-missing",
			DisplayIconMediaID: strPtr(uuid.NewString()),
			Priority:           0,
			Condition:          aliasCondition("identity_revealed", "true"),
		}},
	})
	if err == nil || !strings.Contains(err.Error(), "display_icon_media_id media not found") {
		t.Fatalf("expected missing media validation error, got %v", err)
	}
}

func TestResolveCharacterDisplay_AppliesNameOnlyIconOnlyAndNullContext(t *testing.T) {
	icon := "https://cdn.example/icon.webp"
	nameOnly := engine.ResolveCharacterDisplay(engine.CharacterDisplayBase{
		Name: "기본",
		AliasRules: []CharacterAliasRule{{
			ID:          "name",
			DisplayName: strPtr("별칭"),
			Condition:   aliasCondition("identity_revealed", "true"),
		}},
	}, json.RawMessage(`{"flags":{"identity_revealed":true}}`))
	if nameOnly.Name != "별칭" || nameOnly.ImageURL != nil {
		t.Fatalf("name-only display mismatch: %+v", nameOnly)
	}

	iconOnly := engine.ResolveCharacterDisplay(engine.CharacterDisplayBase{
		Name: "기본",
		AliasRules: []CharacterAliasRule{{
			ID:             "icon",
			DisplayIconURL: &icon,
			Condition:      aliasCondition("identity_revealed", "true"),
		}},
	}, json.RawMessage(`{"flags":{"identity_revealed":true}}`))
	if iconOnly.Name != "기본" || iconOnly.ImageURL == nil || *iconOnly.ImageURL != icon {
		t.Fatalf("icon-only display mismatch: %+v", iconOnly)
	}

	fallback := engine.ResolveCharacterDisplay(engine.CharacterDisplayBase{
		Name: "기본",
		AliasRules: []CharacterAliasRule{{
			ID:          "name",
			DisplayName: strPtr("별칭"),
			Condition:   aliasCondition("identity_revealed", "true"),
		}},
	}, json.RawMessage(`null`))
	if fallback.Name != "기본" || fallback.AppliedAliasRuleID != nil {
		t.Fatalf("null context should fall back: %+v", fallback)
	}
}

func TestService_CharacterAliasRulesContract(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test in short mode")
	}
	f := setupFixture(t)
	ctx := context.Background()
	creatorID := f.createUser(t)
	themeID := f.createThemeForUser(t, creatorID)

	created, err := f.svc.CreateCharacter(ctx, creatorID, themeID, CreateCharacterRequest{
		Name: "홍길동",
		AliasRules: []CharacterAliasRule{{
			ID:          "identity-open",
			Label:       "정체 공개",
			DisplayName: strPtr("밤의 목격자"),
			Priority:    2,
			Condition:   aliasCondition("identity_revealed", "true"),
		}},
	})
	if err != nil {
		t.Fatalf("CreateCharacter: %v", err)
	}
	if len(created.AliasRules) != 1 ||
		created.AliasRules[0].DisplayName == nil ||
		*created.AliasRules[0].DisplayName != "밤의 목격자" {
		t.Fatalf("created alias rules = %+v", created.AliasRules)
	}

	updated, err := f.svc.UpdateCharacter(ctx, creatorID, created.ID, UpdateCharacterRequest{
		Name:        "홍길동",
		MysteryRole: MysteryRoleSuspect,
		SortOrder:   1,
	})
	if err != nil {
		t.Fatalf("UpdateCharacter preserve alias rules: %v", err)
	}
	if len(updated.AliasRules) != 1 ||
		updated.AliasRules[0].ID != "identity-open" ||
		updated.AliasRules[0].DisplayName == nil ||
		*updated.AliasRules[0].DisplayName != "밤의 목격자" ||
		updated.AliasRules[0].Priority != 2 {
		t.Fatalf("alias rules should be preserved: %+v", updated.AliasRules)
	}

	cleared, err := f.svc.UpdateCharacter(ctx, creatorID, created.ID, UpdateCharacterRequest{
		Name:        "홍길동",
		MysteryRole: MysteryRoleSuspect,
		SortOrder:   1,
		AliasRules:  []CharacterAliasRule{},
	})
	if err != nil {
		t.Fatalf("UpdateCharacter clear alias rules: %v", err)
	}
	if len(cleared.AliasRules) != 0 {
		t.Fatalf("alias rules should be cleared: %+v", cleared.AliasRules)
	}
}

func aliasCondition(flagKey string, value string) json.RawMessage {
	return json.RawMessage(`{"id":"group-1","operator":"AND","rules":[{"id":"rule-1","variable":"custom_flag","target_flag_key":"` + flagKey + `","comparator":"=","value":"` + value + `"}]}`)
}

func strPtr(value string) *string {
	return &value
}
