# PR-1 Stage D·E·F — Normalizer Clues (Tasks 5-7)

> 부모: `pr-1-tasks.md` · 이전: `pr-1-normalizer-base.md` · 다음: `pr-1-integration.md`

## §A · Task 5 — clue_placement → locationClueConfig.clueIds (D-20)

- [ ] **Step 19**: 테스트 추가

```go
func TestNormalize_CluePlacementToLocations(t *testing.T) {
	input := json.RawMessage(`{
		"clue_placement": {"c1": "library", "c2": "study_room"},
		"locations": [
			{"id": "library"},
			{"id": "study_room"}
		]
	}`)

	got, err := NormalizeConfigJSON(input)
	require.NoError(t, err)

	var cfg map[string]any
	require.NoError(t, json.Unmarshal(got, &cfg))

	locs := cfg["locations"].([]any)
	library := locs[0].(map[string]any)
	libraryClueCfg := library["locationClueConfig"].(map[string]any)
	assert.Equal(t, []any{"c1"}, libraryClueCfg["clueIds"])

	study := locs[1].(map[string]any)
	studyClueCfg := study["locationClueConfig"].(map[string]any)
	assert.Equal(t, []any{"c2"}, studyClueCfg["clueIds"])

	_, hasOldKey := cfg["clue_placement"]
	assert.False(t, hasOldKey, "clue_placement key must be removed after normalize")
}
```

- [ ] **Step 20**: 테스트 실행 → FAIL

- [ ] **Step 21**: `normalizeClueLocations` 헬퍼 추가 (Task 6에서 union 확장)

```go
func normalizeClueLocations(cfg map[string]any) {
	cluePlacement, hasPlacement := cfg["clue_placement"].(map[string]any)
	locsRaw, hasLocs := cfg["locations"].([]any)
	if !hasLocs {
		return
	}

	placementByLoc := make(map[string][]string)
	if hasPlacement {
		for clueID, locVal := range cluePlacement {
			if locID, ok := locVal.(string); ok {
				placementByLoc[locID] = append(placementByLoc[locID], clueID)
			}
		}
	}

	for _, locRaw := range locsRaw {
		loc, ok := locRaw.(map[string]any)
		if !ok {
			continue
		}
		locID, _ := loc["id"].(string)

		ids := placementByLoc[locID]

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

// In NormalizeConfigJSON, after normalizeModules(cfg):
// 	normalizeClueLocations(cfg)
```

- [ ] **Step 22**: 테스트 PASS

- [ ] **Step 23**: Commit

```bash
git commit -am "feat(editor): normalize clue_placement → locationClueConfig.clueIds (D-20)"
```

---

## §B · Task 6 — Dead key Union 병합 + DEBUG 충돌 로그 (D-21)

- [ ] **Step 24**: 테스트 추가 — `clue_placement` 우선 + dead key 보충 + 충돌 케이스

```go
func TestNormalize_DeadKeyUnion_PriorityCluePlacement(t *testing.T) {
	// c1: clue_placement says library, dead key says study_room → CONFLICT (placement wins)
	// c5: only in dead key → study_room (보충)
	// c9: only in clue_placement → library
	input := json.RawMessage(`{
		"clue_placement": {"c1": "library", "c9": "library"},
		"locations": [
			{"id": "library"},
			{"id": "study_room", "clueIds": ["c1", "c5"]}
		]
	}`)

	got, err := NormalizeConfigJSON(input)
	require.NoError(t, err)

	var cfg map[string]any
	require.NoError(t, json.Unmarshal(got, &cfg))

	locs := cfg["locations"].([]any)

	library := locs[0].(map[string]any)
	libraryIDs := library["locationClueConfig"].(map[string]any)["clueIds"].([]any)
	assert.ElementsMatch(t, []any{"c1", "c9"}, libraryIDs, "placement wins for c1; c9 placement-only included")

	study := locs[1].(map[string]any)
	studyIDs := study["locationClueConfig"].(map[string]any)["clueIds"].([]any)
	assert.ElementsMatch(t, []any{"c5"}, studyIDs, "c5 dead-key-only preserved; c1 NOT here (conflict resolved to library)")

	_, hasDeadKey := study["clueIds"]
	assert.False(t, hasDeadKey, "locations[].clueIds dead key must be removed after normalize")
}
```

- [ ] **Step 25**: 테스트 실행 → FAIL

- [ ] **Step 26**: `normalizeClueLocations` 확장 — union with conflict resolution + DEBUG log

```go
import (
	"sort"

	"github.com/rs/zerolog/log"
)

func normalizeClueLocations(cfg map[string]any) {
	cluePlacement, _ := cfg["clue_placement"].(map[string]any)
	locsRaw, hasLocs := cfg["locations"].([]any)
	if !hasLocs {
		return
	}

	// locationId → set of clueIds (placement)
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

		// Union with dead key, but skip if placement says elsewhere
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
```

- [ ] **Step 27**: 테스트 ALL PASS (Task 5 회귀 0)

- [ ] **Step 28**: Commit

```bash
git commit -am "feat(editor): union merge dead key locations[].clueIds with placement priority (D-21)"
```

---

## §C · Task 7 — character_clues → starting_clue 모듈 (D-20)

- [ ] **Step 29**: 테스트 추가

```go
func TestNormalize_CharacterCluesToStartingClueModule(t *testing.T) {
	input := json.RawMessage(`{
		"character_clues": {"김철수": ["c1", "c2"], "박민수": ["c3"]},
		"modules": ["starting_clue"]
	}`)

	got, err := NormalizeConfigJSON(input)
	require.NoError(t, err)

	var cfg map[string]any
	require.NoError(t, json.Unmarshal(got, &cfg))

	mods := cfg["modules"].(map[string]any)
	startingClue := mods["starting_clue"].(map[string]any)
	startingMap := startingClue["config"].(map[string]any)["startingClues"].(map[string]any)

	assert.Equal(t, []any{"c1", "c2"}, startingMap["김철수"])
	assert.Equal(t, []any{"c3"}, startingMap["박민수"])

	_, hasOldKey := cfg["character_clues"]
	assert.False(t, hasOldKey)
}
```

- [ ] **Step 30**: 테스트 실행 → FAIL

- [ ] **Step 31**: `normalizeCharacterClues` 추가 + `NormalizeConfigJSON` 호출 순서 = modules normalize 후

```go
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

// NormalizeConfigJSON 호출 순서:
// 	normalizeModules(cfg)
// 	normalizeClueLocations(cfg)
// 	normalizeCharacterClues(cfg)
```

- [ ] **Step 32**: 테스트 PASS

- [ ] **Step 33**: Commit

```bash
git commit -am "feat(editor): normalize character_clues → starting_clue module (D-20)"
```
