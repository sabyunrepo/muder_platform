package editor

import (
	"fmt"

	"github.com/mmp-platform/server/internal/apperror"
)

// CharacterRolePolicy is the backend runtime interpretation of an editor
// character role. UI labels and layout must not be used as runtime truth; this
// policy keeps spoiler, culprit, and voting defaults testable without React.
type CharacterRolePolicy struct {
	MysteryRole            string
	IsCulprit              bool
	IsSpoiler              bool
	DefaultVotingCandidate bool
}

type CharacterVisibilityInput struct {
	IsPlayable        *bool
	ShowInIntro       *bool
	CanSpeakInReading *bool
	IsVotingCandidate *bool
}

type CharacterVisibilityPolicy struct {
	IsPlayable        bool
	ShowInIntro       bool
	CanSpeakInReading bool
	IsVotingCandidate bool
}

func BuildCharacterRolePolicy(role string, legacyIsCulprit bool) (CharacterRolePolicy, error) {
	normalized, err := normalizeCharacterMysteryRole(role, legacyIsCulprit)
	if err != nil {
		return CharacterRolePolicy{}, err
	}

	return CharacterRolePolicy{
		MysteryRole:            normalized,
		IsCulprit:              normalized == MysteryRoleCulprit,
		IsSpoiler:              normalized == MysteryRoleCulprit || normalized == MysteryRoleAccomplice || normalized == MysteryRoleDetective,
		DefaultVotingCandidate: normalized != MysteryRoleDetective,
	}, nil
}

func BuildCharacterVisibilityPolicy(rolePolicy CharacterRolePolicy, input CharacterVisibilityInput) CharacterVisibilityPolicy {
	isPlayable := boolPtrValue(input.IsPlayable, true)

	return CharacterVisibilityPolicy{
		IsPlayable:        isPlayable,
		ShowInIntro:       boolPtrValue(input.ShowInIntro, true),
		CanSpeakInReading: boolPtrValue(input.CanSpeakInReading, true),
		IsVotingCandidate: boolPtrValue(input.IsVotingCandidate, isPlayable && rolePolicy.DefaultVotingCandidate),
	}
}

func BuildCharacterVisibilityPolicyWithDefaults(input CharacterVisibilityInput, defaults CharacterVisibilityPolicy) CharacterVisibilityPolicy {
	return CharacterVisibilityPolicy{
		IsPlayable:        boolPtrValue(input.IsPlayable, defaults.IsPlayable),
		ShowInIntro:       boolPtrValue(input.ShowInIntro, defaults.ShowInIntro),
		CanSpeakInReading: boolPtrValue(input.CanSpeakInReading, defaults.CanSpeakInReading),
		IsVotingCandidate: boolPtrValue(input.IsVotingCandidate, defaults.IsVotingCandidate),
	}
}

func boolPtrValue(value *bool, fallback bool) bool {
	if value == nil {
		return fallback
	}
	return *value
}

func normalizeCharacterMysteryRole(role string, legacyIsCulprit bool) (string, error) {
	if role == "" {
		if legacyIsCulprit {
			return MysteryRoleCulprit, nil
		}
		return MysteryRoleSuspect, nil
	}

	switch role {
	case MysteryRoleSuspect, MysteryRoleCulprit, MysteryRoleAccomplice, MysteryRoleDetective:
		if legacyIsCulprit && role != MysteryRoleCulprit {
			return "", apperror.BadRequest("mystery_role conflicts with is_culprit")
		}
		return role, nil
	default:
		return "", apperror.BadRequest(fmt.Sprintf("invalid mystery_role: %s", role))
	}
}

func normalizeMysteryRole(role string, isCulprit bool) (string, error) {
	policy, err := BuildCharacterRolePolicy(role, isCulprit)
	if err != nil {
		return "", err
	}
	return policy.MysteryRole, nil
}
