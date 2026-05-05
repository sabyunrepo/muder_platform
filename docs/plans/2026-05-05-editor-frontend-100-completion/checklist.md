# Phase 25 — Editor Front 100 Completion Checklist

## 목표

`docs/plans/2026-05-05-editor-frontend-100-audit/audit.md`의 1차 목표를 실제 merge 가능한 작업 순서로 닫는다.

1차 목표의 완료 기준은 제작자가 실제 `/editor/{themeId}`와 하위 직접 URL에서 raw JSON 없이 스토리, 등장인물, 단서, 장소, 조건, 트리거, 정보 공개, 단서 조사, 조사권, 토론방, 연출, 결말, 미디어를 생성/수정/저장/검토할 수 있는 상태다.

2차 목표는 이 제작물을 backend runtime, engine, game screen이 실제 플레이 가능한 게임으로 해석하는 것이다. 이 문서는 1차 프론트 완성만 다룬다.

## 최신 판정

2026-05-05 현재 `origin/main` 기준으로 #290, #302, #303, #304, #305가 각각 PR #338, #337, #342, #340, #345로 머지되어 핵심 제작 블록은 들어왔다.

따라서 남은 1차 프론트 100% gap은 새 대형 entity 구현이 아니라 다음 두 가지다.

- creator-safe UI: `AdvancedTab` raw `config_json` 기본 노출과 `MediaDetail` raw metadata 표시를 정리한다.
- final acceptance gate: 직접 URL, tab/subtab, 모바일/데스크톱 smoke, 감사표 최신화를 한 PR에서 고정한다.

## 근거

- Uzu Studio docs는 덱/토큰/룸/연출/텍스트를 제작자 언어로 노출하고 내부 저장 구조는 숨긴다. MMP는 이를 그대로 복제하지 않고 `단서 조사`, `조사권`, `토론방`, `연출`, `정보 공개`로 재해석했다.
- Arcweave는 작가/디자이너가 이야기 구조와 조건을 다루고 개발자는 구조화된 데이터를 받는 분리 모델을 둔다.
- articy:draft도 condition과 instruction을 구분하고 simulation으로 논리를 검증한다. MMP에서는 조건/트리거/검증 패널을 제작자용 UI로 유지하고 raw script/json 노출은 기본 흐름에서 제외한다.

## 실행 순서

### P0-1. #375 Creator-safe 고급/미디어 UI 정리

Issue: https://github.com/sabyunrepo/muder_platform/issues/375

작업:

- `AdvancedTab.tsx` raw `config_json` 편집 UI를 기본 제작 nav에서 제거하거나 dev/admin/debug gate로 격리한다.
- 검증 기능은 제작자용 `ValidationPanel` 또는 안전한 검수 UI로 남긴다.
- `MediaDetail.tsx`의 `type/source/mime/size` raw metadata 표시를 제작자용 문구로 바꾼다.
- 내부 ID, module key, 저장 JSON shape가 기본 제작 화면에 노출되지 않는지 component test로 고정한다.

완료 기준:

- 제작자 기본 화면에서 raw `config_json`을 직접 편집하지 않는다.
- 미디어 상세가 내부 key 대신 사람이 읽는 라벨을 보여준다.
- focused Vitest와 `pnpm --filter @mmp/web exec tsc --noEmit`이 통과한다.

### P0-2. #376 직접 URL·모바일 최종 수용 게이트

Issue: https://github.com/sabyunrepo/muder_platform/issues/376

작업:

- route matrix를 문서와 테스트에 고정한다.
- 직접 URL이 올바른 tab/subtab을 여는지 회귀 테스트한다.
- 390px 모바일 폭과 데스크톱 폭에서 핵심 제작 화면이 깨지지 않는지 Playwright 또는 수동 브라우저 증거를 남긴다.
- `docs/plans/2026-05-05-editor-frontend-100-audit/audit.md`의 구현률과 남은 이슈 링크를 최신화한다.

직접 URL 기준:

- `/editor/:id`
- `/editor/:id/story`
- `/editor/:id/characters`
- `/editor/:id/clues`
- `/editor/:id/relations`
- `/editor/:id/design/modules`
- `/editor/:id/design/flow`
- `/editor/:id/design/locations`
- `/editor/:id/design/endings`
- `/editor/:id/media`
- top-level alias: `/editor/:id/modules`, `/editor/:id/flow`, `/editor/:id/locations`, `/editor/:id/endings`

완료 기준:

- route matrix가 테스트와 문서에 모두 남아 있다.
- 모바일/데스크톱 smoke 증거가 PR 본문에 기록된다.
- 감사표상 1차 프론트 구현률이 최신 코드 기준으로 갱신된다.

## 이후 순서

\#375와 \#376이 닫히면 에디터 프론트 1차 목표는 기능 구현 관점에서 100%로 본다. 이후 작업은 2차 목표로 이동한다.

2차는 다음 순서로 재정렬한다.

1. Backend 저장/검증 정합성: editor API가 저장 shape와 reference를 save-time에 검증한다.
2. Runtime Engine: 조건, 트리거, 정보 공개, 단서 조사, 조사권 소비, 토론방 접근, 연출, 결말 판정을 backend가 최종 책임진다.
3. Game Screen: 플레이어와 GM이 실제 제작된 게임을 진행할 수 있는 화면을 설계하고 구현한다.

## 공통 검증

```bash
pnpm --filter @mmp/web exec tsc --noEmit
pnpm --filter @mmp/web exec vitest run src/pages/__tests__/EditorPage.test.tsx src/features/editor/components/design/__tests__/DesignTab.test.tsx src/features/editor/components/__tests__/CluesTab.test.tsx
```

변경 범위별 focused tests를 추가한다. route 또는 모바일 레이아웃이 바뀌면 Playwright 또는 브라우저 수동 smoke를 PR에 남긴다.
