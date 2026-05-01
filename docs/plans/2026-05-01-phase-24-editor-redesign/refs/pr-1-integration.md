# PR-1 Stage G·H — Integration (Tasks 8-9)

> 부모: `pr-1-tasks.md` · 이전: `pr-1-normalizer-clues.md` · 다음: `pr-1-ending-branch.md`
>
> **기존 인프라**: `setupFixture(t)` (`test_fixture_test.go:37`), `f.createUser(t)`, `f.createThemeForUser(t, creatorID)`, `f.svc` 등. 새 helper 작성 X — 기존 패턴 재사용.
>
> **실제 API 시그니처**:
> - `service.GetTheme(ctx, creatorID, themeID uuid.UUID) (*ThemeResponse, error)` (`themes.go:129`)
> - `service.UpdateConfigJson(ctx, creatorID, themeID uuid.UUID, config json.RawMessage) (*ThemeResponse, error)` (`service_config.go:21`)

## §A · Task 8 — themes.go GetTheme read path 적용 (D-20)

- [ ] **Step 34**: 기존 read 경로 위치 파악 + 신설 fixture helper 1개 (raw INSERT 우회)

```bash
# Use QMD to search docs/plans and memory (grep is not preferred per .claude/refs/qmd-rules.md)
# mcp__plugin_qmd_qmd__search collection=mmp-plans query="func GetTheme ListThemes GetThemeBy theme.ConfigJson"
# mcp__plugin_qmd_qmd__search collection=mmp-plans query="createThemeForUser test_fixture_test.go"
```

기존 `f.createThemeForUser(t, creatorID)`는 빈 config_json으로 생성. **레거시 shape 직접 삽입 helper** 가 필요 → `test_fixture_test.go`에 1개 추가:

```go
// In test_fixture_test.go (extend existing fixture)
func (f *testFixture) insertThemeWithRawConfig(t *testing.T, creatorID uuid.UUID, raw json.RawMessage) uuid.UUID {
	t.Helper()
	themeID := uuid.New()
	_, err := f.q.CreateTheme(context.Background(), db.CreateThemeParams{
		ID:         themeID,
		CreatorID:  creatorID,
		Title:      "legacy-shape-test",
		Slug:       "legacy-" + themeID.String()[:8],
		ConfigJson: raw,
		// ... 기존 createThemeForUser와 동일 default 필드
	})
	require.NoError(t, err)
	return themeID
}
```

- [ ] **Step 35**: 통합 테스트 추가 — `service_themes_test.go` 또는 새 `themes_normalize_test.go`

```go
func TestGetTheme_AppliesNormalizer(t *testing.T) {
	f := setupFixture(t)
	ctx := context.Background()
	creatorID := f.createUser(t)

	// Insert legacy shape directly (bypass UpdateConfigJson write validation)
	legacy := json.RawMessage(`{
		"modules": [{"id": "voting"}],
		"clue_placement": {"c1": "library"},
		"locations": [{"id": "library"}]
	}`)
	themeID := f.insertThemeWithRawConfig(t, creatorID, legacy)

	got, err := f.svc.GetTheme(ctx, creatorID, themeID)
	require.NoError(t, err)

	var cfg map[string]any
	require.NoError(t, json.Unmarshal(got.ConfigJson, &cfg))

	mods := cfg["modules"].(map[string]any)
	require.Contains(t, mods, "voting")

	locs := cfg["locations"].([]any)
	libraryIDs := locs[0].(map[string]any)["locationClueConfig"].(map[string]any)["clueIds"].([]any)
	assert.Equal(t, []any{"c1"}, libraryIDs)

	_, hasOldKey := cfg["clue_placement"]
	assert.False(t, hasOldKey, "lazy-on-read: clue_placement absent in response")
}
```

- [ ] **Step 36**: 테스트 실행 → FAIL (현재 raw 그대로 반환)

```bash
go test ./apps/server/internal/domain/editor/ -run TestGetTheme_AppliesNormalizer -v
```

- [ ] **Step 37**: `themes.go:129` GetTheme 반환 직전 normalizer 호출

```go
// In service.GetTheme (after fetching theme from repo):
func (s *service) GetTheme(ctx context.Context, creatorID, themeID uuid.UUID) (*ThemeResponse, error) {
	theme, err := s.repo.GetThemeByID(ctx, themeID) // existing call
	if err != nil {
		return nil, err
	}
	// ... existing ownership/visibility checks
	normalized, err := NormalizeConfigJSON(theme.ConfigJson)
	if err != nil {
		return nil, fmt.Errorf("normalize config_json for theme %s: %w", themeID, err)
	}
	theme.ConfigJson = normalized
	return toThemeResponse(theme), nil
}
```

- [ ] **Step 38**: 다른 read 경로 동일 적용 — QMD 로 확인

```bash
# Use QMD to search docs/plans and memory (grep is not preferred per .claude/refs/qmd-rules.md)
# mcp__plugin_qmd_qmd__search collection=mmp-plans query="ConfigJson read path ListThemes GetThemeBySlug"
```

발견된 read 경로 (예: `ListThemes`, `GetThemeBySlug`, `handler.GetTheme` 직접 read 등)에 normalizer 호출 추가. 각 경로마다 동일 테스트 1개씩.

- [ ] **Step 39**: 테스트 ALL PASS (기존 themes 테스트 회귀 0 확인)

- [ ] **Step 40**: Commit

```bash
git commit -am "feat(editor): apply normalizer on themes read path (D-20 lazy on read)"
```

---

## §B · Task 9 — service_config.go write validate (forward-only)

- [ ] **Step 41**: 테스트 추가 — 옛 shape write 시 거부

```go
func TestUpdateConfigJson_RejectsLegacyShape(t *testing.T) {
	f := setupFixture(t)
	ctx := context.Background()
	creatorID := f.createUser(t)
	themeID := f.createThemeForUser(t, creatorID) // empty config_json

	cases := []struct {
		name  string
		input json.RawMessage
		want  string
	}{
		{
			name:  "modules array",
			input: json.RawMessage(`{"modules": [{"id": "voting"}]}`),
			want:  "legacy modules shape rejected (D-19)",
		},
		{
			name:  "modules null",
			input: json.RawMessage(`{"modules": null}`),
			want:  "modules cannot be null",
		},
		{
			name:  "clue_placement key",
			input: json.RawMessage(`{"modules": {}, "clue_placement": {"c1": "library"}}`),
			want:  "legacy clue_placement key rejected (D-20)",
		},
		{
			name:  "module_configs key",
			input: json.RawMessage(`{"modules": {"voting": {"enabled": true}}, "module_configs": {}}`),
			want:  "legacy module_configs key rejected (D-19)",
		},
		{
			name:  "character_clues key",
			input: json.RawMessage(`{"modules": {}, "character_clues": {}}`),
			want:  "legacy character_clues key rejected (D-20)",
		},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			_, err := f.svc.UpdateConfigJson(ctx, creatorID, themeID, tc.input)
			require.Error(t, err)
			assert.Contains(t, err.Error(), tc.want)
		})
	}
}
```

- [ ] **Step 42**: 테스트 실행 → FAIL (현재 통과)

- [ ] **Step 43**: `service_config.go:21` UpdateConfigJson 진입에 validation

```go
func (s *service) UpdateConfigJson(ctx context.Context, creatorID, themeID uuid.UUID, config json.RawMessage) (*ThemeResponse, error) {
	if err := validateConfigShape(config); err != nil {
		return nil, apperror.BadRequest(err.Error())
	}
	// ... existing optimistic-lock logic
}

func validateConfigShape(raw json.RawMessage) error {
	if len(raw) == 0 {
		return nil
	}
	var cfg map[string]any
	if err := json.Unmarshal(raw, &cfg); err != nil {
		return fmt.Errorf("config_json: invalid JSON: %w", err)
	}
	if mods, ok := cfg["modules"]; ok {
		if _, isMap := mods.(map[string]any); !isMap {
			return fmt.Errorf("config_json: legacy modules shape rejected (D-19) — must be {[id]: {enabled, config?}} object map")
		}
	}
	if _, hasOld := cfg["clue_placement"]; hasOld {
		return fmt.Errorf("config_json: legacy clue_placement key rejected (D-20) — use locations[].locationClueConfig.clueIds")
	}
	if _, hasOld := cfg["module_configs"]; hasOld {
		return fmt.Errorf("config_json: legacy module_configs key rejected (D-19) — embed config inside modules[id].config")
	}
	if _, hasOld := cfg["character_clues"]; hasOld {
		return fmt.Errorf("config_json: legacy character_clues key rejected (D-20) — use modules.starting_clue.config.startingClues")
	}
	return nil
}
```

- [ ] **Step 44**: 테스트 PASS (4 케이스 모두)

- [ ] **Step 45**: 회귀 — 새 shape write는 통과 확인

```go
func TestUpdateConfigJson_AcceptsNewShape(t *testing.T) {
	f := setupFixture(t)
	ctx := context.Background()
	creatorID := f.createUser(t)
	themeID := f.createThemeForUser(t, creatorID)

	newShape := json.RawMessage(`{
		"modules": {"voting": {"enabled": true, "config": {"mode": "open"}}},
		"locations": [{"id": "library", "locationClueConfig": {"clueIds": ["c1"]}}]
	}`)

	updated, err := f.svc.UpdateConfigJson(ctx, creatorID, themeID, newShape)
	require.NoError(t, err)
	assert.Greater(t, updated.Version, int32(1))
}
```

- [ ] **Step 46**: 모든 editor 도메인 테스트 PASS

```bash
go test ./apps/server/internal/domain/editor/ -v
```

- [ ] **Step 47**: Commit

```bash
git commit -am "feat(editor): reject legacy config shape on write (D-19/D-20 forward-only)"
```
