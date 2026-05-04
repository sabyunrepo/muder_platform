# Phase 24 Wrap-up Tracking — main 기준 정리

## 목적

Phase 24의 에디터 Adapter/Engine 정리는 main에 1차 반영되었다. 이 문서는 다음 작업자가 기존 Phase 24 범위와 Phase 25 후보 런타임 확장을 혼동하지 않도록 기준선을 고정한다.

## 현재 완료

- PR-5A~PR-9: Adapter/Engine 공통 계약, 정보 전달, 캐릭터, 단서, 장소, 결말 통합 완료
- #250: legacy shape/dev preview/lazy normalizer sweep 완료
- #255~#259: 페이즈, 조건/액션/정보전달, 결말 UI, 스토리/텍스트, 미션/덱/미디어 Adapter 정리 완료
- #261 / PR #272: Mission Adapter/Engine 경계 정리 완료
- #260 Epic: 하위 Adapter 작업이 모두 닫혀 close 가능

## 후속 분리 기준

### 1. Runtime 기능 확장

기능을 실제 게임 중 동작으로 연결하는 작업은 Phase 25 후보로 분리한다.

- #247 단서 효과 Engine 계약 및 런타임 실행
- #248 장소 조사 Runtime 및 장소 단서 발견 흐름
- #249 결말/투표 결과 breakdown 및 종료 화면 연결

### 2. 에러 계약 표준화

에러 처리 표준화는 지금 기능 진행을 막는 작업이 아니므로 #271에서 별도 후보로 관리한다.

- RFC 9457 Problem Details 응답
- Google AIP-193 스타일의 일관된 error reason/code
- 프론트 severity별 UI 복구 전략
- correlation_id 전파

### 3. Cleanup / migration

lazy normalizer는 아직 제거하지 않는다. 제거 조건은 다음 중 하나가 충족될 때다.

1. 운영 DB/seed/preset 전체가 canonical shape임을 검증한다.
2. legacy read telemetry를 일정 기간 관찰해 0건임을 확인한다.
3. rollback 경로와 data backup을 포함한 별도 migration PR을 만든다.

## 제작자 UI 원칙

- 내부 ID, raw JSON, module key, legacy shape는 기본 화면에 노출하지 않는다.
- 제작자가 결정해야 하는 내용만 보여준다.
- 검수/저장 상태는 작업을 방해하지 않는 위치에 둔다.
- 모바일에서는 좌우 분할보다 세로 흐름을 우선한다.

## 권장 다음 순서

1. #247 단서 효과 Engine — 단서 사용/소모/지급이 다른 runtime과 가장 많이 연결된다.
2. #248 장소 조사 Runtime — 단서 발견 흐름이 #247의 효과 계약을 재사용할 수 있다.
3. #249 결말/투표 breakdown — 미션/단서/투표 결과를 모아 종료 화면에 표시한다.
4. #271 Error Contract — 런타임 API가 늘어나는 시점에 표준 에러 응답으로 묶는다.

## 완료 조건

- checklist 상태가 main과 일치한다.
- 다음 기능자가 어떤 이슈부터 시작할지 알 수 있다.
- Phase 24에서 의도적으로 미룬 항목이 추적 가능한 GitHub Issue로 분리되어 있다.
