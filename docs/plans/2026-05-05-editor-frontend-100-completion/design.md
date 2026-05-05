# Phase 25 — Editor Front 100 Completion Design

## 원인

에디터 프론트 1차 목표 감사표는 “핵심 제작 블록이 실제 `/editor/{themeId}`에서 raw JSON 없이 접근 가능해야 한다”를 완료 기준으로 둔다. 이후 #290, #302, #303, #304, #305가 모두 머지되어 단서 조사, 정보 공개, 토론방, 조사권, 연출 제작 UI는 들어왔다.

남은 문제는 새 기능을 더 늘리는 것이 아니라, 사용자가 처음 들어오는 `/editor/{themeId}` 제작 흐름을 스토리 중심으로 재정렬하고 수용 기준을 고정하는 것이다. 기존 개별 entity 화면은 존재하지만 기본 진입 경험이 흩어져 보였고, 좌측 라이브러리와 우측 장면 속성이 실제 제작 흐름 안에서 함께 보인다는 기준도 문서와 테스트에 고정되지 않았다.

## 결과

이 상태에서 “100%”라고 부르면 제작자는 대부분의 블록을 볼 수 있지만, 여전히 내부 저장 구조를 만질 수 있고 모바일/직접 URL 회귀를 한 번에 보장하지 못한다. 반대로 이 상태에서 또 큰 entity를 추가하면 1차 목표가 계속 밀리고 2차 backend/runtime 작업으로 넘어가는 기준이 흐려진다.

따라서 남은 작업은 P0 네 개와 최종 gate 한 개로 제한한다.

1. #383: 좌측 엔티티 라이브러리
2. #384: 우측 장면 속성 패널
3. #385: 기존 엔티티 페이지 보조 관리 정리
4. #386: 최종 route/mobile 수용 게이트

## 권장 구조

### 1. 기본 진입은 스토리 진행

`/editor/{themeId}`는 제작자가 가장 먼저 장면 흐름을 보고, 그 장면에 등장인물, 단서, 장소, 조사권, 토론방, 연출을 붙이는 화면이어야 한다.

권장안:

- `/editor/:id`, `/editor/:id/story`, `/editor/:id/story-map`, `/editor/:id/flow`는 모두 `스토리 진행`을 연다.
- 기존 `/characters`, `/clues`, `/locations`, `/endings`, `/media`는 삭제하지 않고 보조 관리 화면으로 유지한다.
- 테스트는 `routeSegments.ts`의 matrix와 `EditorPage.test.tsx`가 같은 기준을 검증한다.

### 2. 기존 entity 페이지는 보조 관리로 유지

기존 CRUD 화면은 여전히 필요하다. 다만 기본 제작 동선에서는 장면 안에 연결할 후보를 고르는 방식이 더 자연스럽다.

권장안:

- 상단 탭은 `스토리 진행 → 보조 관리 → 설정` 순서로 둔다.
- 등장인물/단서/미디어는 `관리` 라벨을 붙인다.
- 장소/결말은 기존 design subtab direct URL을 유지한다.

### 3. Route matrix는 문서와 테스트를 함께 둔다

라우터 연결은 이미 상당히 안정되어 있다. 남은 일은 “현재 기대 동작”을 명시하고, direct URL이 tab/subtab을 여는 테스트를 한 곳에 유지하는 것이다.

권장안:

- `routeSegments.ts`, `EditorPage.test.tsx`, `DesignTab.test.tsx`, `CluesTab.test.tsx`를 핵심 회귀 테스트로 둔다.
- `/editor/:id/design/locations` 같은 canonical URL과 `/editor/:id/locations` 같은 top-level alias를 모두 문서화한다.
- 모바일 smoke는 Playwright가 가능하면 자동화하고, 환경 제약이 있으면 수동 브라우저 증거를 PR에 남긴다.

## 참고한 외부 패턴

- Uzu Studio local docs: `docs/uzu-studio-docs/basic-features/decks.md`, `room.md`, `effect.md`, `texttab.md`
  - 덱/토큰/룸/연출/텍스트를 제작자용 개념으로 노출하고, 내부 저장 구조 대신 설정 항목 중심으로 구성한다.
- Arcweave docs: https://docs.arcweave.com/introduction/what-is-arcweave
  - 작가/디자이너가 story flow, components, attributes, variables, branches를 만들고 개발자는 structured export를 받는 분리 모델을 둔다.
- articy:draft docs: https://www.articy.com/help/adx/Scripting_in_articy.html
  - condition과 instruction을 구분하고 simulation/debugger로 논리를 확인한다. MMP는 이를 raw script가 아니라 조건/트리거 UI와 검수 패널로 재해석한다.

## 비범위

- backend runtime/engine 완성
- game screen 구현
- 새 entity 추가
- 전체 editor redesign
- normalizer 제거 또는 backend validation 강화

## 완료 선언 기준

\#390, \#391, \#392, \#393이 merge되고 감사표가 최신화되면 “에디터 프론트 1차 목표 100%”로 선언한다. 그 이후에는 2차 목표인 backend/runtime/game screen으로 이동한다.
