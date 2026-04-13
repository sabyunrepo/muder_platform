# PR-7: 통합 + 유효성 검증

## 개요
전체 설정 유효성 검증 강화 + 수동 통합 테스트.

## scope_globs
- apps/web/src/features/editor/components/AdvancedTab.tsx
- apps/web/src/features/editor/

## 태스크
1. 유효성 검증 규칙 추가: 페이즈 0개 경고, 미배치 단서 경고, 미배정 캐릭터 경고
2. AdvancedTab의 검증 결과에 게임설계 관련 항목 표시
3. 메타포 시드 테마로 전체 설정 플로우 수동 검증
