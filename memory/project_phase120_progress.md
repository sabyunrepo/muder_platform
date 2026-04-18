---
name: Phase 12.0 완료
description: 메타포 풀 경험 게임 모듈 프론트엔드 4개 구현 (5 PR, 3 Wave, 42 tests, 2026-04-13)
type: project
originSessionId: c9b808da-0f23-4f0e-b844-702c62f52efc
---
Phase 12.0 완료 — 메타포 6인 테마 풀 게임 경험.

**구현된 모듈 UI**: ReadingPanel, HiddenMissionCard+MissionResultOverlay, TradeCluePanel+TradeRequestNotification, GroupChatTab (GameChat 확장)

**추가 수정**:
- 에디터 DesignTab: 409 Conflict → 500ms debounce, 미지원 모듈 opacity-40, 코어 모듈 항상 활성화 (supported/required 플래그)
- WS 연결: connectionStore에서 URL에 ?token= 쿼리 파라미터 추가 (JWTPlayerIDExtractor가 쿼리에서 읽음)
- DB 마이그레이션 00020 수동 적용 (theme_clues 4컬럼 추가)

**커밋**: d1a1979 ~ 8adc75f (10 commits)
