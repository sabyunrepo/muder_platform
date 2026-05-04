package deck_investigation

import (
	"errors"
	"testing"

	"github.com/google/uuid"
)

func validConfig() Config {
	return Config{
		Tokens: []TokenConfig{{ID: "coin", DefaultAmount: 2}},
		Decks: []DeckConfig{{
			ID:                  "library",
			TokenID:             "coin",
			TokenCost:           1,
			DrawOrder:           DrawSequential,
			PhaseIDs:            []string{"phase-1"},
			LocationIDs:         []string{"loc-1"},
			BlockedCharacterIDs: []string{"char-blocked"},
			RequiredClueIDs:     []string{"key"},
			Cards:               []CardConfig{{ClueID: "clue-1", Delivery: DeliveryPrivateOwnership}},
		}},
	}
}

func TestValidateConfig(t *testing.T) {
	t.Run("accepts valid token deck contract", func(t *testing.T) {
		if err := ValidateConfig(validConfig()); err != nil {
			t.Fatalf("ValidateConfig() error = %v", err)
		}
	})

	t.Run("rejects duplicate token ids", func(t *testing.T) {
		cfg := validConfig()
		cfg.Tokens = append(cfg.Tokens, TokenConfig{ID: "coin"})
		if err := ValidateConfig(cfg); err == nil {
			t.Fatal("expected duplicate token error")
		}
	})

	t.Run("rejects deck with missing token", func(t *testing.T) {
		cfg := validConfig()
		cfg.Decks[0].TokenID = "missing"
		if err := ValidateConfig(cfg); err == nil {
			t.Fatal("expected missing token error")
		}
	})

	t.Run("rejects unsupported card delivery", func(t *testing.T) {
		cfg := validConfig()
		cfg.Decks[0].Cards[0].Delivery = "raw-json"
		if err := ValidateConfig(cfg); err == nil {
			t.Fatal("expected delivery error")
		}
	})
}

func TestEvaluateAccess(t *testing.T) {
	player := PlayerState{
		PlayerID:      uuid.New(),
		CharacterID:   "char-1",
		PhaseID:       "phase-1",
		LocationID:    "loc-1",
		TokenBalances: map[string]int{"coin": 1},
		HeldClueIDs:   map[string]bool{"key": true},
	}

	t.Run("allows deck when phase location clue and token requirements pass", func(t *testing.T) {
		decision, err := EvaluateAccess(validConfig(), "library", player)
		if err != nil {
			t.Fatalf("EvaluateAccess() error = %v", err)
		}
		if !decision.Allowed || decision.ReasonCode != "allowed" || decision.TokenCost != 1 {
			t.Fatalf("unexpected decision: %+v", decision)
		}
	})

	t.Run("blocks wrong phase before token consumption", func(t *testing.T) {
		blocked := player
		blocked.PhaseID = "phase-2"
		decision, err := EvaluateAccess(validConfig(), "library", blocked)
		if !errors.Is(err, ErrDeckNotAllowed) || decision.ReasonCode != "wrong_phase" {
			t.Fatalf("expected wrong_phase, got decision=%+v err=%v", decision, err)
		}
	})

	t.Run("blocks configured character", func(t *testing.T) {
		blocked := player
		blocked.CharacterID = "char-blocked"
		decision, err := EvaluateAccess(validConfig(), "library", blocked)
		if !errors.Is(err, ErrDeckNotAllowed) || decision.ReasonCode != "blocked_character" {
			t.Fatalf("expected blocked_character, got decision=%+v err=%v", decision, err)
		}
	})

	t.Run("blocks missing prerequisite clue", func(t *testing.T) {
		blocked := player
		blocked.HeldClueIDs = map[string]bool{}
		decision, err := EvaluateAccess(validConfig(), "library", blocked)
		if !errors.Is(err, ErrDeckNotAllowed) || decision.ReasonCode != "missing_required_clue" {
			t.Fatalf("expected missing_required_clue, got decision=%+v err=%v", decision, err)
		}
	})

	t.Run("blocks insufficient token balance", func(t *testing.T) {
		blocked := player
		blocked.TokenBalances = map[string]int{"coin": 0}
		decision, err := EvaluateAccess(validConfig(), "library", blocked)
		if !errors.Is(err, ErrInsufficientToken) || decision.ReasonCode != "insufficient_token" {
			t.Fatalf("expected insufficient_token, got decision=%+v err=%v", decision, err)
		}
	})
}

func TestBuildDrawResult(t *testing.T) {
	deck := validConfig().Decks[0]
	result, ok := BuildDrawResult(deck, 0)
	if !ok {
		t.Fatal("expected draw result")
	}
	if result != (DrawResult{DeckID: "library", ClueID: "clue-1", Delivery: DeliveryPrivateOwnership}) {
		t.Fatalf("unexpected draw result: %+v", result)
	}

	if _, ok := BuildDrawResult(deck, 10); ok {
		t.Fatal("out-of-range draw should be rejected")
	}
}
