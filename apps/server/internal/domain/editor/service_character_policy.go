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
