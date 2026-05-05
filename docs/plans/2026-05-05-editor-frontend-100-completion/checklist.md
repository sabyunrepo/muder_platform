# Phase 25 — Editor Front 100 Completion Checklist

## 목표

`docs/plans/2026-05-05-editor-frontend-100-audit/audit.md`의 1차 목표를 실제 merge 가능한 작업 순서로 닫는다.

1차 목표의 완료 기준은 제작자가 실제 `/editor/{themeId}`와 하위 직접 URL에서 raw JSON 없이 스토리, 등장인물, 단서, 장소, 조건, 트리거, 정보 공개, 단서 조사, 조사권, 토론방, 연출, 결말, 미디어를 생성/수정/저장/검토할 수 있는 상태다.

2차 목표는 이 제작물을 backend runtime, engine, game screen이 실제 플레이 가능한 게임으로 해석하는 것이다. 이 문서는 1차 프론트 완성만 다룬다.

## 최신 판정

2026-05-05 현재 story-centered PR stack 기준으로 #382가 PR #387로 merge되어 `/editor/:id` 기본 진입은 `스토리 진행` 제작 화면이 되었다. #383, #384, #385, #386은 각각 #390, #391, #392, #393으로 이어지는 stack에서 좌측 제작 라이브러리, 우측 장면 속성, 기존 엔티티 보조 관리, 최종 수용 게이트를 닫는다.

따라서 남은 1차 프론트 100% gap은 새 대형 entity 구현이 아니라 다음 네 가지다.

- entity library: 실제 characters/clues/locations/media read hook을 좌측 제작 라이브러리에서 불러온다.
- scene inspector: 선택한 장면과 선택한 연결 대상을 우측 패널에서 함께 확인한다.
- auxiliary pages: 기존 characters/clues/locations/endings/media 페이지를 direct URL 유지 보조 관리 화면으로 정리한다.
- final acceptance gate: story-centered 직접 URL, tab/subtab, 모바일/데스크톱 smoke, 감사표 최신화를 한 PR에서 고정한다.

## 근거

- Uzu Studio docs는 덱/토큰/룸/연출/텍스트를 제작자 언어로 노출하고 내부 저장 구조는 숨긴다. MMP는 이를 그대로 복제하지 않고 `단서 조사`, `조사권`, `토론방`, `연출`, `정보 공개`로 재해석했다.
- Arcweave는 작가/디자이너가 이야기 구조와 조건을 다루고 개발자는 구조화된 데이터를 받는 분리 모델을 둔다.
- articy:draft도 condition과 instruction을 구분하고 simulation으로 논리를 검증한다. MMP에서는 조건/트리거/검증 패널을 제작자용 UI로 유지하고 raw script/json 노출은 기본 흐름에서 제외한다.

## 실행 순서

### P0-1. #383 좌측 엔티티 라이브러리

Issue: https://github.com/sabyunrepo/muder_platform/issues/383

작업:

- 스토리 맵 좌측에 등장인물, 단서, 장소, 미디어를 제작 라이브러리로 표시한다.
- 실제 editor read hook을 사용하고 mock/dev preview 데이터에 기대지 않는다.
- 조사권, 토론방, 트리거 같은 진행 자원은 별도 저장 계약을 만들지 않고 장면 연결 후보로 노출한다.

완료 기준:

- `/editor/:id`에서 제작 라이브러리가 보인다.
- 라이브러리 항목 선택 상태가 우측 장면 속성의 연결 대상과 이어진다.
- focused Vitest와 `pnpm --filter @mmp/web exec tsc --noEmit`이 통과한다.

### P0-2. #384 우측 장면 속성 패널

Issue: https://github.com/sabyunrepo/muder_platform/issues/384

작업:

- 중앙 `FlowCanvas`에서 선택한 장면을 우측 패널로 전달한다.
- 정보 공개, 단서 배포, 장소, 조사권, 토론방, 연출, 조건, 액션 상태를 제작자용 문구로 요약한다.
- 선택한 라이브러리 연결 대상과 선택한 장면을 동시에 보여준다.

완료 기준:

- 장면을 선택하지 않은 상태와 선택한 상태가 모두 테스트된다.
- 내부 저장 key나 raw JSON 없이 제작자 언어로 표시된다.

### P0-3. #385 기존 엔티티 페이지 보조 관리 정리

Issue: https://github.com/sabyunrepo/muder_platform/issues/385

작업:

- 상단 탭을 `스토리 진행 → 보조 관리 → 설정` 순서로 정리한다.
- 기존 characters/clues/locations/endings/media direct URL은 유지한다.
- 등장인물, 단서, 미디어는 `관리` 라벨로 보조 관리 성격을 분명히 한다.

완료 기준:

- `/characters`, `/clues`, `/locations`, `/endings`, `/media`가 계속 열린다.
- 기본 제작 흐름은 `/editor/:id`의 스토리 진행 화면으로 유지된다.

### P0-4. #386 직접 URL·모바일 최종 수용 게이트

Issue: https://github.com/sabyunrepo/muder_platform/issues/386

작업:

- route matrix를 문서와 테스트에 고정한다.
- 직접 URL이 올바른 tab/subtab을 여는지 회귀 테스트한다.
- 390px 모바일 폭과 데스크톱 폭에서 핵심 제작 화면이 깨지지 않는지 Playwright 또는 수동 브라우저 증거를 남긴다.
- `docs/plans/2026-05-05-editor-frontend-100-audit/audit.md`의 구현률과 남은 이슈 링크를 최신화한다.

직접 URL 기준:

| URL                            | 열려야 하는 제작 화면 | 비고                    |
| ------------------------------ | --------------------- | ----------------------- |
| `/editor/:id`                  | 스토리 진행           | 기본 제작 진입          |
| `/editor/:id/story-map`        | 스토리 진행           | 유지할 alias            |
| `/editor/:id/story`            | 스토리 진행           | 기존 story URL 흡수     |
| `/editor/:id/characters`       | 등장인물 관리         | 보조 관리 화면          |
| `/editor/:id/clues`            | 단서 관리             | 보조 관리 화면          |
| `/editor/:id/relations`        | 단서 관계             | 단서 탭 안 관계 모드    |
| `/editor/:id/design/modules`   | 게임설계 / 모듈       | canonical design subtab |
| `/editor/:id/design/flow`      | 게임설계 / 흐름       | canonical design subtab |
| `/editor/:id/design/locations` | 게임설계 / 장소       | canonical design subtab |
| `/editor/:id/design/endings`   | 게임설계 / 결말       | canonical design subtab |
| `/editor/:id/media`            | 미디어 관리           | 보조 관리 화면          |
| `/editor/:id/modules`          | 게임설계 / 모듈       | 유지할 alias            |
| `/editor/:id/flow`             | 스토리 진행           | 기존 flow URL 흡수      |
| `/editor/:id/locations`        | 게임설계 / 장소       | 유지할 alias            |
| `/editor/:id/endings`          | 게임설계 / 결말       | 유지할 alias            |

Route matrix의 코드 기준은 `apps/web/src/features/editor/routeSegments.ts`의 `EDITOR_ROUTE_MATRIX`다.
테스트는 `routeSegments.test.ts`, `EditorPage.test.tsx`, `DesignTab.test.tsx`, `editor-golden-path.spec.ts`가 같은 기준을 나눠 검증한다.

완료 기준:

- route matrix가 테스트와 문서에 모두 남아 있다.
- 모바일/데스크톱 smoke 증거가 PR 본문에 기록된다.
- 감사표상 1차 프론트 구현률이 최신 코드 기준으로 갱신된다.

## 이후 순서

\#390, \#391, \#392, \#393이 닫히면 에디터 프론트 1차 목표는 기능 구현 관점에서 100%로 본다. 이후 작업은 2차 목표로 이동한다.

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
