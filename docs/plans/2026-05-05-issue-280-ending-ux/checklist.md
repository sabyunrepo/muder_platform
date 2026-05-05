# Issue #280 — 결말 UX 설계 체크리스트

## 목표

- [x] #280을 Phase 25 editor-front P2의 선행 설계 이슈로 확정한다.
- [x] #330 캐릭터 엔드카드와 #293 결말 runtime 계약이 #280 정책에 의존함을 명시한다.
- [x] 외부 narrative tool 사례와 MMP 기존 계약을 비교해 결말 UX 방향을 정한다.
- [x] GitHub Issue #280에 남길 설계 요약과 후속 PR 순서를 확정한다.
- [x] #330/#293은 이미 닫힌 후속 기준으로 확인하고, #280 문서에 현재 상태를 반영한다.

## 권장 구현 순서

1. #280-A — 제작자 결말 설정 UI: 공통 결말 본문, 결과 화면 표시 문구, 감상 공유 탭 on/off만 먼저 제공한다.
2. #293 — ending flow node와 `ending_branch` runtime 계약 cleanup/validation을 고정한다.
3. #330 — 캐릭터 엔드카드: character-owned media/text를 result UX에서 읽는 확장으로 분리한다.
4. #280-B — GM 보정/수동 override: runtime 권한과 감사 로그가 정해진 뒤 별도 PR로 구현한다.

## 완료 조건

- #280 설계 PR은 code/docs 중심으로 작게 끝낸다.
- 구현 PR은 UI-only, runtime cleanup, 캐릭터 엔드카드, GM override로 나눈다.
- 사용자 결정이 필요한 GM override 공개 범위는 구현 전에 별도 확인한다.
- GitHub Issue #280은 PR 본문 `Closes #280`으로 연결해 merge 시 자동 종료한다.

## 검증

- [x] `git diff --check`
- [x] 문서 링크와 Issue 번호가 실제 존재하는지 확인
