package deck_investigation

import (
	"errors"
	"fmt"
	"slices"

	"github.com/google/uuid"
)

const (
	DeliveryPrivateOwnership = "private_ownership"
	DeliveryPublicReveal     = "public_reveal"
	DeliveryViewOnly         = "view_only"

	DrawSequential = "sequential"
	DrawRandom     = "random"
)

var (
	ErrDeckNotFound      = errors.New("deck_investigation: deck not found")
	ErrDeckNotAllowed    = errors.New("deck_investigation: deck is not available")
	ErrInsufficientToken = errors.New("deck_investigation: insufficient token balance")
)

type Config struct {
	Tokens []TokenConfig `json:"tokens"`
	Decks  []DeckConfig  `json:"decks"`
}

type TokenConfig struct {
	ID            string `json:"id"`
	DefaultAmount int    `json:"defaultAmount"`
}

type DeckConfig struct {
	ID                  string       `json:"id"`
	TokenID             string       `json:"tokenId"`
	TokenCost           int          `json:"tokenCost"`
	DrawOrder           string       `json:"drawOrder"`
	PhaseIDs            []string     `json:"phaseIds"`
	LocationIDs         []string     `json:"locationIds"`
	BlockedCharacterIDs []string     `json:"blockedCharacterIds"`
	RequiredClueIDs     []string     `json:"requiredClueIds"`
	Cards               []CardConfig `json:"cards"`
	EmptyMessage        string       `json:"emptyMessage"`
}

type CardConfig struct {
	ClueID   string `json:"clueId"`
	Delivery string `json:"delivery"`
}

type PlayerState struct {
	PlayerID      uuid.UUID
	CharacterID   string
	PhaseID       string
	LocationID    string
	TokenBalances map[string]int
	HeldClueIDs   map[string]bool
}

type AccessDecision struct {
	DeckID     string `json:"deckId"`
	Allowed    bool   `json:"allowed"`
	TokenID    string `json:"tokenId"`
	TokenCost  int    `json:"tokenCost"`
	ReasonCode string `json:"reasonCode"`
}

type DrawResult struct {
	DeckID   string `json:"deckId"`
	ClueID   string `json:"clueId"`
	Delivery string `json:"delivery"`
}

func ValidateConfig(config Config) error {
	tokenIDs := make(map[string]struct{}, len(config.Tokens))
	for _, token := range config.Tokens {
		if token.ID == "" {
			return fmt.Errorf("deck_investigation: token id is required")
		}
		if _, exists := tokenIDs[token.ID]; exists {
			return fmt.Errorf("deck_investigation: duplicate token id %q", token.ID)
		}
		if token.DefaultAmount < 0 {
			return fmt.Errorf("deck_investigation: token %q defaultAmount must be non-negative", token.ID)
		}
		tokenIDs[token.ID] = struct{}{}
	}

	deckIDs := make(map[string]struct{}, len(config.Decks))
	for _, deck := range config.Decks {
		if deck.ID == "" {
			return fmt.Errorf("deck_investigation: deck id is required")
		}
		if _, exists := deckIDs[deck.ID]; exists {
			return fmt.Errorf("deck_investigation: duplicate deck id %q", deck.ID)
		}
		if _, ok := tokenIDs[deck.TokenID]; !ok {
			return fmt.Errorf("deck_investigation: deck %q references missing token %q", deck.ID, deck.TokenID)
		}
		if deck.TokenCost < 0 {
			return fmt.Errorf("deck_investigation: deck %q tokenCost must be non-negative", deck.ID)
		}
		if deck.DrawOrder != "" && deck.DrawOrder != DrawSequential && deck.DrawOrder != DrawRandom {
			return fmt.Errorf("deck_investigation: deck %q has unsupported drawOrder %q", deck.ID, deck.DrawOrder)
		}
		for _, card := range deck.Cards {
			if err := validateCard(deck.ID, card); err != nil {
				return err
			}
		}
		deckIDs[deck.ID] = struct{}{}
	}
	return nil
}

func EvaluateAccess(config Config, deckID string, player PlayerState) (AccessDecision, error) {
	deck, ok := findDeck(config.Decks, deckID)
	if !ok {
		return AccessDecision{DeckID: deckID, Allowed: false, ReasonCode: "missing_deck"}, ErrDeckNotFound
	}

	decision := AccessDecision{DeckID: deck.ID, TokenID: deck.TokenID, TokenCost: deck.TokenCost, Allowed: false}
	if len(deck.PhaseIDs) > 0 && !slices.Contains(deck.PhaseIDs, player.PhaseID) {
		decision.ReasonCode = "wrong_phase"
		return decision, ErrDeckNotAllowed
	}
	if len(deck.LocationIDs) > 0 && !slices.Contains(deck.LocationIDs, player.LocationID) {
		decision.ReasonCode = "wrong_location"
		return decision, ErrDeckNotAllowed
	}
	if slices.Contains(deck.BlockedCharacterIDs, player.CharacterID) {
		decision.ReasonCode = "blocked_character"
		return decision, ErrDeckNotAllowed
	}
	for _, clueID := range deck.RequiredClueIDs {
		if !player.HeldClueIDs[clueID] {
			decision.ReasonCode = "missing_required_clue"
			return decision, ErrDeckNotAllowed
		}
	}
	if player.TokenBalances[deck.TokenID] < deck.TokenCost {
		decision.ReasonCode = "insufficient_token"
		return decision, ErrInsufficientToken
	}

	decision.Allowed = true
	decision.ReasonCode = "allowed"
	return decision, nil
}

func BuildDrawResult(deck DeckConfig, drawnCardIndex int) (DrawResult, bool) {
	if drawnCardIndex < 0 || drawnCardIndex >= len(deck.Cards) {
		return DrawResult{}, false
	}
	card := deck.Cards[drawnCardIndex]
	return DrawResult{DeckID: deck.ID, ClueID: card.ClueID, Delivery: card.Delivery}, true
}

func findDeck(decks []DeckConfig, deckID string) (DeckConfig, bool) {
	for _, deck := range decks {
		if deck.ID == deckID {
			return deck, true
		}
	}
	return DeckConfig{}, false
}

func validateCard(deckID string, card CardConfig) error {
	if card.ClueID == "" {
		return fmt.Errorf("deck_investigation: deck %q card clueId is required", deckID)
	}
	switch card.Delivery {
	case DeliveryPrivateOwnership, DeliveryPublicReveal, DeliveryViewOnly:
		return nil
	default:
		return fmt.Errorf("deck_investigation: deck %q has unsupported delivery %q", deckID, card.Delivery)
	}
}
