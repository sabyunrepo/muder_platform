# Phase 24 PR-7 — 단서 Adapter/Engine 이관 계획

## 상태

- GitHub Issue: [#234](https://github.com/sabyunrepo/muder_platform/issues/234)
- Branch: `feat/issue-234-clue-adapter-engine`
- 목표: 기존 단서 entity UI와 사용 효과 필드를 유지하면서, 프론트는 제작자용 Clue Adapter, 백엔드는 단서 사용/양도/소모 정책 Engine 경계로 정리한다.

## Uzu 참고점

Uzu 단서 문서에서 확인한 제작자 모델은 다음과 같다.

- 단서 기본 정보는 플레이 중 단서 목록/상세에 표시된다.
- 비공개 단서는 소유자 외 사용자에게 “비공개 시 제목 + 태그”만 보여줄 수 있다.
- 배포 조건은 “어떤 조건으로, 어떤 방식으로, 누구에게” 단서를 줄지 정한다.
- 소유권이 있는 단서는 전체 공개, 공유, 양도가 가능하다.
- 회수 조건을 두면 이미 배포된 단서를 다시 장에서 제거할 수 있다.
- 덱은 토큰을 소비해 단서를 얻는 별도 조사 시스템이다.
- 조건 그룹은 AND/OR 조합을 지원하지만 제작자 UI가 복잡해지기 쉽다.

## MMP 적용 방식

PR-7에서는 Uzu 구조를 그대로 복제하지 않고 MMP의 실시간 멀티플레이/백엔드 Engine 구조에 맞춰 다음만 적용한다.

1. 기존 단서 기본 정보, 라운드 공개 범위, 장소/시작단서/조합 backlink는 유지한다.
2. 현재 API 필드인 `is_usable`, `use_effect`, `use_target`, `use_consumed`를 제작자용 ViewModel로 변환한다.
3. 단서 사용 효과 1차 구현 범위는 현재 저장 스키마와 API 검증값을 기준으로 고정한다.
   - `peek`: 다른 플레이어 단서 보기
   - `steal`: 다른 플레이어에게서 단서 가져오기
   - `reveal`: 사용한 플레이어에게 정보 공개
   - `block`: 대상 플레이어의 다음 단서 사용 막기
   - `swap`: 선택 단서와 교환
   - `consume`: 독립 효과가 아니라 위 효과의 “사용 후 소모” 옵션으로 둔다.
4. Uzu식 공유/양도/보상/잠금 해제 모델은 이번 PR에서 이름만 바꾸어 저장하지 않는다. 현재 API와 런타임에 없는 `transfer`, `reveal_info`, `grant_clue`, `unlock_password`, `combine`은 후속 engine PR에서 명시 계약을 추가한다.
5. 백엔드는 frontend에서 온 문자열을 신뢰하지 않고 policy에서 허용 효과/대상/소모 조합을 검증한다.

## 제외 / 후순위

이번 PR에서 구현하지 않는다.

- 덱/토큰 조사 런타임: Uzu 문서상 별도 큰 시스템이므로 PR-8 이후 또는 Phase 25 후보로 둔다.
- 복잡한 조건 그룹 UI 전체 구현: 조건 엔진과 phase/ending 연동이 필요하므로 후속으로 둔다.
- 회수 조건 전체 구현: 단서 지급/소유권 ledger가 먼저 안정화된 뒤 다룬다.
- 비공개 단서 존재 표시 API 확장: 이번 PR에서는 adapter/plan 경계만 두고, player-aware inventory state 작업 때 구현한다.

## 구현 범위

### Frontend Adapter

- `ClueEntityAdapter` 추가
  - API `ClueResponse` → 제작자용 `ClueEditorViewModel`
  - 공개 범위, 등장 라운드, 사용 효과, 사용 후 처리, backlink 배지를 제작자 언어로 변환
  - 저장 가능한 `CreateClueRequest`/`UpdateClueRequest` payload helper 추가
- `ClueEntityWorkspace`에서 효과/배지/상세 문구 계산을 adapter로 이동한다.
- 기존 컴포넌트는 internal ID/raw JSON/config key를 노출하지 않는다.

### Backend Engine / Policy

- `ClueUsePolicy` 추가
  - `use_effect`, `use_target`, `use_consumed` 조합 정규화
  - 현재 API 효과(`peek/steal/reveal/block/swap`)와 대상(`player/clue/self`) 호환성 검증
  - unsupported effect/target 또는 mismatched target을 명확한 400 오류로 차단
- `CreateClue`/`UpdateClue`는 policy 결과를 사용해 저장한다.
- 현재 `clue_interaction` 모듈의 실제 구현과 충돌하지 않도록, runtime 미구현 효과는 저장 검증/계획 문서에만 범위를 고정하고 실행은 별도 engine PR로 분리한다.

## 테스트 계획

- Frontend unit
  - 단서 API 응답이 제작자용 ViewModel으로 변환된다.
  - `consume`이 독립 효과가 아니라 “사용 후 사라짐” 옵션으로 표시된다.
  - `steal/reveal/swap` 등 현재 API 효과가 제작자 언어로 안전하게 표시된다.
  - 배지/라운드/공개 범위 문구가 internal key 없이 표시된다.
- Existing frontend component test
  - `ClueEntityWorkspace` 상세/삭제/backlink 회귀 검증 유지.
- Backend unit
  - 사용 효과/대상/소모 조합 정규화
  - 잘못된 효과/대상 조합 400 차단
  - 기존 `peek/steal/reveal/block/swap` 저장 호환성 검증
- Focused commands
  - `pnpm --dir apps/web test -- src/features/editor/entities/clue/__tests__/clueEntityAdapter.test.ts src/features/editor/components/clues/ClueEntityWorkspace.test.tsx`
  - `pnpm --dir apps/web typecheck`
  - `go test ./internal/domain/editor -run 'TestClueUsePolicy|TestService_(CreateClue|UpdateClue|DeleteClue)|TestRemoveClueReferences'`

## 완료 조건

- 단서 UI가 기존 기능을 잃지 않는다.
- 단서 사용 효과 문구/저장 payload 생성이 React 컴포넌트에서 분리된다.
- 단서 사용 정책이 React 없이 Go test로 검증된다.
- 덱/토큰/복잡 조건/회수 조건은 후속으로 안전하게 이어질 수 있는 경계가 문서화된다.
