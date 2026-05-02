# Phase 24 PR-3 Tasks — Entity Pages: 캐릭터 + 장소 + 단서

## 목표

PR-2에서 정리한 canonical config helper와 Accordion UI를 기반으로, 에디터의 제작 흐름을 **캐릭터·장소·단서 entity 중심**으로 재배치한다. 사용자는 단서를 한 곳에서 정의하고, 캐릭터/장소에서는 단서 ID만 참조한다.

> 2026-05-02 확장 결정: 캐릭터 역할 enum, 탐정 투표 후보 정책, PDF/이미지 역할지를 PR-3 계열 작업에 포함한다. 상세 분할은 `refs/pr-3-expansion-role-pdf-voting.md`가 canonical이다. 본 문서는 현재 브랜치의 기존 PR-3 진행 상태와 장소/단서 entity 작업 추적을 유지한다.

## Branch

- `feat/phase-24-pr-3-entity-character-location-clue`

## Spec 결정 매핑

| 결정 | PR-3 적용 |
|---|---|
| D-06 캐릭터 entity | 베이스 + 역할지 Markdown + starting_clue/hidden_mission 섹션 |
| D-07 장소 entity | 장소 리스트를 tree-ready 구조로 정리 + 접근 제한/장소 단서 섹션 |
| D-08 단서 entity | 단서 상세 화면 + 발견 컨텐츠 + 자동 backlink + 미사용 표시 |
| D-09 참조 패턴 | 캐릭터/장소는 단서 객체 복사 금지, ID 참조만 유지 |
| D-16 모듈 매핑 | 캐릭터 2개, 장소 2~3개, 단서 3개 섹션을 entity 폼에 배치 |
| D-PR3X-01 | 캐릭터 역할은 `mystery_role` enum으로 확장 |
| D-PR3X-02 | 탐정 투표 후보 포함 여부는 voting module config로 관리 |
| D-PR3X-03 | 역할지는 Markdown/PDF/Images typed model로 추상화 |
| D-PR3X-04 | PDF는 `DOCUMENT` media로 업로드하고 페이지 단위 viewer로 표시 |
| D-PR3X-05 | 프론트는 모바일 우선 세로 흐름을 기본으로 구현 |

## 현 코드/API 갭

| 영역 | 현재 | PR-3 처리 |
|---|---|---|
| 캐릭터 code | `EditorCharacterResponse`에 code 없음 | 이번 PR은 `id`를 시스템 식별자로 표시, 별도 code 컬럼은 Phase 25+ 후보 |
| 캐릭터 역할 | `is_culprit` boolean만 있음 | PR-3A에서 `mystery_role` enum 추가, `is_culprit`는 호환 기간 유지 |
| 캐릭터 역할지 | `theme_contents` key-value API 있음 | 현재 slice는 Markdown 저장, PR-3C에서 typed role sheet API로 전환 |
| PDF 역할지 | `theme_media`가 문서 타입 미지원 | PR-3D에서 `DOCUMENT` media + PDF page viewer 추가 |
| 투표 후보 정책 | 생존자 중 나 제외만 후보 | PR-3B에서 `candidatePolicy.includeDetective` 추가 |
| 장소 parent/tree | DB/API에 parent 없음 | UI는 tree-ready 컴포넌트 경계만 만들고 실제 parent 저장은 `config_json.locationMeta[locationId].parentLocationId`에 보존 |
| 장소 entry message/image | DB/API 필드 없음 | `config_json.locationMeta[locationId]`에 entryMessage/imageUrl 보존 |
| 접근 제한 | `restricted_characters` CSV 문자열 | 기존 API 유지, 프론트에서 string[]처럼 편집 후 CSV 저장 |
| 단서 발견 컨텐츠 | clue.description은 짧은 설명 | `clue_content:<clueId>` content key로 Markdown 저장 |
| Backlink | 백엔드 endpoint 없음 | 이번 PR은 editor 화면용 derived utility로 계산. DB 인덱스는 사용량/성능 확인 후 별도 PR |
| 삭제 무결성 | API delete는 즉시 삭제 | 이번 PR은 삭제 전 사용처 표시/경고 UI만. 강제 삭제 백엔드 게이트는 별도 hardening 후보 |

## 범위

### 포함

- [ ] PR-3 확장 계획 반영
  - 캐릭터 역할 enum: `suspect/culprit/accomplice/detective`
  - voting 후보 정책: `candidatePolicy.includeDetective`
  - 역할지 typed model: Markdown/PDF/Images
  - PDF/DOCUMENT 업로드는 별도 PR-3D로 분리
- [ ] entity 공통 레이아웃 primitive 추가
  - 좌측 리스트 + 우측 detail 패턴 정리
  - 빈 상태, 선택 상태, count badge 일관화
- [ ] 캐릭터 entity 페이지
  - 기존 `CharacterAssignPanel`을 캐릭터 entity detail로 승격
  - 베이스 요약 카드: 이름, 시스템 ID, 공개 소개, 사진 상태
  - 역할지 Markdown 편집 섹션: `role_sheet:<characterId>` content API
  - starting_clue split assigner 유지
  - hidden_mission Markdown/mission editor 섹션 유지
- [ ] 장소 entity 페이지
  - 기존 `LocationsSubTab` UI를 entity 리스트/상세 패턴으로 정리
  - map 선택 의존 UI를 유지하되, 장소 리스트가 tree-ready boundary를 갖게 분리
  - 접근 제한 캐릭터 편집 UI 추가/개선
  - `locationMeta` helper로 parentLocationId, entryMessage, imageUrl 저장 경계 신설
  - location_clue 섹션은 기존 canonical helper 유지
- [ ] 단서 entity 페이지
  - 단서 리스트 + 상세 패널 추가 또는 기존 `CluesTab`/`ClueForm` 재사용 경계 정리
  - 발견 컨텐츠 Markdown 편집: `clue_content:<clueId>` content API
  - 자동 backlink utility 추가
  - 리스트에 “사용된 곳”/“미사용” 표시
  - 단서 상세 하단에 backlink 섹션 표시
- [ ] config helper 확장
  - `locationMeta` read/write
  - clue backlink 계산
  - character/location/clue reference count 계산
- [ ] 테스트
  - helper unit test
  - 캐릭터 역할지 content 저장 테스트
  - 장소 meta/access 제한 테스트
  - 단서 backlink/misused 표시 테스트
  - 기존 PR-2 regression focused tests 유지

### 제외

- DB migration으로 character code/location parent/location image 컬럼 추가
- Backlink DB 인덱스/전용 API
- Soft delete/휴지통
- 순환 조합 validation의 완전한 backend enforcement
- 페이즈/결말 entity 페이지 (PR-4)
- ending_branch matrix (PR-5)
- Playwright 전체 E2E 신규 작성

> 예외: 캐릭터 역할 enum과 DOCUMENT media는 사용자 결정으로 PR-3 계열 후속 PR에 포함한다. 단, 현재 PR-3 단일 PR에 모두 넣지 않고 `refs/pr-3-expansion-role-pdf-voting.md`의 PR-3A~E로 분리한다.

## 작업 순서

### Task 1 — 준비

- [x] main 최신화 후 브랜치 생성
- [x] PR-3 task 문서 커밋 전 `git diff --check` 확인
- [x] 기존 PR-2 테스트 baseline 확인

### Task 2 — helper 설계/테스트 우선

- [x] `apps/web/src/features/editor/utils/entityReferences.ts` 추가
  - clue backlinks derived 계산
  - unused clue 판단
  - character/location reference summary 계산
- [x] `apps/web/src/features/editor/utils/entityMeta.ts` 추가
  - `locationMeta` read/write
  - restricted character CSV parse/format helper는 기존 API와 분리
- [x] unit tests 추가

### Task 3 — 캐릭터 entity detail

- [x] `CharacterDetailPanel`에 베이스 Accordion 섹션 추가
- [x] `CharacterRoleSheetSection` 추가
  - `useEditorContent(themeId, role_sheet:<id>)`
  - `useUpsertContent(themeId, role_sheet:<id>)`
  - blur/save 버튼으로 저장
- [x] starting_clue/hidden_mission 섹션은 기존 동작 유지
- [x] focused component test 추가

### Task 3X — 확장 작업 분리

- [x] PR-3 확장 계획서 작성: `refs/pr-3-expansion-role-pdf-voting.md`
- [x] PR-3A: `mystery_role` backend/frontend 작업 착수
- [ ] PR-3B: voting candidate policy 작업 착수
- [ ] PR-3C: typed role sheet API 작업 착수
- [ ] PR-3D: DOCUMENT/PDF 업로드 + viewer 작업 착수
- [ ] PR-3E: image role sheet viewer 작업 착수

### Task 4 — 장소 entity detail

- [ ] `LocationsSubTab`를 list/detail 책임으로 더 분리
- [ ] `LocationTreeList` 또는 tree-ready list 컴포넌트 추가
- [ ] `LocationMetaSection` 추가
  - parentLocationId dropdown boundary
  - entryMessage Markdown textarea
  - imageUrl 입력/기존 image upload 재사용 여부 확인
- [ ] `LocationAccessSection` 추가
  - 캐릭터 checkbox → `restricted_characters` CSV 저장
- [ ] location_clue 섹션 regression 유지
- [ ] focused component test 추가

### Task 5 — 단서 entity detail/backlink

- [ ] `ClueEntitySubTab` 또는 기존 `CluesTab` 내 entity mode 추가
- [ ] `ClueBacklinkPanel` 추가
- [ ] `ClueDiscoveryContentSection` 추가
  - `useEditorContent(themeId, clue_content:<id>)`
  - Markdown textarea 저장
- [ ] clue list에 사용처 count와 “미사용” 표시
- [ ] focused component test 추가

### Task 6 — 통합/검증

- [ ] DesignTab 진입점 정리: 캐릭터/장소/단서 entity 접근 경로 확정
- [x] `/__dev/phase24-editor-preview`에 PR-3 확인용 샘플 추가 또는 별도 section 추가
- [x] focused Vitest 실행
- [x] `cd apps/web && pnpm typecheck`
- [ ] `cd apps/web && pnpm lint`
- [x] 브라우저로 캐릭터 → 장소 → 단서 흐름 확인

## 완료 기준

- [ ] 캐릭터 상세에서 역할지 Markdown을 저장/재조회할 수 있다.
- [ ] 캐릭터 시작 단서는 PR-2 split assigner와 동일하게 canonical shape로 저장된다.
- [ ] 장소 상세에서 접근 제한 캐릭터와 장소 meta를 편집할 수 있다.
- [ ] 단서 상세에서 발견 컨텐츠를 저장/재조회할 수 있다.
- [ ] 단서 리스트/상세에서 자동 backlink와 미사용 표시가 보인다.
- [ ] 캐릭터/장소가 단서를 복사하지 않고 ID만 참조한다.
- [ ] 기존 config legacy key write가 재도입되지 않는다.
- [ ] focused tests/typecheck/lint가 통과한다.

## 검증 명령 후보

```bash
cd apps/web && pnpm exec vitest run \
  src/features/editor/utils/__tests__/configShape.test.ts \
  src/features/editor/utils/__tests__/entityReferences.test.ts \
  src/features/editor/components/design/__tests__/CharacterAssignPanel.test.tsx \
  src/features/editor/components/design/__tests__/StartingClueAssigner.test.tsx \
  src/features/editor/components/design/__tests__/LocationsSubTab.test.tsx \
  src/features/editor/components/__tests__/CluesTab.test.tsx

cd apps/web && pnpm typecheck
cd apps/web && pnpm lint
```

## PR 노트 초안

- PR-3는 ECS 전체 완성이 아니라 **캐릭터/장소/단서 3 entity의 첫 usable slice**다.
- DB schema 변경 없이 기존 API와 `theme_contents`, canonical `config_json` helper로 구현한다.
- Backlink는 editor-only derived 계산으로 시작한다. DB 인덱스는 실제 데이터 크기와 성능을 본 뒤 결정한다.
- 비관련 `graphify-out/*`, `.codex/`, `AGENTS.md`, `memory/sessions/*`는 PR 범위에서 제외한다.
