# PR-5: 통합 + supported 플래그 최종

## 개요
전체 모듈 supported 플래그 정리, 수동 통합 검증.

## scope_globs
- apps/web/src/features/editor/constants.ts
- apps/web/e2e/ (선택적)

## 태스크
1. constants.ts에서 hidden_mission, trade_clue, group_chat의 supported: true 업데이트
2. consensus_control 프론트엔드 필요 여부 확인 (script_progression이 대체하면 skip)
3. 메타포 시드 테마로 전체 게임 플로우 수동 검증
