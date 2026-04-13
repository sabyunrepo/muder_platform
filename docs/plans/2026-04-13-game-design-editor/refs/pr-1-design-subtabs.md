# PR-1: 게임설계 서브탭 레이아웃 리팩토링

## 개요
현재 DesignTab (모듈 토글만)을 서브탭 컨테이너로 리팩토링.
5개 서브탭: 모듈 / 흐름 / 장소 / 배치 / 설정

## scope_globs
- apps/web/src/features/editor/components/DesignTab.tsx (리팩토링)
- apps/web/src/features/editor/components/design/ (새 디렉터리)
- apps/web/src/features/editor/components/design/ModulesSubTab.tsx
- apps/web/src/features/editor/components/design/FlowSubTab.tsx (placeholder)
- apps/web/src/features/editor/components/design/LocationsSubTab.tsx (placeholder)
- apps/web/src/features/editor/components/design/AssignmentSubTab.tsx (placeholder)
- apps/web/src/features/editor/components/design/SettingsSubTab.tsx (placeholder)

## 구현 상세
1. DesignTab → 상단에 서브탭 네비게이션 (수평 탭)
2. 기존 모듈 사이드바+콘텐츠를 ModulesSubTab으로 추출
3. 나머지 4개 서브탭은 "추후 구현" placeholder
4. 서브탭 상태는 로컬 useState로 관리

## 테스트
- 서브탭 전환
- 모듈 서브탭 기존 기능 유지
