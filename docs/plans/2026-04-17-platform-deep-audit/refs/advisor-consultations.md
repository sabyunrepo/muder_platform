# Advisor Consultations — Phase 19 W3a Intake

## Invocations: 1 / 11

## Cross-cutting Issues (8건)

### C-1: WS Envelope 3-Party Drift — Protocol SSOT Collapse
- **Severity**: P0 (프로덕션 phase 전환 silent fail)
- **Affected areas**: [01-go-backend, 02-react-frontend, 04-test-engineer, 09-ws-contract]
- **Summary**: 백엔드 `phase:entered`/`phase:exiting`(colon·dot 혼재) ↔ 프론트 `WsEventType.GAME_PHASE_CHANGE = "game:phase:change"` ↔ MSW mock ~4/60+ drift. phase 전환 UI 반영 안 됨(F-ws-1). `game:start`/`game:end` emitter 프로덕션 코드 부재(F-ws-2). 60+ envelope 중 3자 일치 1건뿐(F-ws-12 <4%).
- **Synthesis candidate (W3c)**: **PR-1 WS Contract SSOT** — event naming 표준화(module.action dot notation), enum을 envelope_catalog에서 codegen, MSW 40+ 커버리지 확장, `envelope_catalog → type` contract test CI gate.

### C-2: PlayerAwareModule Redaction Boundary (25 모듈 공백)
- **Severity**: P0 (PII/스포일러 전 플레이어 노출)
- **Affected areas**: [03-module-architect, 05-security, 04-test-engineer]
- **Summary**: Phase 18.1 B-2 `BuildStateFor` redaction 목표인데 실측 8/33(24%). crime_scene 3 모듈(evidence/location/combination) public fallback → 플레이어별 단서가 전원에게 broadcast(F-module-1 P0, F-sec-2 P0). `types.go:103-105` 엔진 fallback이 누락을 silent masking, boot check 없음(F-module-5 P2).
- **Synthesis candidate (W3c)**: **PR-2 PlayerAwareModule Mandatory** — crime_scene 3 + decision/{accusation,hidden_mission,voting}에 BuildStateFor 추가, `engine.RequiresPlayerAware()` + boot-fail gate, snapshot_redaction_test.go 모듈별 시크릿 assertion 백필.

### C-3: RFC 9457 우회 — `http.Error` 직접 호출 12곳
- **Severity**: P0 (에러 레지스트리·Sentry·auditlog·trace_id·Problem Details 전부 우회)
- **Affected areas**: [01-go-backend, 05-security]
- **Summary**: 3 파일 12곳(seo 3 / infra/storage 8 / ws/upgrade 1) 직접 `http.Error()` — `apperror.WriteError` 파이프라인 우회로 RFC 9457 구조·trace_id·Sentry·auditlog 훅 전부 소실. 공개 endpoint(SEO, WS upgrade) 완전 무보호(F-go-1 P1 boundary→P0, F-sec-1 P0).
- **Synthesis candidate (W3c)**: **PR-3 HTTP Error Standardization** — 12 http.Error 호출을 apperror.*로 교체, 비테스트 코드 http.Error 금지 컴파일 타임 linter 추가.

### C-4: 파일/함수 크기 누적 위반 (10+ 건, P1 임계)
- **Severity**: P1 (리팩터 부채 누적, CLAUDE.md hard limit: Go 500/TS 400/func 80)
- **Affected areas**: [01-go-backend, 02-react-frontend]
- **Summary**: 백엔드 수동 작성 10 파일 500+ (F-go-3), 함수 80+ 6건(F-go-4). 프론트 3 파일 400+(F-react-1/3/4). severity-rubric §P1 "3+ 동일 Phase" 기준 양쪽 충족. 증상: editor/handler.go 26 endpoint, ws/hub.go lifecycle+broadcast 혼재, social/service.go 2 인터페이스, GameChat.tsx 9 useState, FriendsList.tsx 6 커스텀 hook.
- **Synthesis candidate (W3c)**: **PR-4 File Size Refactor Wave** — 10 Go + 3 TS 파일 분할(editor handler routing split, ws/hub lifecycle 분리, GameChat store 마이그레이션, FriendsList 서브컴포넌트 추출).

### C-5: Coverage Infrastructure 미강제 (Go 75% warn-only, Frontend 0% gate)
- **Severity**: P1 (32 Go 패키지 <75% 상태로 CI green, regression 감지 불능)
- **Affected areas**: [04-test-engineer, 01-go-backend, 02-react-frontend, 06-perf-observability]
- **Summary**: F-test-1(Go): `coverage-guard` placeholder warn-only, 수치 gate 없음. 평균 44.6%로 CLAUDE.md 75% 규칙 위반 상태 머지. F-test-5(Frontend): Vitest coverage reporter 있으나 `fail_ci_if_error=false`. F-perf-1(Infra): otel·sentry·storage 0% — 관측 경로 미검증. Codecov upload 있으나 threshold 0.
- **Synthesis candidate (W3c)**: **PR-5 Coverage Gate Enforcement** — (a) Go `go tool cover | awk '/total/ {if ($3+0<75) exit 1}'` main CI fail + Codecov delta regression ≤0%p gate. (b) Frontend Vitest `thresholdLines: 60%`. (c) 0% 9 패키지를 "intentionally excluded" 선언 or Phase 19 테스트 생성.

### C-6: Auditlog 인증/관리자 경로 공백 (0/0 audit 이벤트)
- **Severity**: P0 (PII/권한/삭제 audit trail 부재, GDPR/K-ISMS 대응 불가)
- **Affected areas**: [05-security, 01-go-backend]
- **Summary**: F-sec-4 P0: auth.{Login,Register,DeleteAccount,Logout} + admin.{UpdateUserRole,Force*} + review.{Approve,Reject,Suspend} 모두 auditlog.Log() 0건. phase_engine.go는 emit 있으나 auth mutation·권한 변경 silent. auditlog schema가 session_id only(non-null), 사용자 수준 이벤트 저장 공간 없음. "refresh reuse detected" zerolog warn만 있고 audit record 없음(`auth/service.go:172`).
- **Synthesis candidate (W3c)**: **PR-6 Auditlog Expansion** — (a) schema session_id NULLABLE + user_id 컬럼 추가. (b) auth.{Login,Register,DeleteAccount} + admin + review handler에 auditlog.Log(actor, subject, before-after) 주입. (c) admin_audit 테이블 신설 or 통합 auditlog + 단위 테스트.

### C-7: Store 3-Layer 경계 위반 (Connection↔Domain 직접 mutation)
- **Severity**: P1 (WS 이벤트 구독 숨김, 테스트 용이성 저해, reducer 결합)
- **Affected areas**: [02-react-frontend, 06-perf-observability]
- **Summary**: F-react-5 P1: `useGameSync.ts`가 `useGameStore.getState().hydrateFromSnapshot/setPhase/addPlayer/resetGame` + `getModuleStore(...).getState().setData` 직접 호출. `gameMessageHandlers.ts` 동일 패턴 중복. 두 개 병렬 진입점이 "single action" 원칙 위반. F-perf-7: `.getState()` 16건 분산 mutation. WS envelope 변경 시 두 파일 모두 갱신 필요 → drift risk.
- **Synthesis candidate (W3c)**: **PR-7 Zustand Action Unification** — Connection→Domain mutation을 `useGameSessionStore.applyWsEvent(event, payload)` 단일 action으로 통합, WS dispatcher 경로에서 .getState() 제거, 모듈 상태 mutation은 apply* action 경유.

### C-8: Module Factory Cache Key sessionId 누락 (세션간 state 유출 risk)
- **Severity**: P1 (세션 전환 시 이전 세션 moduleId 인스턴스 공유)
- **Affected areas**: [02-react-frontend, 03-module-architect, 06-perf-observability]
- **Summary**: F-react-6 P2 boundary→P1: `moduleStoreFactory.ts:28` `const moduleStores = new Map<string, StoreApi<ModuleStore>>()` key를 moduleId만으로 구성. sessionId namespace 없음. `clearModuleStores()`는 GamePage unmount 시점이지 resetGame 시점 아님. 빠른 세션 탭 전환 + unmount 전 → 다음 세션이 stale 인스턴스 획득. **서버 Factory가 sessionId:moduleId 키를 쓰는지, 세션 생명주기로 per-session-id 인스턴스 보장하는지 교차 검증 필요.**
- **Synthesis candidate (W3c)**: **PR-8 Module Cache Isolation** — Factory key `${sessionId}:${moduleId}`로 변경, clearModuleStores()를 useGameSessionStore.resetGame() 마지막 step으로 이동, selector 없는 호출 dev warning.

---

## Delta Instructions

### To 01-go-backend
RFC 9457 vs http.Error: F-go-1의 apperror 전환 3 영역(seo, storage, ws/upgrade)은 F-sec-1와 묶임. C-3 참조. 파일 크기 리팩터(social/service.go 759 분할, editor/handler.go 26 endpoint 분할, ws/hub.go lifecycle/broadcast 분리)는 C-4 synthesis에 묶임.

### To 03-module-architect
PlayerAwareModule P0 blocker: F-module-1 crime_scene 3(evidence/location/combination)에 BuildStateFor 구현 + 컴파일 타임 assertion. 서버 Factory 교차확인: 모듈 인스턴스 생명주기가 sessionId에 바인딩되는가(C-8 cache key). C-2 synthesis 참조.

### To 04-test-engineer
Coverage gate 강제: F-test-1 / F-test-5(Go warn-only, Frontend 0%) + F-perf-1(infra 0%) CI threshold 하드닝 필요. E2E skip 35→21 gap(F-test-8)은 Phase 19 backlog 결정 대기. C-5 synthesis 참조.

### To 05-security
Auditlog critical path 0 커버리지(F-sec-4 P0): auth/admin 이벤트 캡처에 schema 확장(session_id NULLABLE + user_id) + 6+ handler 배선 필요. C-6 synthesis. PlayerAware redaction 24% 커버리지(F-sec-2 P0 co-primary with 03) — module-architect가 누락 구현 확인.

### To 09-ws-contract
3-party envelope drift P0 blocker(F-ws-1/2/12): 백엔드 SSOT(event_mapping.go relayPrefix + envelope_catalog.go inbound) vs 프론트 WsEventType enum vs MSW <4%. naming 표준(colon vs dot) 미결. C-1 synthesis; 백엔드 game:start/end emitter 존재 확인 필요.

---

## 요약

- **Cross-cutting 총 8건** (임계 ≥3 초과, synthesis 가치 높음)
- **Delta 지시 5 영역** (01, 03, 04, 05, 09) — 02/06/07/08은 Advisor-Ask 비어있거나 C-7/C-8 cross-ref로 커버
- **W3b 판정**: **SKIP 권장** — cross-cutting 8건이 synthesis candidate 8 PR로 1:1 매핑, delta 지시 내용은 전부 executor가 아닌 **사용자·architect 결정 대기** 사항(naming 표준, schema, 리팩터 범위)이라 executor 재작업 불필요. 결정 대기 항목은 phase19-backlog의 "Open Decisions" 섹션에 명시.
- **W3c synthesis 범위**: 8 cross-cutting → 8 PR 후보 + executive-summary(P0 ≤10건 롤업) + phase19-backlog(≥5 PR, `/plan-new` 포맷)
- **호출 예산**: 1 intake 사용 / 10 remaining. W3b skip + W3c synthesis 1 = **최종 2/11** 사용. 9회 여분 확보.

## 남은 호출 전략
- W3c synthesis 1회로 executive-summary + phase19-backlog 동시 생성
- fail-safe 1회 (synthesis 리뷰 후 보완)
- 합계 2-3/11 사용 예상

**다음 호출**: W3c Synthesis (호출 #2/11)
