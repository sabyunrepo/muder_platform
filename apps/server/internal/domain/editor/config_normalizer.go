package editor

import (
	"encoding/json"
	"sort"
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

	placementByLoc := make(map[string][]string)
	for clueID, locVal := range cluePlacement {
		if locID, ok := locVal.(string); ok {
			placementByLoc[locID] = append(placementByLoc[locID], clueID)
		}
	}

	for _, locRaw := range locsRaw {
		loc, ok := locRaw.(map[string]any)
		if !ok {
			continue
		}
		locID, _ := loc["id"].(string)

		ids := placementByLoc[locID]
		sort.Strings(ids)

		clueCfg, _ := loc["locationClueConfig"].(map[string]any)
		if clueCfg == nil {
			clueCfg = map[string]any{}
		}
		out := make([]any, 0, len(ids))
		for _, id := range ids {
			out = append(out, id)
		}
		clueCfg["clueIds"] = out
		loc["locationClueConfig"] = clueCfg
	}

	delete(cfg, "clue_placement")
}
