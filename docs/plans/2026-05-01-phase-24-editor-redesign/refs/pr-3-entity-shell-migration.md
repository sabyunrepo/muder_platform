# Phase 24 PR-3H — Entity Shell Migration Plan

## 목표

캐릭터·장소·단서 에디터를 각각 다른 화면 구조로 완성하지 않고, 공통 `EntityEditorShell` 위에 엔티티별 adapter/section을 얹는 방식으로 재설계한다.

핵심 원칙:

1. 공통 Shell은 레이아웃, 검색, 선택, 빈 상태, 삭제 CTA, 참조/검수 영역의 자리만 책임진다.
2. 캐릭터/장소/단서 고유 기능은 adapter와 section이 책임진다.
3. 백엔드는 generic CRUD로 묶지 않고, 엔티티별 service는 유지하되 reference 조회/cleanup/validation만 공통화한다.
4. 제작자가 몰라도 되는 internal ID, config key, DB 필드명, legacy key는 기본 UI에 노출하지 않는다.
5. 모든 화면은 모바일 우선 세로 흐름이며, 데스크톱에서만 목록/상세 2열을 허용한다.

## 현재 상태와 충돌 지점

| 영역 | 현재 상태 | 충돌/위험 | migration 방향 |
|---|---|---|---|
| 캐릭터 | `CharacterAssignPanel`, `CharacterDetailPanel`, role sheet section이 실제 구현 | 새 entity mock/preview와 실제 컴포넌트 구조가 다름 | `CharacterEntityAdapter`가 기존 detail/role/starting clue section을 Shell에 주입 |
| 장소 | `LocationsSubTab`, `LocationDetailPanel`, `LocationClueAssignPanel` 실제 구현 | 장소 목록/상세/단서 배정이 한 컴포넌트 흐름에 강하게 결합 | `LocationEntityAdapter`가 장소 list/detail/access/clue section을 분리 주입 |
| 단서 | 기존 `ClueForm` 저장 로직 + 신규 `ClueEntityWorkspace` | 목록/상세는 새 구조, 생성/수정은 기존 modal 재사용 | `ClueEntityAdapter`를 첫 이전 대상으로 삼고 Shell API를 안정화 |
| DEV preview | `/__dev/phase24-*preview` | 실제 구현과 혼동 가능 | 검증용으로만 유지하거나 PR 끝에서 제거/축소 |
| 백엔드 | 엔티티 CRUD + config_json helper 혼재 | 삭제/참조 정합성 로직이 엔티티마다 흩어질 수 있음 | `service_entity_references.go`, `service_entity_cleanup.go`로 공통 참조/정리 helper 추출 |

## 프론트 설계

### 폴더

```txt
apps/web/src/features/editor/entities/
├─ shell/
│  ├─ EntityEditorShell.tsx
│  ├─ EntityEditorShell.test.tsx
│  └─ entityShellTypes.ts
├─ characters/
│  └─ CharacterEntityAdapter.tsx
├─ locations/
│  └─ LocationEntityAdapter.tsx
└─ clues/
   └─ ClueEntityAdapter.tsx
```

기존 feature component는 바로 삭제하지 않고 adapter 내부 section으로 흡수한다.

### Shell API 초안

```tsx
<EntityEditorShell
  title="단서"
  items={items}
  selectedId={selectedId}
  onSelect={setSelectedId}
  onCreate={handleCreate}
  getItemId={(item) => item.id}
  getItemTitle={(item) => item.name}
  getItemDescription={(item) => item.description}
  getItemBadges={(item) => badges}
  renderDetail={(item) => <ClueDetailSections clue={item} />}
  renderInspector={(item) => <ClueUsageInspector clue={item} />}
/>
```

Shell 금지사항:

- `if entityType === 'character'` 같은 엔티티 분기 금지
- `mystery_role`, `locationClueConfig`, `use_effect` 같은 비즈니스 필드 직접 접근 금지
- DB/API 필드명 그대로 표시 금지

## 백엔드 설계

### 공통화 대상

```txt
apps/server/internal/domain/editor/
├─ service_character.go          // 유지
├─ service_location.go           // 유지
├─ service_clue.go               // 유지
├─ service_entity_references.go  // 신규: 삭제 전/검수용 reference summary
├─ service_entity_cleanup.go     // 신규: config_json 참조 제거 helper
└─ service_entity_validation.go  // 필요 시 신규: cross-entity validation
```

### 저장 원칙

| 데이터 | 저장 위치 | 이유 |
|---|---|---|
| 캐릭터/장소/단서 기본 정보 | 정규 테이블 | 검색, 권한, 타입 안정성 |
| 시작 단서/장소 단서 등 관계 설정 | 현재는 canonical `config_json`, 이후 테이블 후보 | Phase 24 normalizer와 호환 |
| 단서 조합/복잡한 사용 효과 | 별도 table/API 후보. 단기적으로는 config module | 다대다/런타임 실행 정합성 필요 |
| 삭제 영향/참조 summary | 백엔드 derived API 후보 | 프론트가 저장 구조를 몰라도 됨 |

### 삭제 정합성 완료 기준

- `DeleteClue`: config_json, clue_edge 참조 정리 완료
- `DeleteLocation`: config_json의 location entry, parent/tree, evidence/location_clue 참조 정리
- `DeleteCharacter`: starting clue owner, restricted characters, voting/role related config 참조 정리
- 모든 delete는 transaction 안에서 처리
- 삭제 전 preview와 실제 cleanup 결과가 같은 source helper를 사용

## 작업 순서

### PR-3H-1 — Plan + Shell foundation

- [ ] 이 문서 작성
- [ ] `EntityEditorShell` 테스트 RED 확인
- [ ] 모바일 세로, 데스크톱 2열 Shell 구현
- [ ] 검색/선택/빈 상태/추가 버튼/inspector slot 테스트
- [ ] focused Vitest + typecheck

### PR-3H-2 — Clue adapter migration

- [ ] `ClueEntityWorkspace`를 Shell 기반 adapter로 이동
- [ ] 기존 `ClueForm`은 생성/수정 modal로 임시 재사용
- [ ] 삭제 영향 표시는 기존 `buildClueUsageMap` 유지
- [ ] 단서 E2E: `/editor/:themeId/clues`에서 목록/상세/검색/삭제 모달 확인

### PR-3H-3 — Location adapter migration

- [ ] `LocationsSubTab`에서 list/detail shell 책임 분리
- [ ] `LocationDetailPanel`을 section으로 축소
- [ ] `LocationClueAssignPanel`을 장소 adapter section으로 주입
- [ ] 장소 이미지/접근 제한/단서 배정 회귀 테스트 유지
- [ ] E2E: 장소 목록 선택 → 장소 상세 → 단서 배정 패널 표시

### PR-3H-4 — Character adapter migration

- [ ] `CharacterAssignPanel`의 list/detail 책임을 adapter로 분리
- [ ] `CharacterDetailPanel`, role sheet, starting clue assigner를 section으로 주입
- [ ] mystery role/PDF/images role sheet 회귀 테스트 유지
- [ ] E2E: 캐릭터 선택 → 역할 설정/롤지 섹션/시작 단서 섹션 표시

### PR-3H-5 — Backend references/cleanup hardening

- [ ] `service_entity_cleanup.go`로 clue cleanup helper 이동 또는 확장
- [ ] location/character cleanup TDD 추가
- [ ] 필요 시 `GET /v1/editor/themes/{themeId}/entity-references` 설계/구현
- [ ] deletion preview와 transaction cleanup이 같은 reference source를 쓰는지 검증

### PR-3H-6 — Cleanup

- [ ] 실제 route에서 더 이상 쓰지 않는 `ClueCard`, `ClueListRow` 제거 여부 판단
- [ ] DEV preview는 유지/삭제 결정 후 문서화
- [ ] PR description에 “목업과 실제 구현 경계” 명시

## 완료 조건

### 기능 완료

- [ ] 캐릭터/장소/단서 모두 같은 Shell 흐름을 사용한다.
- [ ] 엔티티별 고유 UI는 adapter/section으로만 구현되어 Shell에 비즈니스 분기가 없다.
- [ ] 기존 생성/수정/이미지 업로드/역할지/단서 배정 기능이 회귀하지 않는다.
- [ ] 삭제 시 연결 정리 책임은 백엔드 transaction에 있다.
- [ ] 제작자 화면에 internal ID/config key/DB field/legacy key가 기본 노출되지 않는다.

### 테스트 완료

- [ ] Shell unit test: 검색, 선택, 빈 상태, 추가 액션, detail/inspector slot
- [ ] Character adapter test: 역할/롤지/시작 단서 섹션 표시
- [ ] Location adapter test: 장소 이미지/접근 제한/장소 단서 섹션 표시
- [ ] Clue adapter test: 사용 효과/참조/삭제 영향 표시
- [ ] Backend Go test: clue/location/character cleanup helper + transaction delete
- [ ] E2E mocked: 캐릭터/장소/단서 각 탭 진입과 핵심 섹션 표시
- [ ] Codecov patch coverage 70% 이상 목표

### 검증 명령

```bash
pnpm --dir apps/web exec vitest run \
  src/features/editor/entities/shell/EntityEditorShell.test.tsx \
  src/features/editor/components/clues/ClueEntityWorkspace.test.tsx \
  src/features/editor/components/__tests__/CluesTab.test.tsx \
  src/features/editor/components/design/__tests__/LocationsSubTab.test.tsx \
  src/features/editor/components/design/__tests__/CharacterAssignPanel.test.tsx

pnpm --dir apps/web typecheck
pnpm --dir apps/web exec eslint src/features/editor apps/web/e2e/editor-golden-path.spec.ts
pnpm --dir apps/web exec playwright test e2e/editor-golden-path.spec.ts --project=chromium -g "캐릭터|장소|단서"

cd apps/server && go test ./internal/domain/editor -count=1
```

## 이번 세션 착수 범위

1. 문서 작성
2. 공통 Shell TDD RED/GREEN
3. 단서 adapter를 Shell 기반으로 얇게 이전
4. 검증: Shell/Clue focused Vitest + typecheck + E2E 단서 smoke

캐릭터/장소 adapter는 Shell API가 흔들리지 않는 것을 확인한 뒤 다음 commit/PR slice에서 진행한다.

## 8. 2026-05-03 진행 결과

- 공통 `EntityEditorShell` 도입 완료: 목록/검색/선택/빈 상태/생성 액션/상세 슬롯/보조 슬롯을 담당한다.
- 단서 엔티티: `ClueEntityWorkspace`를 Shell 기반으로 이전했다. 단서 상세와 사용 효과, 연결 위치 표시는 단서 전용 컴포넌트가 담당한다.
- 캐릭터 엔티티: `CharacterAssignPanel`을 Shell 기반 목록/검색/상세 흐름으로 이전했고, 제작자에게 불필요한 시스템 ID 표시를 제거했다.
- 장소 엔티티: 선택된 맵의 장소 목록/검색/추가/삭제/상세 흐름을 Shell 기반으로 이전했다. 맵 목록은 장소의 상위 탐색 구조라 기존 사이드바로 유지한다.
- 백엔드: 단서 삭제 시 config/json 참조와 clue edge group 정리를 트랜잭션 안에서 처리하는 테스트를 유지한다. 캐릭터/장소 삭제 정합성은 다음 slice에서 같은 references/cleanup 계층으로 확장한다.

### 검증 증거

- `pnpm --dir apps/web exec vitest run ...` — Shell/단서/캐릭터/장소 focused 66 tests passed.
- `pnpm --dir apps/web exec eslint ...` — changed frontend files passed.
- `pnpm --dir apps/web typecheck` — passed.
- `pnpm --dir apps/web exec playwright test e2e/editor-golden-path.spec.ts --project=chromium -g "단서 탭은 목록과 상세"` — 1 passed.
- `cd apps/server && go test ./internal/domain/editor -run 'TestRemoveClueReferencesFromConfigJSON|TestService_DeleteClue' -count=1` — passed.
