<!-- STATUS-START -->
**Active**: Phase 18.4 에디터 UX Bugfix — Wave 0/3
**PR**: PR-1 (0%)
**Task**: 대기 — /plan-go 실행 시작
**State**: pending
**Blockers**: none
**Last updated**: 2026-04-15
<!-- STATUS-END -->

# Phase 18.4 에디터 UX Bugfix 체크리스트

> 부모: [design.md](design.md) | 실행: [plan.md](plan.md)

---

## Wave 0 — 백엔드 라우트/쿼리 정상화 (parallel ×2)

### PR-1: Backend route fixes
- [ ] Task 1 — `apps/server/cmd/server/main.go`: `r.Get("/templates", templateHandler.ListTemplates)` 등록 (public 라우터 적절한 그룹)
- [ ] Task 2 — flow PATCH 계약 유지 확인 (백엔드는 변경 없음, 프론트에서 PATCH로 정리됨을 주석으로 기록)
- [ ] Task 3 — `apps/server/internal/domain/server/template_handler.go` 기존 ListTemplates 동작 검증 + nil slice → `[]` 반환 보정
- [ ] Task 4 — httptest 스모크: GET /templates 200, 빈 배열 시 `[]` 반환

**PR-1 gate**:
- [ ] `go test -race ./internal/domain/server/... ./cmd/server/...` pass
- [ ] `curl :3000/api/v1/templates` → 200

### PR-2: clue-relations + config 409 강화
- [ ] Task 1 — `clue_relation_handler.go`: ErrNoRows 분기 → 200 + `{relations:[], mode:"AND"}` 반환
- [ ] Task 2 — `service.UpdateThemeConfigJson`: 409 응답에 AppError extension `current_version` + `current_config` 포함
- [ ] Task 3 — `apperror` 패키지에 extension map 지원 여부 확인, 없으면 Conflict detail 필드 확장
- [ ] Task 4 — 테스트: 신규 테마 clue-relations 200 빈 결과, 동시 수정 시 current_version 응답 노출

**PR-2 gate**:
- [ ] `go test -race ./internal/domain/editor/...` pass
- [ ] RFC 9457 문서 정합성 (extension 필드 snake_case)

---

## Wave 1 — 프론트엔드 네트워크/캐시 복구 (parallel ×2)

### PR-3: upload-url + clue 이미지 캐시
- [ ] Task 1 — `apps/web/src/features/editor/imageApi.ts:67` — 경로 합성 검사, `api.ts` baseURL 중복 여부 확인, `/v1/editor/themes/{id}/images/upload-url` 정확히 생성되는지
- [ ] Task 2 — `ImageCropUpload.tsx:93` — themeId undefined 시 확인 버튼 disabled + 에러 메시지
- [ ] Task 3 — `ClueForm.tsx:192-206` — uploadImage 완료 후 `queryClient.setQueryData(editorKeys.clues(themeId), prev => merge image_url)` + 추가 `invalidateQueries`
- [ ] Task 4 — Vitest + MSW: upload 성공 시 리스트에 image_url 즉시 반영

**PR-3 gate**:
- [ ] `pnpm test apps/web` editor 관련 pass
- [ ] 수동: 단서 생성 후 이미지 즉시 표시

### PR-4: config 409 rebase
- [ ] Task 1 — `editorConfigApi` mutation `onError`: 409 감지 → response의 current_version + current_config로 `queryClient.setQueryData` 갱신 → 1회 자동 retry
- [ ] Task 2 — 동일 429/충돌 재발 시 Snackbar "다른 세션에서 수정되었습니다" + 강제 새로고침 버튼
- [ ] Task 3 — `ModulesSubTab.tsx:40-53` — 에러 시 토글 상태 rollback + Snackbar 호출
- [ ] Task 4 — Vitest + MSW: 409 응답 후 자동 rebase + 성공 retry

**PR-4 gate**:
- [ ] 수동: 모듈 연속 3회 토글 충돌 없음
- [ ] `pnpm test` pass

---

## Wave 2 — UX 개선 (parallel ×2)

### PR-5: Optimistic + debounce 표준화
- [ ] Task 1 — `CharacterAssignPanel.tsx:52-76`: mutation `onMutate`/`onError`/`onSettled` 추가 — `queryClient.setQueryData(editorKeys.theme, prev => merged)`
- [ ] Task 2 — Config 계열 폼 debounce 500ms → **1500ms** 통일 (`CharacterAssignPanel:56`, `PhaseNodePanel:43`, 기타 config 입력)
- [ ] Task 3 — 텍스트 필드 `onBlur` flush (debounce 건너뛰고 즉시 저장)
- [ ] Task 4 — saving 인디케이터 (작은 스피너 or 텍스트) — 기존 EditorHeader/StudioLayout 재사용
- [ ] Task 5 — Vitest: onMutate rollback, debounce fake timer, onBlur flush

**PR-5 gate**:
- [ ] 수동: 체크 즉시 반영, 타이핑 중 네트워크 1.5s 후 1회

### PR-6: Location clue placement
- [ ] Task 1 — `LocationsSubTab.tsx` — 선택 장소 상세 패널에 `LocationClueAssignPanel` 추가 (체크박스 리스트 × clues)
- [ ] Task 2 — config_json 스키마: `locations[].clueIds: string[]` — 기존 타입 확장 (`editorTypes.ts` 또는 해당 위치)
- [ ] Task 3 — optimistic toggle (PR-5 패턴 재사용)
- [ ] Task 4 — mini-spec `refs/location-clue-placement.md` 작성 (런타임 연동은 Phase 18.5 후보 명시)
- [ ] Task 5 — Vitest: 체크 즉시 반영 + config_json 업데이트 호출

**PR-6 gate**:
- [ ] 수동: 장소에 단서 배치 가능, 저장 후 유지
- [ ] `pnpm test` pass

---

## Wave 3 — 회귀 + 문서 (sequential)

### PR-7: E2E + 회귀
- [ ] Task 1 — Playwright 9 시나리오: 테마 생성 → 이미지 업로드 → 체크 즉시 → 단서 이미지 즉시 → 관계 탭 200 → 모듈 토글 × 3 → 흐름 노드 PATCH → 장소 배치 → 템플릿 탭 200
- [ ] Task 2 — `go test -race -count=1 ./...` green
- [ ] Task 3 — `pnpm test` + `pnpm exec tsc --noEmit` + `pnpm lint` pass
- [ ] Task 4 — `memory/project_phase184_progress.md` 작성 + MEMORY.md 링크
- [ ] Task 5 — `/plan-finish` 사용자 실행

**Wave 3 gate**: user 확인 + archive

---

## Phase completion gate

- [ ] 9개 증상 전부 해결 (골든패스 수동 검증)
- [ ] Go + Front + E2E 전체 그린
- [ ] memory + MEMORY.md 업데이트
- [ ] Phase 18.4 archive
