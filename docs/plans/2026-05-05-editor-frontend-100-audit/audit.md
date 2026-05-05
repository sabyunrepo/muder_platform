# Phase 25 — 에디터 프론트 1차 목표 100% 기준 감사표

## 목표

사용자가 실제 `http://localhost:3000/editor/{themeId}`에서 새 Entity Editor 기반 제작 흐름을 확인하고, 내부 JSON 없이 게임 제작에 필요한 핵심 설정을 만들 수 있는 상태를 1차 목표 100%로 정의한다.

2차 목표는 1차에서 저장한 제작물을 backend runtime, engine, game screen이 해석해 실제 플레이 가능한 게임으로 연결하는 것이다.

## 1차 목표 100% 정의

제작자가 다음 제작 단위를 실제 에디터 화면에서 생성, 수정, 저장, 검토할 수 있으면 1차 목표를 완료로 본다.

- 스토리와 장면 흐름
- 등장인물
- 단서
- 장소
- 조건
- 트리거
- 정보 공개
- 단서 조사
- 조사권
- 토론방
- 연출
- 결말
- 미디어 리소스

완료 판정은 단순 컴포넌트 존재가 아니라 다음 기준을 모두 만족해야 한다.

1. 실제 `/editor/{themeId}` 또는 그 하위 직접 URL에서 접근 가능하다.
2. 제작자가 raw `config_json`, 내부 module key, DB ID를 직접 다루지 않는다.
3. 새 `EntityEditorShell` 또는 동등한 creator-facing UI 패턴으로 목록, 상세, 생성, 삭제, 저장 흐름이 있다.
4. 저장 결과가 adapter/ViewModel 경계를 통과한다.
5. 모바일 폭에서도 주요 흐름이 좌우 고정 패널 때문에 깨지지 않는다.
6. focused Vitest 또는 Playwright smoke가 있다.

## 현재 구현률 요약

현재 스토리 중심 리빌드 PR stack 기준 체감 구현률은 약 **95%**다.

2026-05-05 story-centered 보정 기준:

- #387은 merge되어 `/editor/:id` 기본 제작 흐름을 `스토리 진행` 화면으로 전환했다.
- #390이 merge되면 좌측 제작 라이브러리가 실제 entity read hook 기반으로 연결된다.
- #391이 merge되면 우측 장면 속성 패널이 선택 장면과 연결 대상을 함께 보여준다.
- #392가 merge되면 기존 characters/clues/locations/endings/media 페이지는 direct URL을 유지한 보조 관리 화면으로 정리된다.
- #393이 merge되면 story-centered direct URL, alias URL, 모바일/데스크톱 smoke gate가 문서와 테스트에 고정되어 에디터 프론트 1차 목표는 기능 구현 관점에서 **100% 완료**로 판정한다.
- 이후 남는 작업은 1차 프론트 기능 추가가 아니라 2차 목표인 backend 저장/검증, runtime engine, game screen으로 분류한다.

- 높은 영역: route migration, 캐릭터, 단서 기본, 장소 기본, 결말 기본, 미디어 라이브러리
- 중간 영역: 스토리/장면 요약, 조건, 트리거, 정보 전달
- 낮은 영역: 단서 조사, 조사권, 토론방, 연출 cue, creator-safe advanced/raw JSON 제거, 모바일 smoke

## 감사표

| 제작 단위           | 현재 상태              | 근거                                                                                                               | 1차 100%까지 남은 것                                                                      | 연결 이슈                          | 우선순위     |
| ------------------- | ---------------------- | ------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------- | ---------------------------------- | ------------ |
| `/editor/:id` route | P0 수용 게이트 진행 중 | `EditorPage.tsx`, `routeSegments.ts`, `EditorPage.test.tsx`, `routeSegments.test.ts` | #386에서 story map 기본 진입, `/story-map`, `/story`, 기존 entity direct URL, 390px/desktop smoke를 merge하면 완료 | #386                               | P0           |
| 스토리/장면         | 기반 완료              | #299 CLOSED, `StoryTab.tsx`, `StorySceneSummary.tsx`, `storySceneAdapter.ts`                                       | 장면 하위 블록이 실제 편집 화면 안에 모이는지 최종 polish                                 | #302, #290, #303, #305             | P0 완료 기반 |
| 조건                | 기반 완료              | #301 CLOSED, `ConditionBuilder.tsx`, `conditionTypes.ts`, `conditionAdapter.ts`                                    | 각 기능에서 조건 선택지를 실제 데이터로 채우고 raw shape 숨김 유지                        | #302, #290, #304, #303, #305, #329 | P0 완료 기반 |
| 트리거              | 기반 완료              | #300 CLOSED, `ActionListEditor.tsx`, `EntityTriggerPlacementCard.tsx`, `eventProgressionConfig.ts`                 | 결과 타입을 정보 공개/조사권/토론방/연출과 연결                                           | #302, #304, #303, #305             | P0 완료 기반 |
| 등장인물            | 대부분 완료            | #306/#331 merge, `CharactersTab.tsx`, `characterEditorAdapter.ts`                                                  | 조건부 이름/아이콘, 엔드카드 소유권                                                       | #329, #330                         | P2           |
| 단서                | 대부분 완료            | `CluesTab.tsx`, `ClueEntityWorkspace.tsx`, `ClueRuntimeEffectCard.tsx`                                             | 단서 조사와 획득 방식 연결, 단서 사용 효과와 조사 결과의 관계 정리                        | #290                               | P1           |
| 장소                | 대부분 완료            | `LocationsSubTab.tsx`, `LocationDetailPanel.tsx`, `LocationClueAssignPanel.tsx`                                    | 장소 안의 단서 조사 블록을 제품 용어로 연결                                               | #290                               | P1           |
| 정보 공개           | 일부 완료              | `ReadingSectionList.tsx`, `InformationDeliveryPanel.tsx`, `informationDeliveryAdapter.ts`                          | 스토리 장면 하위 블록으로 그룹/조건/대상 편집                                             | #302                               | P1-1         |
| 단서 조사           | 낮음                   | `deckInvestigationAdapter.ts`, #277 audit의 UI 연결 미확인                                                         | 장소/스토리 장면에서 조사 대상 단서, 조건, 공개 정책, 조사권 비용 편집                    | #290                               | P1-2         |
| 조사권              | 낮음                   | `conditionTypes.ts`에 조건 변수 존재, #304 open                                                                    | 전역/단서 조사 하위 설정 UI, 초기 배포, 소비 정책                                         | #304                               | P1-3         |
| 토론방              | 낮음                   | `conditionTypes.ts`에 토론방 상태 변수 존재, room/chat runtime은 별도                                              | 장면별 메인 토론방/밀담방/조건부 접근 정책 편집                                           | #303                               | P1-4         |
| 연출                | 낮음~중간              | `MediaTab.tsx`, `MediaPicker.tsx`, `play_bgm` action label                                                         | 장면/트리거에 BGM, SE, 영상, 배경 cue를 raw JSON 없이 연결                                | #305                               | P1-5         |
| 결말                | 기본 완료              | `EndingEntitySubTab.tsx`, `EndingBranchRulesPanel.tsx`, #280 open                                                  | 캐릭터별 결말, GM 보정, 감상 공유, 엔드카드                                               | #280, #330, #293                   | P2           |
| 미디어              | 기본 완료              | `MediaTab.tsx`, `MediaDetail.tsx`, `mediaResourceAdapter.ts`                                                       | metadata 과노출 축소, 모바일 상세 패널 개선, 연출 picker와 연결                           | #305, #282                         | P1/P2        |
| Creator-safe polish | 병행 guard             | `AdvancedTab.tsx`, `MediaDetail.tsx`, #277 audit                                                                   | 스토리 중심 화면이 기본 진입이 되었으므로 raw/debug 화면은 보조 설정 영역에서 별도 polish | #282, #283                         | P1 병행      |
| 저장/검증 안정성    | 프론트 일부            | adapter tests 다수, backend validation gap 존재                                                                    | 프론트 1차 PR마다 focused 저장 테스트. backend 최종 검증은 2차로 이동                     | #281, #283, #294                   | 병행 guard   |

## 구현 순서 재정렬

### P0. 이미 완료된 기반으로 간주

1. #307 — MMP식 엔티티 통폐합 구조와 우선순위 재정렬
2. #299 — 장면 기반 스토리 Editor와 runtime 진행 계약
3. #301 — 공통 조건 블록과 backend runtime 판정 계약
4. #300 — 장면·단서·장소 트리거 블록과 runtime 실행 계약
5. #288 — 실제 `/editor/:id` route migration

이 그룹은 닫힌 이슈 또는 이미 PR에 반영된 기반이다. 새 기능 PR은 여기의 용어와 route 구조를 깨지 않는 것을 전제로 한다.

### P1. 에디터 프론트 1차 목표 100% 핵심

1. #302 — 정보 공개
   - 이유: 스토리 장면 안에서 “누구에게 무엇을 보여줄지”가 먼저 잡혀야 단서 조사, 토론방, 연출의 화면 배치도 자연스럽다.
2. #290 — 단서 조사
   - 이유: 단서는 이미 있지만 “어디서 어떻게 얻는지”가 아직 제작 흐름에 약하다. 기존 `deckInvestigation`은 제품 용어 `단서 조사`로 흡수한다.
3. #304 — 조사권
   - 이유: 단서 조사 비용/제한 자원이다. #290의 no-cost MVP가 먼저 가능하면 #290 직후, 비용 설정까지 한 화면에 필요하면 #290과 같은 PR 묶음에서 작게 연결한다.
4. #303 — 토론방
   - 이유: 장면별 플레이 공간 정책이다. 스토리 장면 구조와 조건 계약을 소비한다.
5. #305 — 연출
   - 이유: 미디어 리소스와 트리거 결과를 이어주는 presentation cue다. 핵심 제작 흐름을 해치지 않는 선에서 마지막에 붙인다.
6. #282/#283 — creator-safe error/recovery polish
   - 이유: raw JSON, metadata 과노출, 저장 실패 복구는 기능 PR 중간중간 작은 PR로 병행해야 한다.

### P2. 에디터 프론트 확장과 결과 UX

1. #329 — 조건부 이름·아이콘
2. #280 — 캐릭터별 결말·감상 공유·GM 보정
3. #330 — 캐릭터 엔드카드와 결말 UX 연결
4. #293 — Ending runtime source-of-truth cleanup

이 그룹은 제작 완성도를 높이지만, 정보 공개/단서 조사/조사권/토론방/연출이 먼저 정리되어야 사용자 흐름이 안정된다.

### P3. 기능 작업 blocker가 아닌 운영/정리

1. #281 — Backend Error Registry + ProblemDetail
2. #294 — Flow editor API ownership security
3. #284 — legacy normalizer 제거 조건
4. #285 — PR watcher 운영 개선

보안/검증 이슈는 무시하지 않는다. 다만 “에디터 프론트 1차 목표 100%”의 메인 구현 순서를 막는 umbrella로 두지 않고, 기능 PR과 충돌하지 않는 작은 PR로 병행한다.

## 2차 목표

2차의 1차 목표는 frontend 1차에서 저장한 제작물을 backend가 같은 의미로 받아들이는 것이다.

### 2차-A. Backend 저장/검증 정합성

- editor API가 스토리, 조건, 트리거, 정보 공개, 단서 조사, 조사권, 토론방, 연출, 결말 저장 shape를 검증한다.
- module schema/reference validation을 save-time에 적용한다.
- 삭제나 이름 변경 시 backlink cleanup 또는 block 정책을 transaction 안에서 처리한다.

### 2차-B. Runtime Engine

- backend engine이 조건 평가, 트리거 실행, 정보 공개, 단서 조사, 조사권 소비, 토론방 접근, 연출 broadcast, 결말 판정을 최종 책임진다.
- frontend는 engine 결과를 보여주고 사용자의 요청을 보낼 뿐, 런타임 판정을 흉내 내지 않는다.
- player-aware redaction으로 다른 플레이어에게 숨겨야 할 단서, 정보, 선택지, 결말 근거를 공개하지 않는다.

### 2차-C. Game Screen

- 플레이어가 스토리 장면을 읽고, 단서를 조사하고, 조사권을 소비하고, 토론방을 오가고, 연출을 보고, 결말을 확인하는 화면을 설계한다.
- GM/host 화면은 진행 제어, 강제 트리거, 오류 복구, 현재 공개 상태 확인을 제공한다.
- 모바일 플레이를 기본 대상으로 두고, 편집 화면과 달리 “읽기, 선택, 확인” 중심의 단순한 조작으로 만든다.

## 이슈 반영 기준

GitHub Issue에는 다음 문장을 공통 기준으로 남긴다.

> 2026-05-05 우선순위 재정렬: 1차 목표는 에디터 프론트 제작 흐름 100%다. 이 이슈는 backend/game runtime 완성보다 먼저, 제작자가 실제 `/editor/{themeId}`에서 raw JSON 없이 해당 제작 블록을 설정·저장할 수 있는지를 우선 완료 조건으로 본다. Backend runtime/engine/game screen은 2차 목표에서 같은 저장 계약을 해석하도록 맞춘다.

## 검증 기준

공통 focused validation:

```bash
pnpm --filter @mmp/web exec tsc --noEmit
pnpm --filter @mmp/web exec vitest run src/pages/__tests__/EditorPage.test.tsx
```

각 기능 PR은 변경 파일에 맞춰 관련 component/adapter tests를 추가한다. route 또는 모바일 흐름이 바뀌면 Playwright smoke를 추가한다.
