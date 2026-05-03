# PR-8 — 장소 Adapter/Engine 이관 계획

## 상태

- Issue: #235 `[Phase 24][PR-8] 장소 Adapter/Engine 브레인스토밍 및 이관`
- Branch: `feat/issue-235-location-adapter-engine`
- 목표: 기존 장소 UI/저장 흐름을 유지하면서, 제작자 화면은 Frontend Adapter가 읽기 쉬운 ViewModel로 정리하고 런타임 판단은 Backend Engine 정책으로 분리한다.

## Uzu 참고점

- `basic-features/room.md`: 방/장소는 플레이어가 머무는 공간이며, 최소 1개 기본 공간은 항상 사용 가능해야 한다. 특정 방은 phase나 조건에 따라 사용 가능 여부를 바꿀 수 있다.
- `basic-features/decks.md`: 조사는 token/deck 기반으로 단서를 지급할 수 있으며, 실행 조건과 지급 단서의 공개 방식을 분리한다.
- `overview/available.md`: 조건은 AND/OR 조합으로 중첩될 수 있고, 방 조건/단서 배포/회수/비밀번호 단서 같은 기능을 제공한다.

## MMP 적용 방식

- 장소는 현재 `Map -> Location` 구조를 유지한다. 제작자는 내부 ID나 config key를 보지 않고 “어느 맵의 장소인지”, “언제 보이는지”, “누가 못 들어가는지”, “조사 시 발견 가능한 단서”만 관리한다.
- 접근 제한은 현재 저장 필드인 `restricted_characters`, `from_round`, `until_round`를 Backend Engine 정책으로 해석한다.
- 장소 단서는 이번 PR에서 “조사 시 발견 후보”로 표시하되, token/deck 소비와 조건부 조사 런타임은 후속 entity/engine PR에서 확장한다.
- 장소 이미지는 기존 R2 업로드/presign 흐름을 그대로 사용한다.
- 삭제 정합성은 기존 backend transaction cleanup을 유지하고, 장소 참조 제거 정책의 테스트 범위를 보강한다.

## 제외 / 후순위

- 무한 장소 트리 런타임, token/deck 조사 비용, 비밀번호 조사, 조건식 조합 UI는 이번 PR에서 구현하지 않는다.
- 단, 후속 확장이 막히지 않도록 adapter/engine 함수 경계를 작게 만든다.
- 제작자 화면에는 raw JSON, DB 필드명, internal ID, config key를 표시하지 않는다.

## 구현 범위

### Frontend Adapter

- `LocationEntityAdapter` 추가
  - API DTO -> 제작자 ViewModel 변환
  - 라운드 표시 문구, 접근 제한 요약, 단서 개수, 이미지 여부, 목록 배지 생성
  - CSV restricted character 문자열을 캐릭터 이름 요약으로 변환
- 장소 상세/목록에서 Adapter 파생 문구 사용
- 단서 배정 문구를 “조사 시 발견 단서”로 정리
- 모바일 우선 세로 흐름 유지

### Backend Engine Policy

- `LocationAccessPolicy` 추가
  - restricted character CSV 정규화
  - 라운드 표시 가능 여부 판단
  - 캐릭터 접근 가능 여부 판단
  - create/update 시 동일 정책으로 validation/normalization
- 기존 삭제 정합성 transaction 유지

## 테스트 계획

- Go unit test
  - restricted character CSV trim/dedupe/empty 처리
  - round window 검증과 접근 가능 여부
  - invalid round order 거부
- Vitest
  - Location adapter ViewModel 변환
  - 접근 제한 패널이 adapter 기준으로 사용자 문구/저장 payload 유지
  - 장소 상세/목록에서 내부 정보 없이 필요한 요약 표시
- Playwright E2E
  - 장소 탭 로드 시 위치/접근/조사 단서 UI가 보이는지 network-only fixture로 확인

## 완료 조건

- [ ] PR-8 계획과 checklist 상태가 최신이다.
- [ ] Frontend Adapter와 테스트가 있다.
- [ ] Backend Engine Policy와 테스트가 있다.
- [ ] 장소 E2E가 fixture 기반으로 보강되었다.
- [ ] focused `go test`, `vitest`, 가능하면 해당 E2E가 통과한다.
- [ ] PR 생성 전 코드 리뷰를 수행한다.
