package editor

import (
	"encoding/json"
	"sort"

	"github.com/rs/zerolog/log"
)

// NormalizeConfigJSON converts legacy theme.config_json shapes (D-19/D-20/D-21)
// into the canonical Phase 24 shape (single-map modules + entity-attached configs).
// New-shape input is returned unchanged (lazy-on-read, idempotent).
func NormalizeConfigJSON(raw json.RawMessage) (json.RawMessage, error) {
	if len(raw) == 0 {
		return raw, nil
	}
	var cfg map[string]any
	if err := json.Unmarshal(raw, &cfg); err != nil {
		return nil, err
	}
	normalizeModules(cfg)
	normalizeClueLocations(cfg)
	return json.Marshal(cfg)
}

func normalizeModules(cfg map[string]any) {
	rawMods, exists := cfg["modules"]
	if !exists {
		return
	}

	// Already new shape
	if _, ok := rawMods.(map[string]any); ok {
		return
	}

	arr, ok := rawMods.([]any)
	if !ok {
		return
	}

	// Frontend legacy: ["voting", "audio"] + cfg["module_configs"]
	if len(arr) > 0 {
		if _, isStr := arr[0].(string); isStr {
			configs, _ := cfg["module_configs"].(map[string]any)
			out := make(map[string]any, len(arr))
			for _, item := range arr {
				id, _ := item.(string)
				if id == "" {
					continue
				}
				entry := map[string]any{"enabled": true}
				if c, hasCfg := configs[id]; hasCfg {
					entry["config"] = c
				}
				out[id] = entry
			}
			cfg["modules"] = out
			delete(cfg, "module_configs")
			return
		}
	}

	// Backend preset legacy: [{id, config?}, ...]
	out := make(map[string]any, len(arr))
	for _, item := range arr {
		obj, ok := item.(map[string]any)
		if !ok {
			continue
		}
		id, _ := obj["id"].(string)
		if id == "" {
			continue
		}
		entry := map[string]any{"enabled": true}
		if conf, hasConf := obj["config"]; hasConf {
			entry["config"] = conf
		}
		out[id] = entry
	}
	cfg["modules"] = out
}

func normalizeClueLocations(cfg map[string]any) {
	cluePlacement, hasPlacement := cfg["clue_placement"].(map[string]any)
	locsRaw, hasLocs := cfg["locations"].([]any)
	// Nothing to do if no legacy clue_placement key
	if !hasPlacement || !hasLocs {
		return
	}

	// locationId → set of clueIds (placement, authoritative)
	placementByLoc := make(map[string]map[string]struct{})
	// clueId → locationId (reverse, for conflict detection)
	placementOf := make(map[string]string)
	for clueID, locVal := range cluePlacement {
		locID, ok := locVal.(string)
		if !ok {
			continue
		}
		if placementByLoc[locID] == nil {
			placementByLoc[locID] = map[string]struct{}{}
		}
		placementByLoc[locID][clueID] = struct{}{}
		placementOf[clueID] = locID
	}

	for _, locRaw := range locsRaw {
		loc, ok := locRaw.(map[string]any)
		if !ok {
			continue
		}
		locID, _ := loc["id"].(string)

		// Start with placement set (authoritative)
		ids := map[string]struct{}{}
		for cid := range placementByLoc[locID] {
			ids[cid] = struct{}{}
		}

		// Union with dead key, but skip if placement says elsewhere (D-21)
		if deadKeyIDs, ok := loc["clueIds"].([]any); ok {
			for _, idAny := range deadKeyIDs {
				cid, ok := idAny.(string)
				if !ok {
					continue
				}
				if placementLoc, hasPlacement := placementOf[cid]; hasPlacement && placementLoc != locID {
					log.Debug().
						Str("clueId", cid).
						Str("placement", placementLoc).
						Str("deadKeyLocation", locID).
						Msg("clue_placement conflict with dead key locations[].clueIds — placement wins (D-21)")
					continue
				}
				ids[cid] = struct{}{}
			}
			delete(loc, "clueIds")
		}

		// Sort for deterministic output
		sorted := make([]string, 0, len(ids))
		for cid := range ids {
			sorted = append(sorted, cid)
		}
		sort.Strings(sorted)
		out := make([]any, 0, len(sorted))
		for _, cid := range sorted {
			out = append(out, cid)
		}

		clueCfg, _ := loc["locationClueConfig"].(map[string]any)
		if clueCfg == nil {
			clueCfg = map[string]any{}
		}
		clueCfg["clueIds"] = out
		loc["locationClueConfig"] = clueCfg
	}

	delete(cfg, "clue_placement")
}
