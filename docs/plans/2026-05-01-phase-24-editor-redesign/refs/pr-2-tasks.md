# Phase 24 PR-2 Tasks — Frontend Foundation

## 목표

PR-1 백엔드가 `config_json` legacy shape 저장을 거부하므로, 에디터 프론트가 더 이상 legacy key를 쓰지 않게 만든다. 기존 화면 동작은 유지하고, PR-3 이후 ECS 중심 UI로 확장하기 쉬운 helper 경계를 만든다.

## 범위

- [x] 공용 Accordion 컴포넌트 추가
  - 베이스/활성 섹션 기본 펼침
  - `localStorage` 펼침 상태 저장
  - 접근성용 `aria-expanded`/`region` 연결
- [x] canonical config helper 추가
  - `modules: { [moduleId]: { enabled, config } }`
  - `locations[].locationClueConfig.clueIds`
  - `modules.starting_clue.config.startingClues`
- [x] 에디터 컴포넌트의 legacy read/write 전환
- [x] `useUpdateConfigJson` 409 retry 경로 단일화
- [x] 관련 unit/component test 갱신
- [x] 캐릭터 시작 단서 UI를 split assigner로 교체
  - 좌측: 전체 단서 목록 + 검색
  - 우측: 선택 캐릭터 시작 단서 목록
  - 좌측 클릭으로 추가, 우측에서 제거

## 제외

- ending_branch matrix evaluator 구현
- Phase/Ending 전용 신규 UI 전체 구현
- 백엔드 DB migration sweep
- Playwright 전체 E2E 보정

## 작업 순서

1. [x] `configShape` helper와 테스트 추가
2. [x] 모듈 활성/설정 화면을 canonical write로 전환
3. [x] 단서 배치·캐릭터 시작 단서·장소 단서 연결을 canonical write로 전환
4. [x] validation과 layout badge가 canonical shape를 읽게 전환
5. [x] config save hook을 409 silent-rebase retry 구현으로 단일화
6. [x] 공용 `Accordion` 추가 + 캐릭터 상세 패널에 첫 적용
7. [x] focused Vitest와 typecheck 실행

## 완료 기준

- [x] 프론트 저장 payload에 `module_configs`, `clue_placement`, `character_clues`, `locations[].clueIds`, 배열형 `modules`가 남지 않는다.
- [x] 기존 legacy config는 화면 표시용으로 읽을 수 있지만 저장 시 canonical shape로 정리된다.
- [x] 관련 테스트가 canonical payload를 검증한다.
- [x] `Accordion`은 강제 펼침/기본 펼침/저장 복원을 테스트한다.
- [x] 시작 단서 배정은 단서가 많아져도 검색 가능한 split assigner로 동작한다.

## 검증

- `cd apps/web && pnpm exec vitest run src/features/editor/utils/__tests__/configShape.test.ts src/shared/components/ui/__tests__/Accordion.test.tsx src/features/editor/components/design/__tests__/CharacterAssignPanel.test.tsx src/features/editor/components/design/__tests__/CluePlacementPanel.test.tsx src/features/editor/components/design/__tests__/LocationClueAssignPanel.test.tsx src/features/editor/components/design/__tests__/ModulesSubTab.test.tsx src/features/editor/__tests__/validation.test.ts`
  - 7 files / 61 tests passed
- `cd apps/web && pnpm typecheck`
  - passed
- 브라우저 확인: `/__dev/phase24-editor-preview`
  - split assigner 좌측/우측 비율과 검색 결과 확인

## PR 노트

- `/__dev/phase24-editor-preview`는 `import.meta.env.DEV` 조건으로만 로드되는 리뷰/확인용 화면이다. 운영 빌드에는 라우트가 노출되지 않는다.
- `graphify-out/*`, `.codex/`, `AGENTS.md`, `memory/sessions/*` 변경은 본 PR 범위에서 제외한다.
