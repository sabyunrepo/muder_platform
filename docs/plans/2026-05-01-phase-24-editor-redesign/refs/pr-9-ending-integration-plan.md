# PR-9 — 결말/통합 Adapter-Engine 검증 계획

## 목표

Issue #236 범위의 1차 통합을 닫는다. 제작자가 만든 결말 노드와 런타임 `ending_branch` 판정이 같은 흐름에서 동작하도록 연결하고, 플레이어별 상태에서 다른 사람의 답변이 보이지 않게 검증한다.

## Uzu 참고점

- `phase/flow.md`: 단계 흐름은 기본 전이와 조건 전이를 함께 둔다. 조건 전이는 위에서부터 우선순위를 가진다.
- `phase/discussion.md`: 단계 안에 텍스트, 이미지, 액션, 투표 같은 실행 항목을 추가한다.
- `textTab.md`: 공통/개별 텍스트를 한곳에서 관리하고 특정 단계·캐릭터·조건에 따라 배포한다.
- `phase/select.md`: 투표는 단계 안의 투표 박스이며, 투표 가능 대상·열람 대상·표시 조건을 분리한다.

## MMP 적용 방식

- Uzu를 그대로 복제하지 않고, MMP는 `Frontend Adapter`와 `Backend Engine`으로 나눈다.
- 프론트 결말 화면은 제작자가 알아야 할 “결말 수, 본문 작성 상태, 도달 경로”만 보여준다. 내부 module key, raw JSON, DB ID 같은 정보는 숨긴다.
- 백엔드는 `EVALUATE_ENDING` phase action을 통해 `ending_branch` 엔진을 실행한다.
- `ending_branch`는 질문 답변을 저장하고, JSONLogic 조건 매트릭스를 우선순위대로 평가해 결말을 선택한다.
- 플레이어 재접속 상태는 `BuildStateFor`를 통해 자기 답변만 포함한다.

## 이번 PR 포함

1. Backend
   - `ActionEvaluateEnding = "EVALUATE_ENDING"` 추가
   - phase action 사용 시 `ending_branch` implicit module 자동 추가
   - `ending_branch` answer submit 처리
   - 우선순위 매트릭스 평가 및 `ending.evaluated` 이벤트 발행
   - player-aware state redaction
2. Frontend
   - 결말 entity adapter 추가
   - 결말 목록에 제작자용 준비 상태 요약 추가
   - 결말 상세 문구에서 엔진 내부 정보를 숨기고 플레이어 공개 본문 작성에 집중
3. Tests
   - Go unit/integration: answer submit, matrix evaluation, implicit module
   - Vitest: ending adapter, 결말 entity UI
   - Playwright E2E: 결말 화면 smoke + 접근성

## 이번 PR 제외 / 후속

- 결말 질문/매트릭스 전체 편집 UI
- 캐릭터별 결말 본문
- 투표 결과와 결말 질문의 최종 우선순위 정책 UI
- GM override
- 기존 캐릭터·단서·장소 entity 전체 재마이그레이션

## 완료 조건

- [x] `ending_branch`가 `PublicStateMarker`가 아닌 `PlayerAwareModule`로 동작한다.
- [x] `submit_answer` 후 `BuildStateFor(playerA)`에 playerB 답변이 보이지 않는다.
- [x] `EVALUATE_ENDING` phase action이 `ending_branch`를 실행한다.
- [x] 결말 entity UI가 제작자에게 필요한 준비 상태만 보여준다.
- [x] Focused Go/Vitest/E2E 검증이 통과한다.
- [ ] PR 생성 전 코드 리뷰를 수행한다.
