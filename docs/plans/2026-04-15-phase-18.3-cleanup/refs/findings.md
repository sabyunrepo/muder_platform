# Phase 18.3 — Finding details

## Medium (3)

### M-7. Recovery path snapshot redaction
- **Source**: Phase 18.1 리뷰 (architect 상#2) + 18.2 리뷰
- **File**: `apps/server/internal/session/snapshot.go:147-179` (`sendSnapshotFromCache`)
- **현상**: Session 이 `StatusRunning` 이 아닐 때 (복구 경로) Redis 블롭을 **redaction 없이** 그대로 전송. `ModuleStates` 에 역할/귓속말/private clue 포함 가능 → 게임 중 재접속한 플레이어가 상대 역할 노출 위험.
- **Fix 후보**:
  - (A) Persist 시 플레이어별 블롭을 `session:{id}:snapshot:{playerID}` 키로 저장 — 저장 비용 N배 증가
  - (B) 블롭에서 민감 키 제거한 "public snapshot" 만 저장 + 민감 키는 engine state 로만 제공 — 복구 시 플레이어 민감 상태 손실 가능
  - (C) (A)+(B) 하이브리드: public snapshot 은 session level, private 은 player level
- **권장**: (A) — 저장 비용은 N×scale ok, 복구 시 완전성 보존

### M-a. startModularGame 실패 시 리소스 누수
- **Source**: Phase 18.2 리뷰 MED-a
- **File**: `apps/server/internal/session/starter.go:118-152`
- **현상**: `s.Send(KindEngineStart)` 실패, `errSessionAlreadyActive`, `startReply err`, `ctx.Done` 경로에서 `s.stop()` 만 호출. 이미 할당된 `modules/bus/adapter/eng` 정리 안 됨. 모듈 `Init()` 에 timer/pubsub side effect 가 있으면 누수.
- **Fix**: `cleanupOnStartFail(bus, modules, adapter)` helper — `bus.Close()` + 각 module 의 `Stop(ctx)` 호출. Session.stop 과 함께 defer 조합.

### M-e. KindStop 와 엔딩 플로우
- **Source**: Phase 18.2 리뷰 MED-e
- **현상**: Phase 18.2 에서 `KindStop` 을 `deleteSnapshot` 으로 변경 (PII 제거 목적). 하지만 게임이 **정상 엔딩** 을 맞이할 때 snapshot 이 재접속/리플레이에 사용될 가능성 미확인.
- **Action**: 현재 엔딩 경로 (`module/progression/ending.go`, `phase_engine` 마지막 phase 처리) 가 `KindStop` 을 직접 트리거하는지 확인. 만약 그렇다면:
  - (a) 엔딩 스냅샷을 별도 "final state" 로 WS broadcast → 삭제 유지
  - (b) KindStop 전에 `finalSnapshot` 을 별도 장기 키로 아카이브 (24h → 7d)
- 문서화: `refs/ending-flow.md` 생성 권장

---

## Low (7)

- **L-2 (ctx parent)**: `persistSnapshot/SendSnapshot/deleteSnapshot` 가 `context.Background()` 사용 → `s.Ctx()` 로 변경해 세션 종료 시 즉시 cancel.
- **L-3 (`recentLeftAt` GC)**: `hub.go:247-258` 접두사 스캔 O(N). per-session sub-map 으로 전환.
- **L-4 (snapshotKey namespace)**: `session:{id}:snapshot` → `mmp:session:{id}:snapshot`. 24h TTL 후 구키 자연 소멸.
- **L-5 (Hub.Stop 경합)**: `hub.go:585-598` Stop 이 map 초기화하는 동안 동시 Broadcast 가 이미 stale 맵 참조. `closing atomic.Bool` 체크를 broadcast 루프에 추가.
- **L-6 (panic dump 누출)**: `hub.go:527-540, 554-567` 의 `Interface("panic", r)` 은 파일경로 포함 스택 로깅. `Str("panic", fmt.Sprint(r))` + debug 레벨 스택 분리.
- **L-7 (모듈 에러 노출)**: `starter.go:80` `"failed to build game modules: " + err.Error()` → 호스트 응답은 generic, 상세는 서버 로그만.
- **L-8 (E2E auto-skip)**: 현재 CI 에서 `PLAYWRIGHT_BACKEND` 미설정으로 대부분 스킵. stubbed backend + 최소 3 시나리오 필수 실행으로 회귀 감지 복원.
