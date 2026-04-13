# Phase 11.0 — 메타포 테스트 게임 구현

> 머더미스터리 장르 핵심 모듈 테스트를 위한 "메타포" 게임 데이터 세팅 + 단서 아이템 시스템 구현

## 목표
- 단서 아이템 사용 시스템 범용 구현 (peek, steal, reveal 등)
- 메타포 6인 JSON 템플릿 생성
- 에디터에서 테마 데이터 완성 (캐릭터, 단서, 미션, 페이즈)
- E2E 전체 게임 플로우 검증

## 기술 스택 (변경 없음)
- Backend: Go 1.25 + chi + sqlc + pgx
- Frontend: React 19 + Vite + Zustand + Tailwind CSS 4
- Engine: PhaseEngine + 33 모듈 (기존 구현 활용)

## 상세 문서

| 문서 | 설명 |
|------|------|
| [game-description.md](game-description.md) | 메타포 게임 설명서 원문 |
| [refs/scope-and-decisions.md](refs/scope-and-decisions.md) | 7대 결정 |
| [refs/clue-item-system.md](refs/clue-item-system.md) | 단서 아이템 시스템 설계 |
| [refs/metaphor-template.md](refs/metaphor-template.md) | 메타포 템플릿 구조 |
| [refs/prs/pr-1.md](refs/prs/pr-1.md) ~ [pr-5.md](refs/prs/pr-5.md) | PR 스펙 |

## 모듈 매핑

| 메타포 메커니즘 | 사용 모듈 | Config |
|----------------|-----------|--------|
| 13단계 순차 | script-progression | phases[] 13개 |
| 타이머 | phase.duration | 15분/20분/5분 |
| 단서 (4장/라운드) | clue-interaction | drawLimit=4 |
| 아이템 사용(★) | clue-interaction (확장) | usable clue + peek effect |
| 카드 교환 | trade-clue | 투표 전까지 |
| 밀담 | whisper + group-chat | 조사 단계만 |
| 투표 | voting | mode=secret |
| 히든 미션 | hidden-mission | self_report |
| 엔딩 + 점수 | ending | showMissionScores=true |
