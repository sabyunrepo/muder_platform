package editor

import (
	"fmt"

	"github.com/mmp-platform/server/internal/apperror"
)

const (
	ClueUseEffectPeek   = "peek"
	ClueUseEffectSteal  = "steal"
	ClueUseEffectReveal = "reveal"
	ClueUseEffectBlock  = "block"
	ClueUseEffectSwap   = "swap"

	ClueUseTargetPlayer = "player"
	ClueUseTargetClue   = "clue"
	ClueUseTargetSelf   = "self"
)

// ClueUsePolicy is the backend interpretation of editor clue use settings.
// React labels and form state are not runtime truth; this policy keeps effect,
// target, and consumption rules testable without rendering the editor UI.
type ClueUsePolicy struct {
	IsUsable    bool
	UseEffect   *string
	UseTarget   *string
	UseConsumed bool
}

func BuildClueUsePolicy(isUsable bool, effect, target *string, consumed bool) (ClueUsePolicy, error) {
	if !isUsable {
		return ClueUsePolicy{IsUsable: false}, nil
	}

	normalizedEffect := valueOrDefault(effect, ClueUseEffectPeek)
	defaultTarget, err := defaultClueUseTarget(normalizedEffect)
	if err != nil {
		return ClueUsePolicy{}, err
	}

	normalizedTarget := valueOrDefault(target, defaultTarget)
	if normalizedTarget != defaultTarget {
		return ClueUsePolicy{}, apperror.BadRequest(fmt.Sprintf("use_target %q is not valid for use_effect %q", normalizedTarget, normalizedEffect))
	}

	return ClueUsePolicy{
		IsUsable:    true,
		UseEffect:   stringPtr(normalizedEffect),
		UseTarget:   stringPtr(normalizedTarget),
		UseConsumed: consumed,
	}, nil
}

func defaultClueUseTarget(effect string) (string, error) {
	switch effect {
	case ClueUseEffectPeek, ClueUseEffectSteal, ClueUseEffectBlock:
		return ClueUseTargetPlayer, nil
	case ClueUseEffectReveal:
		return ClueUseTargetSelf, nil
	case ClueUseEffectSwap:
		return ClueUseTargetClue, nil
	default:
		return "", apperror.BadRequest(fmt.Sprintf("invalid use_effect: %s", effect))
	}
}

func valueOrDefault(value *string, fallback string) string {
	if value == nil || *value == "" {
		return fallback
	}
	return *value
}

func stringPtr(value string) *string {
	return &value
}
