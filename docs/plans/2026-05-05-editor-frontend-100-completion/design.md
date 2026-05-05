# Phase 25 — Editor Front 100 Completion Design

## 원인

에디터 프론트 1차 목표 감사표는 “핵심 제작 블록이 실제 `/editor/{themeId}`에서 raw JSON 없이 접근 가능해야 한다”를 완료 기준으로 둔다. 이후 #290, #302, #303, #304, #305가 모두 머지되어 단서 조사, 정보 공개, 토론방, 조사권, 연출 제작 UI는 들어왔다.

남은 문제는 새 기능이 아니라 수용 기준이다. 현재 `AdvancedTab`은 `config_json`을 기본 탭에서 직접 편집하게 하고, `MediaDetail`은 raw metadata를 그대로 보여준다. 또한 개별 기능 PR 테스트는 있지만 전체 route/mobile 수용 게이트가 아직 하나의 기준으로 고정되지 않았다.

## 결과

이 상태에서 “100%”라고 부르면 제작자는 대부분의 블록을 볼 수 있지만, 여전히 내부 저장 구조를 만질 수 있고 모바일/직접 URL 회귀를 한 번에 보장하지 못한다. 반대로 이 상태에서 또 큰 entity를 추가하면 1차 목표가 계속 밀리고 2차 backend/runtime 작업으로 넘어가는 기준이 흐려진다.

따라서 남은 작업은 P0 두 개로 제한한다.

1. #375: creator-safe UI 정리
2. #376: 최종 route/mobile 수용 게이트

## 권장 구조

### 1. Raw JSON은 삭제가 아니라 격리

`config_json` 편집 기능은 운영/디버그에 유용할 수 있으므로 완전히 제거하지 않는다. 다만 제작자 기본 flow에서는 숨긴다.

권장안:

- 기본 `고급` 탭은 제작 검수/복구 중심 화면으로 바꾼다.
- raw JSON 편집은 dev/admin/debug 조건에서만 보이게 한다.
- 테스트는 기본 렌더에서 `config_json` 텍스트와 JSON textarea가 보이지 않음을 검증한다.

### 2. Metadata는 제작자용 라벨로 변환

미디어 상세의 `type`, `source`, `mime`, `size`는 개발자에게는 유용하지만 제작자에게는 내부값처럼 보인다.

권장안:

- `type: audio` → `오디오`
- `source: upload` → `직접 업로드`
- `mime: audio/mpeg` → `MP3`
- `size: 12345 B` → `12 KB`

내부값이 필요한 경우 debug 접힘에만 둔다.

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

\#375와 \#376이 merge되고 감사표가 최신화되면 “에디터 프론트 1차 목표 100%”로 선언한다. 그 이후에는 2차 목표인 backend/runtime/game screen으로 이동한다.
