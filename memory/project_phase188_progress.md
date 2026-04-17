---
name: Phase 18.8 진행 상황
description: E2E Skip Recovery — H7 + MSW + multi-context + stubbed 복제 + CI 점진 승격. 5 PR / 3 Wave.
type: project
---

# Phase 18.8 — E2E Skip Recovery 진행 상황

> 시작 2026-04-16, 종료 예정 W3 머지 + 3일 nightly green 후

## 완료 Wave

### W1 — Foundation (parallel) ✅
- **PR-1** `4dda7b9` — `CreateRoomRequest.MaxPlayers` `*int32` + theme fallback (Go service + validation helper + table-driven test). 25 case PASS, resolveMaxPlayers 100% / handler.CreateRoom 84.6% 커버리지.
- **PR-2** `c9d627a` + fix-loop `e915889` — MSW v2 foundation + handlers/{auth,theme,room,clue} + e2e helpers (login/createRoom/createPartyOfN/waitForGamePage) + fixtures opt-in. fix-loop 5건 (createPartyOfN race, waitForGamePage 3-retry 무의미, msw-route 광역 인터셉트, handler shape drift coin_price/players, ws-client 부트스트랩 hook).
- 4-reviewer: PR-1 minor / PR-2 1차 5건 fix → 13/13 vitest PASS.

### W2 — Stub Expansion (parallel) ✅
- **PR-3** `cb546d3` + fix-loop `eff731f` — `handlers/game-ws.ts` role payload factory + `game-redaction-stubbed.spec.ts` 4 시나리오 (normal/murderer/detective/whisper). fix-loop 2건 (`seqCounter` closure 격리, detective 시나리오 추가). MED 후속 (이중 캐스트 단일화)는 별도 commit 정리.
- **PR-4** `75fdb9f` — `handlers/clue.ts` 4 endpoints 확장 (GET/PUT 서버 SSOT 일치) + `clue-relation-stubbed.spec.ts` 3 시나리오 (노드 ≥2 / 엣지 ≥1 / `.selected` highlight).
- 보조 commit `2400bb9` — `game-redaction.spec.ts`/`clue-relation-live.spec.ts` 최상단에 stubbed 복제본 안내 주석 (PR scope 외라 main에서 직접 처리).
- 4-reviewer: PR-3 sec PASS/code COMMENT(H1+M1)/test approve+followups/docs approve+followup, PR-4 sec/test/docs PASS, code COMMENT(spec 문서 stale).
- Sanity: vitest 16/16 PASS (572ms).

## 진행 중 Wave

### W3 — CI Promotion (sequential) ✅ 코드 머지 / 관측 단계
- **PR-5** `8006efb` — `ci(e2e): real-backend main push + workflow_dispatch`
  - `phase-18.1-real-backend.yml`에 `push:[main]` 트리거 + Slack staging 알림 step (failure() && push|schedule, secret 미등록 시 no-op)
  - `e2e-stubbed.yml`에 `workflow_dispatch` 추가
  - `refs/ci-promotion.md` (92줄) — Phase 18.9 required 승격 작업 + 알림 채널 staging→main 이관 + 검증 체크리스트
  - YAML validation PASS, slackapi action SHA pinned (Phase 18.7 규약)
- 4-reviewer 생략: PR-5는 단순 yaml/md 변경. 메인 self-check (yaml lint + SHA pin + no-PII)로 갈음.

## 관측 단계 (Phase 종료 조건)

1. 사용자 수동: repo Secrets에 `E2E_STAGING_SLACK_WEBHOOK_URL` 등록 (Slack 또는 Discord incoming-webhook)
2. main push 후 `Actions` 탭에서 `Phase 18.1 — Real-Backend E2E` 자동 실행 확인
3. 의도적 failing 커밋 push → staging 채널 메시지 도달 확인 → revert (또는 자연 발생 실패 1건으로 갈음)
4. nightly + main push 합산 3일 연속 green
5. 위 4건 만족 시 `/plan-finish` 실행 → Phase 18.9 (required 승격) 예약

## 후속 (Phase 18.9 또는 별도 PR로 적치)

| # | 출처 | 항목 | severity |
|---|---|---|---|
| 1 | PR-1 security | theme.status='PUBLISHED' 필터 (CreateRoom GetTheme 권한 강화) | minor |
| 2 | PR-1 security | validation 에러 detail에서 theme range 마스킹 (oracle 방어) | minor |
| 3 | PR-1 code | ListWaitingRooms `mapRoomResponse` DRY 정리 | minor |
| 4 | 백엔드 drift | `ThemeSummary.coin_price` 직렬화 추가 | medium |
| 5 | 백엔드 drift | `RoomPlayer` 7-field ↔ 서버 PlayerInfo 2-field 정렬 | medium |
| 6 | PR-3 LOW | detective fallback 향후 차등 공개 도입 시 drift 가능 | low |
| 7 | PR-4 docs | `refs/pr-4-...md` spec 문서 stale (POST/DELETE → GET/PUT) 반영 | low |
| 8 | PR-4 LOW | PUT invalid payload 분기 vitest 추가 | low |
| 9 | PR-4 LOW | fitView 애니메이션 중 click flaky 모니터링 | low |
| 10 | PR-3 MED | game-ws.ts 이중 캐스트 → 단일 캐스트 (정리 commit) | resolved |

## main commit history (Phase 18.8)

```
75fdb9f PR-4 clue-relation stubbed
eff731f PR-3 fix-loop (seqCounter + detective)
cb546d3 PR-3 game-redaction stubbed
2400bb9 docs(e2e) live spec 주석
e915889 PR-2 fix-loop
c9d627a PR-2 MSW + helpers
4dda7b9 PR-1 MaxPlayers optional
bc29d55 phase-18.8 plan
```

## 종료 조건 (design.md 기준)

- [x] 5개 PR main 머지 — 4/5 완료 (W1 2건 + W2 2건). PR-5 W3 진입 대기.
- [ ] E2E stubbed CI: `13+ pass / ≤3 skip / 0 fail` (PR-5 머지 후 실 CI run 검증)
- [ ] 4인 party flow Investigation 단서 수신까지 검증 (PR-5 후속)
- [ ] real-backend workflow main push 트리거 + 알림 채널 도달 확인 (PR-5)
- [ ] 3일 연속 nightly green 관측
- [ ] `MEMORY.md` 인덱스 업데이트 (이 문서 링크는 이미 등록)
