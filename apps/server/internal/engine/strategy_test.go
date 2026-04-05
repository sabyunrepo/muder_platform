package engine

import (
	"context"
	"testing"
)

var testPhases = []PhaseConfig{
	{ID: "intro", Name: "Introduction", Type: "discussion", Duration: 60},
	{ID: "invest", Name: "Investigation", Type: "investigation", Duration: 120},
	{ID: "vote", Name: "Voting", Type: "voting", Duration: 30},
}

func TestScriptStrategy_SequentialAdvance(t *testing.T) {
	s := NewScriptStrategy()
	ctx := context.Background()

	if err := s.Init(ctx, GameConfig{Phases: testPhases}); err != nil {
		t.Fatal(err)
	}

	phase := s.CurrentPhase()
	if phase.ID != "intro" {
		t.Fatalf("expected intro, got %s", phase.ID)
	}

	hasNext, err := s.Advance(ctx)
	if err != nil || !hasNext {
		t.Fatalf("expected hasNext=true, got %v %v", hasNext, err)
	}
	if s.CurrentPhase().ID != "invest" {
		t.Fatalf("expected invest, got %s", s.CurrentPhase().ID)
	}

	hasNext, _ = s.Advance(ctx)
	if !hasNext {
		t.Fatal("expected hasNext=true for vote phase")
	}

	hasNext, _ = s.Advance(ctx)
	if hasNext {
		t.Fatal("expected hasNext=false after last phase")
	}
}

func TestScriptStrategy_SkipTo(t *testing.T) {
	s := NewScriptStrategy()
	ctx := context.Background()
	_ = s.Init(ctx, GameConfig{Phases: testPhases})

	if err := s.SkipTo(ctx, "vote"); err != nil {
		t.Fatal(err)
	}
	if s.CurrentPhase().ID != "vote" {
		t.Fatalf("expected vote, got %s", s.CurrentPhase().ID)
	}
}

func TestScriptStrategy_SkipToNotFound(t *testing.T) {
	s := NewScriptStrategy()
	ctx := context.Background()
	_ = s.Init(ctx, GameConfig{Phases: testPhases})

	if err := s.SkipTo(ctx, "nonexistent"); err == nil {
		t.Fatal("expected error for nonexistent phase")
	}
}

func TestHybridStrategy_Consensus(t *testing.T) {
	h := NewHybridStrategy()
	ctx := context.Background()
	_ = h.Init(ctx, GameConfig{Phases: testPhases})

	if h.ConsensusCount() != 0 {
		t.Fatal("expected 0 consensus")
	}

	p1 := [16]byte{1}
	p2 := [16]byte{2}
	_ = h.HandleConsensus(ctx, p1, "agree")
	_ = h.HandleConsensus(ctx, p2, "agree")

	if h.ConsensusCount() != 2 {
		t.Fatalf("expected 2, got %d", h.ConsensusCount())
	}

	_ = h.HandleConsensus(ctx, p1, "disagree")
	if h.ConsensusCount() != 1 {
		t.Fatalf("expected 1, got %d", h.ConsensusCount())
	}

	// Advance resets consensus.
	_, _ = h.Advance(ctx)
	if h.ConsensusCount() != 0 {
		t.Fatal("expected 0 after advance")
	}
}

func TestEventStrategy_NonLinearAdvance(t *testing.T) {
	phases := []PhaseConfig{
		{ID: "a", Name: "A", Type: "discussion", NextPhaseID: "c"},
		{ID: "b", Name: "B", Type: "investigation"},
		{ID: "c", Name: "C", Type: "voting", NextPhaseID: "b"},
	}

	e := NewEventStrategy()
	ctx := context.Background()
	_ = e.Init(ctx, GameConfig{Phases: phases})

	if e.CurrentPhase().ID != "a" {
		t.Fatalf("expected a, got %s", e.CurrentPhase().ID)
	}

	// a → c (via NextPhaseID)
	hasNext, _ := e.Advance(ctx)
	if !hasNext || e.CurrentPhase().ID != "c" {
		t.Fatalf("expected c, got %s", e.CurrentPhase().ID)
	}

	// c → b
	hasNext, _ = e.Advance(ctx)
	if !hasNext || e.CurrentPhase().ID != "b" {
		t.Fatalf("expected b, got %s", e.CurrentPhase().ID)
	}

	// b has no NextPhaseID → game ends
	hasNext, _ = e.Advance(ctx)
	if hasNext {
		t.Fatal("expected hasNext=false")
	}
}

func TestEventStrategy_TriggerTransition(t *testing.T) {
	phases := []PhaseConfig{
		{
			ID: "start", Name: "Start", Type: "discussion",
			Triggers: []TriggerConfig{
				{Type: "timer", TargetID: "end"},
			},
		},
		{ID: "end", Name: "End", Type: "voting"},
	}

	e := NewEventStrategy()
	ctx := context.Background()
	_ = e.Init(ctx, GameConfig{Phases: phases})

	targetID, err := e.HandleTrigger(ctx, "timer", nil)
	if err != nil {
		t.Fatal(err)
	}
	if targetID != "end" {
		t.Fatalf("expected target 'end', got %q", targetID)
	}
	// Strategy should NOT have transitioned — engine does that.
	if e.CurrentPhase().ID != "start" {
		t.Fatalf("expected strategy still on 'start', got %s", e.CurrentPhase().ID)
	}
}

func TestStrategy_EmptyPhasesError(t *testing.T) {
	ctx := context.Background()
	strategies := []ProgressionStrategy{
		NewScriptStrategy(),
		NewHybridStrategy(),
		NewEventStrategy(),
	}

	for _, s := range strategies {
		if err := s.Init(ctx, GameConfig{}); err == nil {
			t.Fatalf("expected error for empty phases on %T", s)
		}
	}
}
