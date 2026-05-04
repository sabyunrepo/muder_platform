# Issue #262 — Deck/Token Investigation Adapter/Runtime 경계 정리

## Uzu 참고점
- `basic-features/decks.md`: 덱은 토큰을 소비해 단서를 획득한다. 소비 토큰은 덱 단위로 고정되고, 단서별 지급 방식은 덱 카드 설정에서 정한다.
- `basic-features/decks.md`: 덱은 페이즈 내용에 배치하며, 덱 조사 페이즈에서는 토큰 표시도 같이 두는 것을 권장한다.
- `advanced/investigation.md`: 장소 조사는 투표/선택과 단서 배포를 조합해 만들 수 있고, 중복 선택 금지 같은 플레이어별 제한이 중요하다.

## MMP 적용 방식
- 제작자 UI/Adapter는 “어떤 덱을 어느 페이즈/장소에서 실행하고, 어떤 토큰을 몇 개 소비하며, 어떤 단서를 어떤 방식으로 받는가”만 다룬다.
- Frontend Adapter는 `modules.deck_investigation.config`를 읽고 쓴다. 내부 storage key/raw JSON은 UI에 직접 노출하지 않는다.
- Backend Engine 계약은 덱 실행 가능 여부, 토큰 잔액, 페이즈/장소/캐릭터 제한, 지급 카드 공개 정책을 판단한다.

## #247/#248과의 책임 경계
- #247 단서 효과 Engine: 이미 소유한 단서를 “사용”했을 때의 효과 실행 담당.
- #248 장소 조사 Runtime: 장소 진입/조사 이력/반복 조사 제한 담당.
- #262 Deck/Token Investigation: 토큰 소비와 덱 카드 지급 담당. 장소/페이즈 조건은 입력으로 받되, 장소 이동 자체나 단서 사용 효과는 실행하지 않는다.

## 완료 조건
- [ ] Frontend Deck/Token Adapter와 단위 테스트
- [ ] Backend runtime contract와 Go 테스트
- [ ] 기존 config를 보존하는 read/write helper
- [ ] Codecov patch coverage 70% 이상
- [ ] PR 본문에 E2E 작성/대체 사유 명시

## 후순위
- 실제 장소 조사 화면 저장 E2E는 UI가 붙는 PR에서 추가한다.
- Deck draw 결과를 단서 인벤토리/공개 상태에 반영하는 전체 runtime integration은 #247/#248 경계 확정 후 연결한다.
