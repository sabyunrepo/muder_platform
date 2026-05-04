# Issue #248 — 장소 조사 Runtime 및 장소 단서 발견 흐름

## 목표

장소를 조사했을 때 발견 가능한 단서를 백엔드 Runtime Engine이 결정하도록 최소 계약을 만든다.
프론트는 이후 Adapter/UI에서 “이 장소를 조사하면 발견할 단서”로 보여준다.
실제 지급, 공개, 중복 방지는 백엔드가 담당한다.

## Uzu 참고점

- Uzu는 단서를 “플레이 중 소유권이 있는 자산”으로 다룬다.
  배포 조건에서는 언제/누구에게/어떤 방식으로 줄지 나눈다.
- 조사 단계 예시는 투표 선택지와 단서 배포 조건을 조합해 조사 지점별 단서를 지급한다.
- 단서 회수, 전체 공개, 공유, 양도는 별도 조건으로 확장된다.

## MMP 적용 방식

Uzu의 조건 시스템을 그대로 복제하지 않는다.
MMP는 실시간 멀티플레이 runtime state를 우선한다.

- `location.discoveries[]` 계약으로 장소별 발견 후보 단서를 정의한다.
- `examine` 메시지를 받으면 Location Engine이 조건을 확인하고 발견 단서를 기록한다.
- 발견 단서는 player-aware state의 `discoveredClues`에 본인 것만 노출한다.
- 발견 시 `location.clue_discovered`와 `clue.acquired` 이벤트를 발행한다.
  후속 단서함/로그 연결은 이 이벤트를 재사용한다.
- 기본은 플레이어당 1회 발견이다. 반복 조사/토큰 소비/덱 차감은 후속 확장으로 둔다.

## 이번 PR 범위

- `LocationConfig.Discoveries` 추가
- `LocationClueDiscovery` 계약 추가
  - `locationId`
  - `clueId`
  - `requiredClueIds`
  - `oncePerPlayer`
- `LocationModule.handleExamine`에서 발견 후보 처리
- player-aware `BuildStateFor`에 caller의 `discoveredClues`만 포함
- Save/Restore에 발견 상태 포함
- focused Go tests 추가

## 제외 / 후순위

- 장소 이미지 업로드/표시 UI 변경
- 프론트 장소 상세의 발견 후보 편집 카드
- 토큰/덱 소비형 조사
- 전체 공개/회수/양도 조건
- DB editor 삭제 cascade 변경

## 정합성 확인

- 장소 이미지와 기본 설명은 제작자/플레이어 표시 정보이며, 이번 runtime state에는 넣지 않는다.
- 발견 계약은 `locationId`와 `clueId`만 참조한다.
- runtime init은 존재하지 않는 `locationId`를 거부한다.
- clue catalog 검증과 삭제 cascade는 프론트 UI가 이 계약을 저장하는 후속 PR에서 editor service 경계로 연결한다.

## 검증

- `go test ./internal/module/crime_scene -run 'LocationModule'`
- `go test ./internal/module/core -run 'ClueInteraction|ClueItem'`

## 완료 조건

- 장소 조사 시 configured clue가 idempotent하게 발견된다.
- required clue 조건이 동작한다.
- 다른 플레이어에게 발견 단서 상태가 새지 않는다.
- 기존 clue interaction item effect 테스트가 깨지지 않는다.
