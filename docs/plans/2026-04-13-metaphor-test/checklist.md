<!-- STATUS: DRAFT -->
# Phase 11.0 — 메타포 테스트 게임 체크리스트

## Wave 1 — 기반
- [ ] **PR-1**: 단서 아이템 시스템 (DB + 백엔드)
  - [ ] T1: DB 마이그레이션 (is_usable, use_effect, use_target, use_consumed)
  - [ ] T2: 에디터 백엔드 타입/서비스 업데이트
  - [ ] T3: ClueInteraction 모듈 확장 (use/use_target/use_cancel + peek + mutex)
  - [ ] T4: 테스트

## Wave 2 — UI (병렬)
- [ ] **PR-2**: 에디터 아이템 설정 UI
  - [ ] T1: API 타입 업데이트
  - [ ] T2: ClueForm 아이템 섹션
  - [ ] T3: 빌드 검증

- [ ] **PR-3**: 게임 UI 아이템 사용
  - [ ] T1: CluePanel 아이템 버튼
  - [ ] T2: 아이템 사용 모달
  - [ ] T3: 브로드캐스트 알림
  - [ ] T4: WS 이벤트 타입

## Wave 3 — 데이터
- [ ] **PR-4**: 메타포 템플릿 + 테마 시드
  - [ ] T1: JSON 템플릿
  - [ ] T2: DB 시드 스크립트
  - [ ] T3: 검증

## Wave 4 — 검증
- [ ] **PR-5**: E2E 테스트
  - [ ] T1: Go 통합 테스트
  - [ ] T2: Playwright E2E (선택)
