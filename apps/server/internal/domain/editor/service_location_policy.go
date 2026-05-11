package editor

import "strings"

// LocationAccessPolicy is the backend interpretation of creator-facing place access settings.
// The editor may show friendly labels, but runtime visibility/access decisions are made here.
type LocationAccessPolicy struct {
	RestrictedCharacterIDs []string
	RestrictedCharacters   *string
}

func BuildLocationAccessPolicy(restrictedCharacters *string) LocationAccessPolicy {
	ids := parseLocationRestrictedCharacterIDs(restrictedCharacters)
	var normalized *string
	if len(ids) > 0 {
		normalized = stringPtr(strings.Join(ids, ","))
	}

	return LocationAccessPolicy{
		RestrictedCharacterIDs: ids,
		RestrictedCharacters:   normalized,
	}
}

func (p LocationAccessPolicy) IsPublic() bool {
	return len(p.RestrictedCharacterIDs) == 0
}

func (p LocationAccessPolicy) CanCharacterAccess(characterID string) bool {
	normalizedCharacterID := strings.TrimSpace(characterID)
	if len(p.RestrictedCharacterIDs) > 0 && normalizedCharacterID == "" {
		return false
	}
	for _, restrictedID := range p.RestrictedCharacterIDs {
		if restrictedID == normalizedCharacterID {
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
