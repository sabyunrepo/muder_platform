package editor

import (
	"context"
	"testing"
)

func TestClueUsePolicy(t *testing.T) {
	strPtr := func(value string) *string { return &value }
	tests := []struct {
		name         string
		isUsable     bool
		effect       *string
		target       *string
		consumed     bool
		wantUsable   bool
		wantEffect   *string
		wantTarget   *string
		wantConsumed bool
		wantErr      bool
	}{
		{name: "disabled clue clears use settings", isUsable: false, effect: strPtr(ClueUseEffectPeek), target: strPtr(ClueUseTargetPlayer), consumed: true, wantUsable: false},
		{name: "usable defaults to peek player", isUsable: true, wantUsable: true, wantEffect: strPtr(ClueUseEffectPeek), wantTarget: strPtr(ClueUseTargetPlayer)},
		{name: "reveal defaults to self", isUsable: true, effect: strPtr(ClueUseEffectReveal), wantUsable: true, wantEffect: strPtr(ClueUseEffectReveal), wantTarget: strPtr(ClueUseTargetSelf)},
		{name: "swap defaults to clue", isUsable: true, effect: strPtr(ClueUseEffectSwap), wantUsable: true, wantEffect: strPtr(ClueUseEffectSwap), wantTarget: strPtr(ClueUseTargetClue)},
		{name: "consume remains option", isUsable: true, consumed: true, wantUsable: true, wantEffect: strPtr(ClueUseEffectPeek), wantTarget: strPtr(ClueUseTargetPlayer), wantConsumed: true},
		{name: "unknown effect is rejected", isUsable: true, effect: strPtr("grant_clue"), wantErr: true},
		{name: "mismatched target is rejected", isUsable: true, effect: strPtr(ClueUseEffectReveal), target: strPtr(ClueUseTargetPlayer), wantErr: true},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			got, err := BuildClueUsePolicy(tc.isUsable, tc.effect, tc.target, tc.consumed)
			if tc.wantErr {
				if err == nil {
					t.Fatal("expected error")
				}
				return
			}
			if err != nil {
				t.Fatalf("BuildClueUsePolicy: %v", err)
			}
			if got.IsUsable != tc.wantUsable {
				t.Fatalf("IsUsable = %v, want %v", got.IsUsable, tc.wantUsable)
			}
			if stringPtrValue(got.UseEffect) != stringPtrValue(tc.wantEffect) {
				t.Fatalf("UseEffect = %q, want %q", stringPtrValue(got.UseEffect), stringPtrValue(tc.wantEffect))
			}
			if stringPtrValue(got.UseTarget) != stringPtrValue(tc.wantTarget) {
				t.Fatalf("UseTarget = %q, want %q", stringPtrValue(got.UseTarget), stringPtrValue(tc.wantTarget))
			}
			if got.UseConsumed != tc.wantConsumed {
				t.Fatalf("UseConsumed = %v, want %v", got.UseConsumed, tc.wantConsumed)
			}
		})
	}
}

func TestService_CreateClueUsePolicyDefaults(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test in short mode")
	}
	f := setupFixture(t)
	ctx := context.Background()
	creatorID := f.createUser(t)
	themeID := f.createThemeForUser(t, creatorID)

	reveal := ClueUseEffectReveal
	resp, err := f.svc.CreateClue(ctx, creatorID, themeID, CreateClueRequest{
		Name:      "공개되는 정보",
		Level:     1,
		SortOrder: 0,
		IsUsable:  true,
		UseEffect: &reveal,
	})
	if err != nil {
		t.Fatalf("CreateClue: %v", err)
	}
	if stringPtrValue(resp.UseEffect) != ClueUseEffectReveal {
		t.Fatalf("UseEffect = %q, want %q", stringPtrValue(resp.UseEffect), ClueUseEffectReveal)
	}
	if stringPtrValue(resp.UseTarget) != ClueUseTargetSelf {
		t.Fatalf("UseTarget = %q, want %q", stringPtrValue(resp.UseTarget), ClueUseTargetSelf)
	}
}

func TestService_CreateClueUsePolicyClearsDisabledSettings(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test in short mode")
	}
	f := setupFixture(t)
	ctx := context.Background()
	creatorID := f.createUser(t)
	themeID := f.createThemeForUser(t, creatorID)

	effect := ClueUseEffectPeek
	target := ClueUseTargetPlayer
	resp, err := f.svc.CreateClue(ctx, creatorID, themeID, CreateClueRequest{
		Name:        "비활성 단서",
		Level:       1,
		SortOrder:   0,
		IsUsable:    false,
		UseEffect:   &effect,
		UseTarget:   &target,
		UseConsumed: true,
	})
	if err != nil {
		t.Fatalf("CreateClue: %v", err)
	}
	if resp.UseEffect != nil || resp.UseTarget != nil || resp.UseConsumed {
		t.Fatalf("disabled clue use policy not cleared: effect=%v target=%v consumed=%v", resp.UseEffect, resp.UseTarget, resp.UseConsumed)
	}
}

func stringPtrValue(value *string) string {
	if value == nil {
		return ""
	}
	return *value
}
