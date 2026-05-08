package engine

import (
	"context"
	"encoding/json"
	"testing"
)

func TestPhaseEngine_PlayerDisplayContextUsesExplicitPhaseTypeForIntro(t *testing.T) {
	pe, _ := newTestPhaseEngine(t, nil, []PhaseDefinition{
		{ID: "opening_scene", Name: "첫 장면", Type: "intro"},
		{ID: "investigation", Name: "조사"},
	})
	ctx := context.Background()
	if err := pe.Start(ctx, nil); err != nil {
		t.Fatalf("Start: %v", err)
	}
	defer pe.Stop(ctx)

	flags := displayContextFlags(t, pe.PlayerDisplayContext())
	if flags["intro_started"] != true || flags["intro_finished"] != false {
		t.Fatalf("intro flags at intro phase = %+v", flags)
	}

	if _, err := pe.AdvancePhase(ctx); err != nil {
		t.Fatalf("AdvancePhase: %v", err)
	}
	flags = displayContextFlags(t, pe.PlayerDisplayContext())
	if flags["intro_started"] != true || flags["intro_finished"] != true {
		t.Fatalf("intro flags after intro phase = %+v", flags)
	}
}

func TestPhaseEngine_PlayerDisplayContextDoesNotInferIntroFromNameSubstring(t *testing.T) {
	pe, _ := newTestPhaseEngine(t, nil, []PhaseDefinition{
		{ID: "opening_scene", Name: "자기소개"},
		{ID: "investigation", Name: "조사"},
	})
	ctx := context.Background()
	if err := pe.Start(ctx, nil); err != nil {
		t.Fatalf("Start: %v", err)
	}
	defer pe.Stop(ctx)

	flags := displayContextFlags(t, pe.PlayerDisplayContext())
	if flags["intro_started"] != false || flags["intro_finished"] != false {
		t.Fatalf("intro flags should ignore phase name substring: %+v", flags)
	}
}

func displayContextFlags(t *testing.T, raw json.RawMessage) map[string]any {
	t.Helper()
	var body struct {
		Flags map[string]any `json:"flags"`
	}
	if err := json.Unmarshal(raw, &body); err != nil {
		t.Fatalf("unmarshal display context: %v", err)
	}
	return body.Flags
}
