package editor

import (
	"context"
	"encoding/json"
	"fmt"
	"testing"

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
		name  string
		rules []CharacterAliasRule
	}{
		{name: "missing display", rules: []CharacterAliasRule{{ID: "missing-display", Priority: 0, Condition: aliasCondition("identity_revealed", "true")}}},
		{name: "bad condition", rules: []CharacterAliasRule{{ID: "bad-condition", DisplayName: strPtr("별칭"), Priority: 0, Condition: json.RawMessage(`{"id":"g","operator":"AND","rules":[]}`)}}},
		{name: "empty id", rules: []CharacterAliasRule{{ID: " ", DisplayName: strPtr("별칭"), Priority: 0, Condition: aliasCondition("identity_revealed", "true")}}},
		{name: "duplicated id", rules: []CharacterAliasRule{valid, valid}},
		{name: "negative priority", rules: []CharacterAliasRule{{ID: "negative", DisplayName: strPtr("별칭"), Priority: -1, Condition: aliasCondition("identity_revealed", "true")}}},
		{name: "long display name", rules: []CharacterAliasRule{{ID: "long", DisplayName: &longName, Priority: 0, Condition: aliasCondition("identity_revealed", "true")}}},
		{name: "invalid icon URL", rules: []CharacterAliasRule{{ID: "url", DisplayIconURL: strPtr("not a url"), Priority: 0, Condition: aliasCondition("identity_revealed", "true")}}},
		{name: "too many rules", rules: tooMany},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			if _, err := normalizeCharacterAliasRules(tc.rules); err == nil {
				t.Fatal("expected validation error")
			}
		})
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
	if len(updated.AliasRules) != 1 {
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
