package editor

import "strings"

// LocationAccessPolicy is the backend interpretation of creator-facing place access settings.
// The editor may show friendly labels, but runtime visibility/access decisions are made here.
type LocationAccessPolicy struct {
	RestrictedCharacterIDs []string
	RestrictedCharacters   *string
	FromRound              *int32
	UntilRound             *int32
}

func BuildLocationAccessPolicy(restrictedCharacters *string, fromRound, untilRound *int32) (LocationAccessPolicy, error) {
	if err := validateLocationRoundOrder(fromRound, untilRound); err != nil {
		return LocationAccessPolicy{}, err
	}

	ids := parseLocationRestrictedCharacterIDs(restrictedCharacters)
	var normalized *string
	if len(ids) > 0 {
		normalized = stringPtr(strings.Join(ids, ","))
	}

	return LocationAccessPolicy{
		RestrictedCharacterIDs: ids,
		RestrictedCharacters:   normalized,
		FromRound:              fromRound,
		UntilRound:             untilRound,
	}, nil
}

func (p LocationAccessPolicy) IsPublic() bool {
	return len(p.RestrictedCharacterIDs) == 0
}

func (p LocationAccessPolicy) IsVisibleInRound(round int32) bool {
	if p.FromRound != nil && round < *p.FromRound {
		return false
	}
	if p.UntilRound != nil && round > *p.UntilRound {
		return false
	}
	return true
}

func (p LocationAccessPolicy) CanCharacterAccess(characterID string, round int32) bool {
	if !p.IsVisibleInRound(round) {
		return false
	}
	for _, restrictedID := range p.RestrictedCharacterIDs {
		if restrictedID == characterID {
			return false
		}
	}
	return true
}

func parseLocationRestrictedCharacterIDs(value *string) []string {
	if value == nil {
		return nil
	}
	seen := make(map[string]struct{})
	ids := make([]string, 0)
	for _, raw := range strings.Split(*value, ",") {
		id := strings.TrimSpace(raw)
		if id == "" {
			continue
		}
		if _, exists := seen[id]; exists {
			continue
		}
		seen[id] = struct{}{}
		ids = append(ids, id)
	}
	return ids
}
