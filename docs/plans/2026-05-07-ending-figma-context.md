# 2026-05-07 Ending Figma Context

## 목적

닫힌 #280의 후속 구현자가 Figma에서 조정된 결말 질문/조건 UI 기준을 찾을 수 있도록, 현재 기준 프레임과 설계 결정을 repo 문서에 고정한다.

## Figma 기준 프레임

- 질문 관리 - 통합 / Desktop: https://www.figma.com/design/CErokaT60ctx8X0XhoO4bX?node-id=23-2
- 조건 만들기 모달 - 단일 답 / Component: https://www.figma.com/design/CErokaT60ctx8X0XhoO4bX?node-id=23-104
- 조건 만들기 모달 - 복수 답 / Component: https://www.figma.com/design/CErokaT60ctx8X0XhoO4bX?node-id=23-149

## 설계 기준

- 질문 관리는 결말 하위 탭이 아니라 독립된 제작자 페이지처럼 다룬다.
- 질문 원본은 결말별로 복제하지 않고, 게임 종료 시점에 묻는 공통 질문 풀로 관리한다.
- 모든 질문은 선택지별 점수 가감값을 가질 수 있다.
- 질문마다 `결말 규칙에서 사용` 체크를 둔다. 체크된 질문만 결말 설정의 조건 소스로 표시한다.
- `누구에게 보여줄지`는 기존 캐릭터 선택 패턴을 재사용한다. `모든 플레이어`는 별도 모드가 아니라 선택 목록의 특수 항목으로 둔다.
- 결말 설정의 `조건 만들기`는 페이지 내부 펼침이 아니라 모달로 연다.
- 단일 답 질문의 조건 모달은 답 하나를 선택하고 집계 기준을 `과반수`, `동률 과반수`, `한명이상` 중에서 고른다.
- 복수 답 질문의 조건 모달은 답 여러 개를 선택하고 집계 기준을 `모두 정답`, `하나라도 정답` 중에서 고른다.
- 모달은 선택 결과를 비개발자 제작자가 이해할 수 있는 완성 문장으로 보여준다.

## 연결 문서

- `docs/plans/2026-05-05-issue-280-ending-ux/design.md`
- `docs/superpowers/specs/2026-05-01-phase-24-editor-redesign/design.md`
- `apps/web/AGENTS.md`

