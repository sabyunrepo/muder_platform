# Phase 25 — #277 에디터 엔티티 실제 페이지 반영 검수

## 목표

GitHub Issue [#277](https://github.com/sabyunrepo/muder_platform/issues/277)의 audit 결과를 main 기준으로 고정한다. 기준선은 2026-05-04 08:19 UTC에 확인한 `origin/main` HEAD `f66f89e`(`chore: 병렬 이슈 설계 워크플로 추가`)이다.

검수 질문은 네 가지다.

1. Phase 24~25에서 만든 Adapter/Engine 엔티티가 실제 제작자 화면에 연결되어 있는가?
2. 제작자가 몰라도 되는 내부 ID, raw JSON, module key, legacy shape가 기본 UI에 노출되는가?
3. 모바일 폭에서 좌우 분할이나 고정 패널 때문에 편집이 깨질 위험이 있는가?
4. 다음 구현 이슈 #278~#285 중 어디에 후속 작업을 연결해야 하는가?

## 감사 방식

- `mmp-parallel-coordinator`가 read-heavy 병렬 감사 범위와 중단 조건을 먼저 정리했다.
- `mmp-frontend-editor-reviewer`는 실제 `apps/web` route, tab, component, adapter 연결을 점검했다.
- `mmp-backend-engine-reviewer`는 `apps/server` editor API, runtime engine, redaction, 저장 계약을 점검했다.
- `mmp-test-coverage-reviewer`는 E2E/Vitest/Go focused validation과 coverage gap을 점검했다.
- 메인 Codex는 각 결과를 중복 제거해 엔티티별 상태, 후속 이슈 매핑, 검증 명령으로 통합했다.

## 핵심 결론

대부분의 Phase 24 엔티티는 dev preview가 아니라 실제 제작자 에디터 라우트에 연결되어 있다. 다만 다음 항목은 후속 작업이 필요하다.

- **P1 — Deck investigation UI 누락**: adapter/test는 있으나 실제 제작자 UI 사용처가 확인되지 않았다.
- **P1 — Advanced 탭 raw `config_json` 과노출**: 기본 에디터 탭에서 내부 저장 JSON을 직접 편집/저장한다.
- **P1 — backend save-time validation 부족**: `config_json` 저장 시 module별 schema/reference 검증이 약해, 저장은 성공하지만 runtime에서 깨질 수 있다.
- **P2 — `/editor/:id/endings` 직접 진입 누락**: 결말 subtab은 UI에 있지만 route segment map에 `endings`가 빠져 직접 URL 진입 회귀 위험이 있다.
- **P2 — 모바일 레이아웃 위험**: Story split, Media detail, Flow canvas는 390px 폭 실제 검증이 부족하다.
- **P2 — Media metadata 과노출**: `type`, `source`, `mime`, `size` 같은 시스템 성격 값이 기본 상세에 표시된다.

## 엔티티별 실제 페이지 반영 상태

| 엔티티 | 실제 페이지 반영 | 근거 파일 | 판정 | 후속 연결 |
| --- | --- | --- | --- | --- |
| 캐릭터 | 연결됨 | `apps/web/src/features/editor/components/CharactersTab.tsx`, `apps/web/src/features/editor/components/design/CharacterAssignPanel.tsx` | 목록, 배정, 역할, 역할지, 시작 단서, 히든 미션 편집 가능 | #280 일부, mission은 현재 유지 |
| 단서 | 연결됨 | `apps/web/src/features/editor/components/CluesTab.tsx`, `apps/web/src/features/editor/components/clues/ClueEntityWorkspace.tsx`, `ClueRuntimeEffectCard.tsx` | 목록/관계/런타임 효과 카드 연결. raw 효과 저장 계약 보강 필요 | #278 |
| 장소 | 연결됨 | `apps/web/src/features/editor/components/design/LocationsSubTab.tsx`, `LocationDetailPanel.tsx`, `LocationClueAssignPanel.tsx` | 맵/장소/이미지/라운드/접근 제한/발견 단서 연결. runtime shape와 save-time validation 보강 필요 | #279 |
| 페이즈 | 연결됨 | `apps/web/src/features/editor/components/design/FlowSubTab.tsx`, `FlowCanvas.tsx`, `PhaseNodePanel.tsx` | flow canvas와 phase detail 연결. 모바일 터치 편집 검증 필요 | #282/#283 error recovery, 별도 UX 보강 후보 |
| 정보 전달 | 연결됨 | `apps/web/src/features/editor/components/reading/ReadingSectionList.tsx`, `InformationDeliveryPanel.tsx`, `apps/server/internal/module/progression/information_delivery` | phase action 기반 runtime redaction/idempotency는 있음. reading section 삭제 backlink 검증 필요 | #283 또는 후속 cleanup |
| 결말 | 연결됨 | `apps/web/src/features/editor/components/design/EndingEntitySubTab.tsx`, `EndingBranchRulesPanel.tsx`, `apps/server/internal/module/decision/ending_branch` | 결말 목록/본문/분기 규칙 연결. 캐릭터별 본문/GM override/직접 URL 보강 필요 | #280 |
| 스토리/텍스트 | 연결됨 | `apps/web/src/features/editor/components/StoryTab.tsx`, `ReadingSectionList.tsx` | 본문 Markdown과 정보 섹션 연결. 모바일 split 위험 있음 | #282 UX recovery 또는 별도 responsive 보강 |
| 미션 | 연결됨 | `apps/web/src/features/editor/components/design/MissionEditor.tsx`, `apps/server/internal/module/decision/hidden_mission` | 캐릭터 배정 상세에서 편집 가능. runtime redaction은 backend 소유 | #280 후속 종료/mission breakdown과 연결 가능 |
| 덱 조사 | 실제 UI 연결 미확인 | `apps/web/src/features/editor/entities/deckInvestigation/deckInvestigationAdapter.ts` | adapter/test 외 사용처가 확인되지 않음 | #279에 우선 연결, 필요 시 별도 issue |
| 미디어 | 연결됨 | `apps/web/src/features/editor/components/media/MediaTab.tsx`, `MediaDetail.tsx`, `apps/server/internal/domain/editor/media_service.go` | 목록/업로드/상세/삭제 참조 차단 연결. metadata 과노출과 모바일 고정 폭 위험 | #282/#283 |

## 과노출 UI

| 심각도 | 위치 | 내용 | 사용자 영향 | 권장 처리 |
| --- | --- | --- | --- | --- |
| P1 | `AdvancedTab.tsx` | `config_json` 전체 편집/저장 | 제작자가 내부 구조를 만져 게임 설정을 망가뜨릴 수 있음 | #282/#283에서 안전한 recovery와 함께 admin/debug gate 또는 creator-safe 검증 UI로 분리 |
| P2 | `MediaDetail.tsx` | `type`, `source`, `mime`, `size` 표시 | 제작자에게 의미가 약한 시스템 값이 보임 | #282 또는 #283에서 “파일 종류/출처/용량” 같은 안전한 문구로 변환 |
| P2 | `BranchNodePanel.tsx` 계열 | edge fallback label이 내부 edge id로 보일 수 있음 | 분기 조건 이해가 어려워짐 | #280에서 creator-facing branch label 보강 |

## 반응형 문제 후보

| 심각도 | 위치 | 근거 | 증상 |
| --- | --- | --- | --- |
| P2 | `StoryTab.tsx` | split mode가 `w-1/2` 중심 | 모바일에서 본문/정보 섹션이 너무 좁아짐 |
| P2 | `MediaTab.tsx` | list/detail 가로 flex + detail `w-96` | 390px 폭에서 상세 패널이 화면을 밀 수 있음 |
| P2 | `FlowCanvas.tsx` | React Flow canvas 중심 편집 | 모바일 터치 조작 난도가 높고 실제 E2E가 없음 |

## Backend/API/Engine gap

| 심각도 | 위치 | 내용 | 후속 연결 |
| --- | --- | --- | --- |
| P1 | `apps/server/internal/domain/editor/service_config.go` | `config_json` 저장 시 module별 schema/reference validation이 부족 | #281/#283/#284 |
| P1 | `apps/server/internal/module/core/clue_item_effects.go` + editor clue CRUD | runtime `itemEffects`와 CRUD `use_effect` 계약이 분리되어 있음 | #278 |
| P1 | `apps/server/internal/module/exploration/location_clue.go` | runtime이 frontend `locationClueConfig` / `requiredClueIds` / `oncePerPlayer` 계약을 충분히 해석하지 않음 | #279 |
| P2 | `apps/server/internal/domain/editor/reading_service.go` | reading section 삭제 시 phase information delivery backlink cleanup/block 검증 필요 | #283 또는 별도 cleanup |
| P2 | `apps/server/internal/module/exploration/deck_investigation/contract.go` | contract는 있으나 editor UI/runtime 연결이 얇음 | #279 또는 별도 issue |

## 테스트 gap

| 영역 | 현재 근거 | gap | 권장 후속 |
| --- | --- | --- | --- |
| 실제 route smoke | `apps/web/e2e/editor-golden-path.spec.ts` | `/editor/:id/endings` 직접 진입 누락 | [#280](https://github.com/sabyunrepo/muder_platform/issues/280) 또는 별도 작은 route fix PR |
| 캐릭터 | `phase24-editor-character-role.spec.ts`, adapter tests | 모바일 390px 실제 검증 부족 | [#278](https://github.com/sabyunrepo/muder_platform/issues/278)~[#280](https://github.com/sabyunrepo/muder_platform/issues/280) 구현 PR에 responsive smoke 분산 |
| 단서 | `ClueRuntimeEffectCard.test.tsx`, `editor-golden-path.spec.ts` | raw `itemEffects`/module key 비노출 E2E 부족 | [#278](https://github.com/sabyunrepo/muder_platform/issues/278) |
| 장소 | 장소 route smoke | 발견 단서 추가/삭제, 조건/중복 지급 실제 저장 flow 부족 | [#279](https://github.com/sabyunrepo/muder_platform/issues/279) |
| 결말 | `editor-phase-ending.spec.ts` | 캐릭터별 결말/GM 보정/직접 URL 없음 | [#280](https://github.com/sabyunrepo/muder_platform/issues/280) |
| 에러 복구 | backend handler/AppError 일부 | ProblemDetail 기반 editor/media/session/WS recovery E2E 부족 | [#281](https://github.com/sabyunrepo/muder_platform/issues/281)~[#283](https://github.com/sabyunrepo/muder_platform/issues/283) |
| 모바일 | `EntityEditorShell.test.tsx` 정도 | 실제 Playwright viewport 검증 없음 | [#278](https://github.com/sabyunrepo/muder_platform/issues/278)~[#280](https://github.com/sabyunrepo/muder_platform/issues/280)에 분산 |

## 수동/E2E 검수 기준

이번 PR은 audit 문서 전용 PR이므로 새 Playwright E2E나 스크린샷 산출물을 추가하지 않는다. 대신 기존 실제 라우트/E2E/Vitest/Go test의 coverage 상태를 읽기 중심으로 확인했고, 실제 화면 조작이 필요한 항목은 #278~#280 구현 PR에서 각 기능 변경과 함께 추가한다.

이유는 단순하다. 지금 E2E를 억지로 추가하면 실제 UI/API 보강 없이 “현재 부족한 동작”을 테스트가 고정할 수 있다. 제작자가 실제로 쓰게 될 조작 흐름은 #278 단서 효과, #279 장소 조사, #280 결말 UX에서 구현 범위가 확정된 뒤 테스트하는 편이 더 안전하다. 이번 PR에서 실제 실행한 검증 근거는 `checklist.md`의 “Focused validation evidence” 섹션을 기준으로 본다.

## 후속 이슈 매핑

- [#278](https://github.com/sabyunrepo/muder_platform/issues/278): 단서 runtime effect UI와 backend `itemEffects` 저장/검증 계약을 맞춘다.
- [#279](https://github.com/sabyunrepo/muder_platform/issues/279): 장소 발견 단서 runtime 계약을 맞추고, deck investigation UI 누락도 우선 여기에서 scope 확인한다.
- [#280](https://github.com/sabyunrepo/muder_platform/issues/280): 결말 직접 URL, 캐릭터별 결말, branch label, GM override 범위를 정리한다.
- [#281](https://github.com/sabyunrepo/muder_platform/issues/281): backend Error Registry + ProblemDetail과 editor config validation failure를 연결한다.
- [#282](https://github.com/sabyunrepo/muder_platform/issues/282): raw JSON/metadata 과노출을 사용자 복구 UI와 함께 줄인다.
- [#283](https://github.com/sabyunrepo/muder_platform/issues/283): editor/media/session/WebSocket 에러 경계와 reading section backlink failure를 안전하게 노출한다.
- [#284](https://github.com/sabyunrepo/muder_platform/issues/284): lazy normalizer 제거 전 canonical config와 module validation을 검증한다.
- [#285](https://github.com/sabyunrepo/muder_platform/issues/285): PR watcher 운영/CI 후속이다. 이번 editor 실제 페이지 구현과 직접 관련이 없으므로 기능 작업을 막지 않는다.

## 이번 #277 PR 범위

- audit 문서 작성과 후속 이슈 연결만 수행한다.
- 대규모 UI/Adapter/Engine 구현은 하지 않는다.
- 작은 route fix도 이번 PR에는 포함하지 않고 #280 또는 별도 후속으로 둔다.

## 검증 계획

PR 전 focused validation:

```bash
pnpm --filter @mmp/web exec tsc --noEmit
pnpm --filter @mmp/web exec vitest run src/pages/__tests__/EditorPage.test.tsx src/features/editor/entities/shell/EntityEditorShell.test.tsx src/features/editor/entities/character/__tests__/characterEditorAdapter.test.ts src/features/editor/entities/clue/__tests__/clueEntityAdapter.test.ts src/features/editor/entities/location/__tests__/locationEntityAdapter.test.ts src/features/editor/entities/ending/__tests__/endingEntityAdapter.test.ts src/features/editor/entities/phase/__tests__/phaseEntityAdapter.test.ts
cd apps/server && go test ./internal/domain/editor ./internal/engine ./internal/module/decision/ending_branch ./internal/module/exploration/... ./internal/module/progression/...
```

E2E는 이번 PR이 문서-only이므로 full run 대신 기존 coverage gap으로 문서화한다. 후속 구현 PR에서는 각 이슈별 Playwright flow를 추가한다.
