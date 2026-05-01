# PR-1 Stage A·B·C — Normalizer Base (Tasks 2-4)

> 부모: `pr-1-tasks.md` · 다음: `pr-1-normalizer-clues.md`

## §A · Task 2 — Normalizer skeleton (no-op identity)

**Goal**: 새 shape input → 그대로 반환. Idempotent baseline.

- [ ] **Step 4**: `config_normalizer_test.go` 작성

```go
package editor

import (
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestNormalize_NoOpOnNewShape(t *testing.T) {
	input := json.RawMessage(`{
		"modules": {
			"voting": {"enabled": true, "config": {"mode": "open"}},
			"audio":  {"enabled": false}
		},
		"locations": [{"id": "study_room", "locationClueConfig": {"clueIds": ["c1"]}}]
	}`)

	got, err := NormalizeConfigJSON(input)
	require.NoError(t, err)

	var gotMap, wantMap map[string]any
	require.NoError(t, json.Unmarshal(got, &gotMap))
	require.NoError(t, json.Unmarshal(input, &wantMap))
	assert.Equal(t, wantMap, gotMap, "new shape input must round-trip unchanged")
}
```

- [ ] **Step 5**: 테스트 실행 → FAIL (`undefined: NormalizeConfigJSON`)

```bash
go test ./apps/server/internal/domain/editor/ -run TestNormalize_NoOpOnNewShape -v
```

- [ ] **Step 6**: `config_normalizer.go` 최소 구현

```go
package editor

import "encoding/json"

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
	return json.Marshal(cfg)
}
```

- [ ] **Step 7**: 테스트 PASS

- [ ] **Step 8**: Commit

```bash
git add apps/server/internal/domain/editor/config_normalizer{,_test}.go
git commit -m "feat(editor): add config_normalizer skeleton — D-19/D-20 base"
```

---

## §B · Task 3 — modules array → object map (D-19, backend preset legacy)

- [ ] **Step 9**: 테스트 추가

```go
func TestNormalize_ModulesArrayToMap(t *testing.T) {
	input := json.RawMessage(`{
		"modules": [
			{"id": "voting", "config": {"mode": "open"}},
			{"id": "audio"}
		]
	}`)

	got, err := NormalizeConfigJSON(input)
	require.NoError(t, err)

	var cfg map[string]any
	require.NoError(t, json.Unmarshal(got, &cfg))

	mods, ok := cfg["modules"].(map[string]any)
	require.True(t, ok, "modules must be object map after normalize")

	voting := mods["voting"].(map[string]any)
	assert.Equal(t, true, voting["enabled"])
	assert.Equal(t, map[string]any{"mode": "open"}, voting["config"])

	audio := mods["audio"].(map[string]any)
	assert.Equal(t, true, audio["enabled"])
	_, hasConfig := audio["config"]
	assert.False(t, hasConfig, "missing inline config must NOT inject empty config key")
}
```

- [ ] **Step 10**: 테스트 실행 → FAIL (현재는 array 그대로 보존)

- [ ] **Step 11**: normalizer 확장

```go
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

	// String list (frontend legacy) handled in Task 4
	if len(arr) > 0 {
		if _, isStr := arr[0].(string); isStr {
			return
		}
	}

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

// Wire into NormalizeConfigJSON:
func NormalizeConfigJSON(raw json.RawMessage) (json.RawMessage, error) {
	if len(raw) == 0 {
		return raw, nil
	}
	var cfg map[string]any
	if err := json.Unmarshal(raw, &cfg); err != nil {
		return nil, err
	}
	normalizeModules(cfg)
	return json.Marshal(cfg)
}
```

- [ ] **Step 12**: 테스트 실행 → PASS, Step 4 테스트도 PASS (no-op idempotent 보장)

- [ ] **Step 13**: Commit

```bash
git commit -am "feat(editor): normalize modules array → object map (D-19 preset legacy)"
```

---

## §C · Task 4 — modules string[] + module_configs → map (D-19, frontend legacy)

- [ ] **Step 14**: 테스트 추가

```go
func TestNormalize_ModulesStringListPlusConfigsMap(t *testing.T) {
	input := json.RawMessage(`{
		"modules": ["voting", "audio"],
		"module_configs": {
			"voting": {"mode": "open", "minParticipation": 75}
		}
	}`)

	got, err := NormalizeConfigJSON(input)
	require.NoError(t, err)

	var cfg map[string]any
	require.NoError(t, json.Unmarshal(got, &cfg))

	mods := cfg["modules"].(map[string]any)
	voting := mods["voting"].(map[string]any)
	assert.Equal(t, true, voting["enabled"])
	assert.Equal(t, float64(75), voting["config"].(map[string]any)["minParticipation"])

	audio := mods["audio"].(map[string]any)
	assert.Equal(t, true, audio["enabled"])
	_, hasConfig := audio["config"]
	assert.False(t, hasConfig)

	_, hasOldKey := cfg["module_configs"]
	assert.False(t, hasOldKey, "module_configs key must be removed after normalize")
}
```

- [ ] **Step 15**: 테스트 실행 → FAIL

- [ ] **Step 16**: `normalizeModules` 확장 — string[] + module_configs 케이스 (Task 3의 string list early-return 자리에 실 처리 추가)

```go
func normalizeModules(cfg map[string]any) {
	rawMods, exists := cfg["modules"]
	if !exists {
		return
	}
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
```

- [ ] **Step 17**: 테스트 실행 → ALL PASS (Task 2/3 회귀 0)

- [ ] **Step 18**: Commit

```bash
git commit -am "feat(editor): normalize modules string[] + module_configs (D-19 frontend legacy)"
```
