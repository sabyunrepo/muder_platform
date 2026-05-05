package editor

// NOTE(PR-future): consider relocating to internal/domain/editor/migration/ when legacy support is removed (D-20 +1 PR drop).

import (
	"bytes"
	"encoding/json"
	"sort"

	"github.com/rs/zerolog/log"
)

// hasLegacyKeys sniffs raw JSON bytes for known legacy keys without a full
// unmarshal. Returns true if any legacy transformation is needed.
//
// Trade-off: `"modules":[` / `"modules": [` sniff has a theoretical
// false-positive if a string value contains that exact byte sequence. Worst
// case = unnecessary normalize round-trip (no corruption). Acceptable given
// the ~500-2000 alloc savings on the hot GetTheme read path.
//
// Both compact (`"modules":[`) and pretty-printed (`"modules": [`) forms are
// matched to handle raw blobs from any serializer.
func hasLegacyKeys(raw json.RawMessage) bool {
	return len(legacyConfigAxes(raw)) > 0
}

func legacyConfigAxes(raw json.RawMessage) []string {
	axes := make([]string, 0, 5)
	if bytes.Contains(raw, []byte(`"clue_placement"`)) {
		axes = append(axes, "clue_placement")
	}
	if bytes.Contains(raw, []byte(`"module_configs"`)) {
		axes = append(axes, "module_configs")
	}
	if bytes.Contains(raw, []byte(`"character_clues"`)) {
		axes = append(axes, "character_clues")
	}
	if bytes.Contains(raw, []byte(`"modules":[`)) ||
		bytes.Contains(raw, []byte(`"modules": [`)) {
		axes = append(axes, "modules_array")
	}
	// Dead-key-only legacy: locations[].clueIds present but locationClueConfig is
	// absent on the same location. A blob may mix already-normalized locations
	// with legacy ones, so this check must be location-scoped.
	if hasLegacyLocationClueIDs(raw) {
		axes = append(axes, "locations_clueIds")
	}
	return axes
}

func hasLegacyLocationClueIDs(raw json.RawMessage) bool {
	if !bytes.Contains(raw, []byte(`"clueIds"`)) {
		return false
	}

	var cfg struct {
		Locations []json.RawMessage `json:"locations"`
	}
	if err := json.Unmarshal(raw, &cfg); err != nil {
		return false
	}
	for _, locRaw := range cfg.Locations {
		var loc map[string]json.RawMessage
		if err := json.Unmarshal(locRaw, &loc); err != nil {
			continue
		}
		if _, hasDeadKey := loc["clueIds"]; !hasDeadKey {
			continue
		}
		if _, hasCanonicalKey := loc["locationClueConfig"]; !hasCanonicalKey {
			return true
		}
	}
	return false
}

// NormalizeConfigJSON converts legacy theme.config_json shapes (D-19/D-20/D-21)
// into the canonical Phase 24 shape (single-map modules + entity-attached configs).
// New-shape input is returned unchanged (lazy-on-read, idempotent).
func NormalizeConfigJSON(raw json.RawMessage) (json.RawMessage, error) {
	if len(raw) == 0 {
		return raw, nil
	}
	// M4: early-bypass for already-normalized blobs — zero allocs on hot read path.
	// json.Valid guards against returning invalid JSON silently (e.g. DB corruption);
	// if invalid, fall through to the unmarshal path which returns a proper error.
	if !hasLegacyKeys(raw) && json.Valid(raw) {
		return raw, nil
	}
	var cfg map[string]any
	if err := json.Unmarshal(raw, &cfg); err != nil {
		return nil, err
	}
	normalizeModules(cfg)
	normalizeClueLocations(cfg)
	normalizeCharacterClues(cfg)
	return json.Marshal(cfg)
}

func normalizeModules(cfg map[string]any) {
	rawMods, exists := cfg["modules"]
	if !exists {
		return
	}

	// Already new shape — but may still carry a stale module_configs key from a
	// partial migration (D-19 partial write). Absorb any extra config entries
	// into the existing map entries, then delete the legacy key so the namespace
	// is fully consolidated (D-19 single-namespace invariant).
	if modsMap, ok := rawMods.(map[string]any); ok {
		if legacyCfgs, ok := cfg["module_configs"].(map[string]any); ok {
			for id, c := range legacyCfgs {
				entry, _ := modsMap[id].(map[string]any)
				if entry == nil {
					entry = map[string]any{"enabled": true}
				}
				if _, exists := entry["config"]; !exists {
					entry["config"] = c
				}
				modsMap[id] = entry
			}
			delete(cfg, "module_configs")
		}
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
			log.Warn().Interface("item", item).Str("field", "modules[]").Msg("normalizer: skipping malformed legacy item — DB may have corruption")
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

// normalizeClueLocations is the coordinator that runs the four sub-steps in
// order: index, merge, orphan-log, cleanup.
func normalizeClueLocations(cfg map[string]any) {
	locsRaw, hasLocs := cfg["locations"].([]any)
	// Nothing to do if no legacy location data at all.
	if !hasLocs {
		return
	}
	placementByLoc, placementOf := buildPlacementIndex(cfg)
	iteratedLocs := mergeLocations(locsRaw, placementByLoc, placementOf)
	logOrphans(placementByLoc, iteratedLocs)
	delete(cfg, "clue_placement")
}

// buildPlacementIndex parses clue_placement into two lookup maps.
// placementByLoc: locationId → set of clueIds (authoritative assignment).
// placementOf: clueId → locationId (reverse index for conflict detection, D-21).
func buildPlacementIndex(cfg map[string]any) (placementByLoc map[string]map[string]struct{}, placementOf map[string]string) {
	placementByLoc = make(map[string]map[string]struct{})
	placementOf = make(map[string]string)
	cluePlacement, ok := cfg["clue_placement"].(map[string]any)
	if !ok {
		return
	}
	for clueID, locVal := range cluePlacement {
		locID, ok := locVal.(string)
		if !ok {
			log.Warn().Str("clueId", clueID).Interface("value", locVal).Str("field", "clue_placement").Msg("normalizer: skipping malformed legacy item — DB may have corruption")
			continue
		}
		if placementByLoc[locID] == nil {
			placementByLoc[locID] = map[string]struct{}{}
		}
		placementByLoc[locID][clueID] = struct{}{}
		placementOf[clueID] = locID
	}
	return
}

// mergeLocations iterates locations[], unions placement + dead-key clueIds
// (placement wins on conflict per D-21), writes locationClueConfig.clueIds,
// removes dead clueIds key, and returns the set of iterated locationIds.
func mergeLocations(locsRaw []any, placementByLoc map[string]map[string]struct{}, placementOf map[string]string) map[string]struct{} {
	iteratedLocs := make(map[string]struct{})
	for _, locRaw := range locsRaw {
		loc, ok := locRaw.(map[string]any)
		if !ok {
			log.Warn().Interface("item", locRaw).Str("field", "locations[]").Msg("normalizer: skipping malformed legacy item — DB may have corruption")
			continue
		}
		locID, _ := loc["id"].(string)
		iteratedLocs[locID] = struct{}{}

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
	return iteratedLocs
}

// logOrphans emits Debug logs for clue_placement entries whose target
// locationId was never encountered in locations[] — these clues are silently
// dropped when clue_placement is deleted (M1 / D-20).
func logOrphans(placementByLoc map[string]map[string]struct{}, iteratedLocs map[string]struct{}) {
	for locID, clueSet := range placementByLoc {
		if _, consumed := iteratedLocs[locID]; !consumed {
			for clueID := range clueSet {
				log.Debug().
					Str("clueId", clueID).
					Str("orphanLocation", locID).
					Msg("clue_placement references unknown locationId — clue dropped (D-20)")
			}
		}
	}
}

func normalizeCharacterClues(cfg map[string]any) {
	charClues, hasOld := cfg["character_clues"].(map[string]any)
	if !hasOld {
		return
	}
	mods, ok := cfg["modules"].(map[string]any)
	if !ok {
		return
	}

	startingClueEntry, _ := mods["starting_clue"].(map[string]any)
	if startingClueEntry == nil {
		startingClueEntry = map[string]any{"enabled": true}
	}
	conf, _ := startingClueEntry["config"].(map[string]any)
	if conf == nil {
		conf = map[string]any{}
	}
	conf["startingClues"] = charClues
	startingClueEntry["config"] = conf
	mods["starting_clue"] = startingClueEntry

	delete(cfg, "character_clues")
}
