# PR-4: 페이즈 타임라인 UI

## 개요
게임 흐름(페이즈 순서, 시간, 라운드)을 시각적으로 편집.

## scope_globs
- apps/web/src/features/editor/components/design/FlowSubTab.tsx
- apps/web/src/features/editor/components/design/PhaseTimeline.tsx
- apps/web/src/features/editor/components/design/PhaseCard.tsx

## 구현
1. PhaseTimeline: 수평 카드 나열 (Start → Phase1 → Phase2 → ... → End)
2. PhaseCard: 타입(intro/investigation/discussion/voting/reveal/result), 시간(분), 라운드 수
3. 추가/삭제 버튼, 순서 변경 (위/아래 화살표)
4. 프리셋: "표준 머더미스터리" 버튼 → 기본 5페이즈 자동 생성
5. config_json.phases 배열로 저장

## 페이즈 타입
- intro: 소개 (reading 모듈)
- investigation: 조사 (탐색+단서)
- discussion: 토론 (채팅)
- voting: 투표
- reveal: 공개
- result: 결과

## 테스트
- 페이즈 추가/삭제
- 프리셋 적용
- 시간 설정
