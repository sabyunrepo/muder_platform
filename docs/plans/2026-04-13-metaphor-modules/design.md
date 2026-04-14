# Phase 12.0: 메타포 풀 경험 — 게임 모듈 프론트엔드

## 목표
메타포 6인 테마의 풀 게임 경험을 위해 4개 미구현 모듈의 프론트엔드 UI 구현.

## 스코프
| 모듈 | 설명 | 복잡도 |
|------|------|--------|
| reading | 프롤로그/오프닝/시크릿카드 텍스트 표시 + 읽기 완료 | M |
| hidden_mission | 비밀 임무 카드 표시 + 엔딩 성공/실패 결과 | S |
| trade_clue | 단서 교환 요청/수락/거절/완료 플로우 | L |
| group_chat | 소그룹 채팅방 (GameChat 탭 확장) | M |

## 스코프 외
- 백엔드 수정 없음 (전부 구현 완료)
- 에디터 UI 수정 없음

## 아키텍처
기존 게임 모듈 패턴 준수:
- `useModuleStore(moduleId)` → WS 이벤트 수신 → 로컬 상태
- 유저 액션 → `send(Event, payload)` → 백엔드 → WS broadcast
- 컴포넌트: `apps/web/src/features/game/components/{Name}Panel.tsx`

## 데이터 플로우
- reading: WS `reading:content` → ReadingPanel → `reading:done`
- hidden_mission: WS `mission:assigned` → MissionCard, `mission:result` → 결과
- trade_clue: WS `trade:request/accept/reject/complete` 양방향
- group_chat: WS `chat:group_message` → GameChat 그룹 탭

## refs/
- [PR 스펙](refs/) — PR별 상세 스펙

## 관련 문서
- 백엔드 모듈: `apps/server/internal/module/`
- 기존 게임 컴포넌트: `apps/web/src/features/game/components/`
- 메타포 시드: `apps/server/db/seed/metaphor.sql`
