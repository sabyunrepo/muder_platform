# Phase 19 Backlog — PR 후보 + Wave 제안

> **생성**: W3c Synthesis (2026-04-17)
> **기반**: 9 audit drafts + advisor-consultations.md 8 cross-cutting
> **포맷**: `/plan-new` 입력 호환

## PR 후보 (11건 — PR-9·PR-10 2026-04-18 신규 추가)

### PR-0: MEMORY Canonical Migration — user home → repo
- **Scope**: `memory/` (repo), `/Users/sabyun/.claude/projects/-Users-sabyun-goinfre-muder-platform/memory/` (user home, source), `MEMORY.md` 인덱스 갱신, `CLAUDE.md` QMD 컬렉션 메모 업데이트
- **SSOT 결정 (사용자 확정)**: **Repo `memory/`가 canonical**. user home 34 파일 중 현재 repo에 없는 것들을 선별 복원. 이후 user home은 폐기(또는 read-only archive).
- **Depends on**: 없음 (선행 필수 — Phase 19 모든 PR이 `memory/` 기준으로 작업)
- **Rationale**: C-8 / F-docs-5. 2중화 해소. 팀 공유 원칙 복원. Phase 18.6 progress 등 repo 누락분 복구.
- **Size**: S (≤4h) — 단순 파일 이동 + 인덱스 정리
- **Risk**: Low
- **Sub-tasks**:
  1. user home 34 파일 ↔ repo `memory/` 4 파일 diff
  2. 누락된 phase progress·feedback·reference 파일 복원 (최소 Phase 17.5~18.8 9건)
  3. MEMORY.md 인덱스 갱신 (sabyun/.claude/projects 버전 기준)
  4. QMD `mmp-memory` 컬렉션 path 변경 (`.claude/projects/...` → repo `memory/`)
  5. user home archive 또는 read-only 처리



### PR-1: WS Contract SSOT — **서버(envelope_catalog) 기준**, 프론트/MSW 맞춤
- **Scope**: `apps/server/internal/ws/envelope_catalog.go` (SSOT), `apps/server/internal/ws/message.go`, `apps/server/internal/session/event_mapping.go`, `apps/web/src/mocks/handlers/**` (서버에 맞춤), `apps/web/src/stores/gameMessageHandlers.ts` (enum 재생성), `packages/shared/src/ws/types.ts` (codegen), `packages/ws-client/src/client.ts`, `.github/workflows/` (contract gate)
- **SSOT 결정 (사용자 확정)**: **서버(envelope_catalog.go)가 source of truth**. 프론트·MSW는 서버에 맞춤. 프론트 `WsEventType` enum은 envelope_catalog에서 **codegen**으로 자동 생성.
- **Depends on**: 없음 (먼저 실행)
- **Rationale**: C-1 / F-ws-1·2·3·4·5·6·7·12. 3자 일치율 <4%, Phase 17.5~18.6 반복 회귀 근절.
- **Size**: L+ (>2~3d, v1.5 tygo 포함으로 +1~2d)
- **Risk**: Med (enum codegen이 수동 변경 리스크 제거)
- **착수 결정 (2026-04-18)**:
  - **D1 = A (점 표기 canonical)**: `<category>.<action>` 점 표기를 표준으로 선언. 기존 legacy 콜론 121개는 Catalog에 `Alias` 필드로 보존 + deprecated 표시. 실제 콜론→점 정규화 migration은 Phase 20 follow-up.
  - **D2 = D (AUTH catalog stub)**: `auth.*` 이벤트는 Catalog에 stub entry만 등록. 서버 핸들러·프론트 sendAuth는 미구현(쿼리 토큰 정책 유지). 정식 protocol은 **PR-9**로 분리.
  - **D3 = v1.5 opt α (tygo)**: `// wsgen:payload` 주석이 있는 Go struct만 `packages/shared/src/ws/types.generated.ts`에 TS interface로 전환. 런타임 zod 검증은 **PR-10**으로 분리. dynamic payload(`json.RawMessage`)는 `unknown` 유지.

### PR-2 3분할 (2026-04-18 재설계) — design: `refs/pr-2-split-design.md`

> **분할 근거**: W1 draft "PlayerAware 0/33" → 실측 **8/33 (24%)**. 잔여 25 fallback 중 공개 state 모듈 12개는 `PublicStateMarker` sentinel로 opt-out, 민감 state 13개만 실구현 필요. 3분할 실행 순서: **PR-2a → PR-2b → PR-2c** (순차).

#### PR-2a: Engine Gate + PublicStateMarker — design: `refs/pr-2/pr-2a-engine-gate.md`
- **Scope**: `apps/server/internal/engine/types.go`, `engine/factory.go`, `engine/registry.go`, 33 모듈 `module.go` (marker/stub 부착)
- **Depends on**: 없음 (W2 잔여, 단독)
- **Rationale**: F-sec-2 gate 설치. `PlayerAwareModule OR PublicStateMarker` 중 하나 필수 → compile-time assertion + boot-fail gate + `MMP_PLAYERAWARE_STRICT` env flag (default true).
- **Size**: S (~170 LOC)
- **Risk**: Low (gate만, 실구현 아님)

#### PR-2b: 13 모듈 BuildStateFor 백필 — design: `refs/pr-2/pr-2b-module-backfill.md`
- **Scope**: 13 민감 모듈 `BuildStateFor` 실구현 + `snapshot_redaction_test.go` 확장 (`combination` 제외, PR-2c 담당)
- **Depends on**: **PR-2a** (gate 통과)
- **Rationale**: F-03 + F-sec-2 실구현. crime_scene/{evidence,location} · decision/accusation · cluedist 일부 · 기타 단서 개인화 대상.
- **Size**: L (~520 LOC)
- **Risk**: Med (13 모듈 동시 변경, 카테고리별 커밋 granularity 확보)

#### PR-2c: craftedAsClueMap redaction (D-MO-1) — design: `refs/pr-2/pr-2c-crafted-redaction.md`
- **Scope**: `apps/server/internal/module/crime_scene/combination/**` (`snapshotFor` + `BuildStateFor` + 테스트 4건)
- **Depends on**: **PR-2a** (gate) + **PR-2b** (combination stub → real 전환 전제)
- **Rationale**: D-MO-1 delta finding 단독 해소. `craftedAsClueMap`이 `BuildState`에 반영 안 되는 문제.
- **Size**: S-M (~180 LOC)
- **Risk**: Low (combination 파일 단일 집중)

**의존성 그래프**:
```
PR-2a ──┬──→ PR-2b
        └──→ PR-2c  (PR-2b 선 머지 권장 — combination.go 충돌 회피)
```

**Feature flag**: `MMP_PLAYERAWARE_STRICT` env (default `true`). 프로덕션 이슈 시 `false`로 즉시 fallback 롤백. PR-2b/2c 머지 + 30일 안정 관측 후 제거.

### PR-3: HTTP Error Standardization — http.Error → apperror + linter
- **Scope**: `apps/server/internal/seo/**`, `apps/server/internal/infra/storage/local/**`, `apps/server/internal/ws/upgrade*`, `apps/server/internal/apperror/**`, `.golangci.yml` (depguard 룰)
- **Depends on**: 없음
- **Rationale**: C-3 / F-sec-1 P0 + F-go-1 P1(boundary→P0). 12 호출 지점 교체 + 재발 방지 컴파일 gate.
- **Size**: M (≤2d)
- **Risk**: Low

### PR-4 분할 (2026-04-18 재설계) — design: `refs/pr-4-split-design.md`

> **분할 근거**: Go 9 파일(6 모듈 + 3 인프라) + TS 3 파일은 파일셋 disjoint + 언어 경계 명확 → 병렬 실행 가능. Git conflict 0. 리뷰어 분리로 부담 감소.

#### PR-4a: Go 파일 분할 — design: `refs/pr-4/pr-4a-go-split.md`
- **Scope**:
  - 6 모듈 디렉터리 승격: `progression/reading` (652) · `decision/voting` (639) · `decision/hidden_mission` (559) · `crime_scene/combination` (543) · `cluedist/trade_clue` (532) · `decision/accusation` (515) → `module/<cat>/<module>/` 내부 `module.go / config.go / state.go / handlers.go / reactor.go / events.go`
  - 3 인프라 파일 분할 (package 유지): `domain/social/service.go` (759) · `ws/hub.go` (649) · `domain/editor/service.go` (505)
  - F-go-4 `accusation.handleAccusationVote` 101줄 → `tally.go` 수학 로직 추출
  - 카테고리 내 `register.go` 신설 (blank import 안전)
- **Depends on**: 없음 (PR-2a 이후로 gate 안정)
- **Rationale**: C-4 / F-go-3·4. CLAUDE.md hard limit (Go 500/함수 80) 위반 해소. Factory 서명 불변.
- **Size**: L
- **Risk**: Med (import 경로 대량 변경)
- **Gate**: `go test ./... -race` + `TestRegistry_AllCoreModulesRegistered` 신규

#### PR-4b: TS 파일 분할 — design: `refs/pr-4/pr-4b-ts-split.md`
- **Scope**:
  - `editor/api.ts` (428) → `api/` 배럴 + `types.ts/keys.ts/themes.ts/characters.ts/content.ts/validation.ts/moduleSchemas.ts`
  - `GameChat.tsx` (423) → `GameChat/` 디렉터리 + 탭별 컴포넌트 (state 모델은 PR-7 범위, 본 PR은 파일 분할만)
  - `FriendsList.tsx` (415) → `FriendsList/` 디렉터리 + 탭별 컴포넌트
- **Depends on**: 없음 (PR-4a와 disjoint 병렬)
- **Rationale**: C-4 / F-react-3·4. CLAUDE.md hard limit (TS 400) 해소. 배럴 type-only + 명시 re-export로 tree-shake 보장.
- **Size**: M
- **Risk**: Low
- **Gate**: `pnpm build` bundle size baseline ≤ +3%

**의존성 그래프**:
```
PR-4a ──(독립)──> main
PR-4b ──(독립)──> main   (PR-4a와 병렬)

PR-2b ── requires ──> PR-4a (combination/reading/accusation 500+ 해소 필요)
PR-2c ── requires ──> PR-4a (combination 충돌 회피)
```

### PR-5: Coverage Gate + mockgen 재도입 + 0% 패키지 전략
- **Scope**: `.github/workflows/ci.yml`, `apps/web/vitest.config.ts`, `apps/server/internal/infra/otel/**` (테스트 추가), `apps/server/internal/infra/sentry/**`, `apps/server/internal/infra/storage/**`, `apps/server/cmd/server/**`, `apps/server/internal/db/**`, `codecov.yml`, 모든 Service 인터페이스 `//go:generate mockgen` 디렉티브 추가
- **Depends on**: PR-3 (apperror 전환 후 측정 안정)
- **Rationale**: C-5 / F-test-1·5 + F-perf-1 + F-test-4. (a) Go 75% warn-only → hard fail, (b) Frontend threshold 도입, (c) 0% 9 패키지 중 infra 3건 테스트 작성 / cmd/internal "intentionally excluded" 선언, (d) **mockgen 재도입 (사용자 결정): Service 인터페이스마다 `go:generate mockgen` 디렉티브, CI에서 `go generate ./...` diff 체크 gate**.
- **Size**: L (>2d) — mockgen 도입으로 상향
- **Risk**: High (머지 차단 리스크 + mockgen 도입이 기존 unit 테스트 대부분 재작성 필요)

### PR-6: Auditlog Expansion — schema + auth/admin/review 배선
- **Scope**: `apps/server/internal/db/migrations/**` (schema 변경: session_id NULLABLE + user_id column), `apps/server/internal/auditlog/**`, `apps/server/internal/domain/auth/service.go`, `apps/server/internal/admin/**`, `apps/server/internal/review/**`, 관련 테스트
- **Depends on**: 없음
- **Rationale**: C-6 / F-sec-4 P0. auth/admin/review handler 6+ 곳 auditlog.Log 주입, schema 확장, 단위 테스트.
- **Size**: L (>2d)
- **Risk**: Med (migration)

### PR-7: Zustand Action Unification — applyWsEvent + .getState() 제거
- **Scope**: `apps/web/src/stores/gameSessionStore.ts`, `apps/web/src/stores/gameMessageHandlers.ts`, `apps/web/src/hooks/useGameSync.ts`, `apps/web/src/stores/moduleStoreFactory.ts`, 관련 테스트
- **Depends on**: PR-1 (envelope 표준화 후 단일 reducer 경로로 통합 가능)
- **Rationale**: C-7 / F-react-5 + F-perf-7. Connection→Domain 이중 경로 통합, .getState() 16건 제거.
- **Size**: M (≤2d)
- **Risk**: Med (WS 이벤트 처리 버그 risk)

### PR-8: Module Cache Isolation — Factory key sessionId namespace
- **Scope**: `apps/web/src/stores/moduleStoreFactory.ts`, `apps/web/src/stores/gameSessionStore.ts` (resetGame 통합), 관련 테스트
- **Depends on**: PR-7 (Zustand action unification 이후)
- **Rationale**: C-8 / F-react-6. sessionId:moduleId 키 namespace + resetGame 연계 + dev warning. 서버 Factory 교차확인 필요(open decision).
- **Size**: S (≤4h)
- **Risk**: Low

### PR-9: WS Auth Protocol — IDENTIFY / RESUME / CHALLENGE / REVOKE
- **Scope**: `apps/server/internal/ws/auth_protocol.go` (신규), `apps/server/internal/ws/upgrade.go`, `apps/server/internal/domain/auth/**`, `apps/server/internal/db/migrations/**` (revoke table), `packages/ws-client/src/client.ts`, 관련 테스트
- **Depends on**: PR-1 (Catalog에 `auth.*` stub 존재 기반)
- **Rationale**: 쿼리 토큰(업그레이드 시 1회 검증)만으로는 (a) 토큰 만료 대응, (b) 계정 revoke·ban 즉시 반영, (c) 권한 중간 변경 통지, (d) 토큰 refresh 불가. Discord gateway IDENTIFY/RESUME + Slack RTM hello 하이브리드.
- **설계 기준**:
  - S→C: `auth.challenge`, `auth.revoked`, `auth.refresh_required`
  - C→S: `auth.identify`, `auth.resume`, `auth.refresh`
  - Revoke table: (user_id, revoked_at, reason) — WS hub가 broadcast 전 조회
- **Size**: L (>2d)
- **Risk**: Med (인증 경로 확장 = 회귀 위험, 철저한 테스트 필요)
- **신규 추가 (2026-04-18)**: PR-1 진행 중 "쿼리 토큰만으로 부족하다" 검토 결과 분리 신설.

### PR-10: Runtime Payload Validation — zod schemas + server middleware
- **Scope**: `apps/server/cmd/wsgen` (확장: Go struct → JSON Schema 출력), `packages/shared/src/ws/schemas.generated.ts` (zod), `packages/ws-client/src/client.ts` (수신 검증), `apps/server/internal/ws/validator.go` (송신 검증), 관련 테스트
- **Depends on**: PR-1 (v1.5 tygo + Catalog 확립 후)
- **Rationale**: PR-1 v1.5는 컴파일 타임 TS interface만 제공 — 서버 struct 변경 시 TS는 에러 나지만 런타임에서 잘못된 payload 밀어 넣을 가능성은 남음. zod/ajv 런타임 검증 + 서버 송신 전 validator로 drift 0% 보장.
- **Size**: L (>2d)
- **Risk**: Med (기존 payload 중 스키마 외 필드가 있으면 런타임 실패 — 서서히 strict 모드 전환 필요)
- **신규 추가 (2026-04-18)**: PR-1 v1.5 옵션 α 결정 시 런타임 검증은 별도 PR로 분리 합의.

---

## Resolved Decisions (사용자 확정 2026-04-17)

1. ✅ **WS naming SSOT = 서버 기준** — `envelope_catalog.go`가 source of truth. 프론트 enum·MSW는 서버에 맞춤 + codegen으로 자동 생성. PR-1 범위에 codegen 포함.
2. ✅ **@jittda/ui 감사 제외** — 이 프로젝트 의존성 아님(타 프로젝트 jittda-frontend-hub 전용). F-a11y-1은 감사 전제 오류로 제거. v3 실제 스택은 Tailwind 4 직접 사용.
3. ✅ **mockgen 규약 유지 (재도입)** — CLAUDE.md 원칙대로 mockgen + testcontainers-go 사용. 현재 0건 → 재도입 CI gate 추가. PR-5 Coverage Gate에 "mockgen 도입" 서브태스크 포함.
4. ✅ **MEMORY canonical = Repo (`memory/`)** — 사라진 user home 34 파일 중 필요한 것만 repo로 복원. Phase 19 implementation 첫 단계에서 migration 수행. 이후 MEMORY.md 인덱스 갱신 + user home `.claude/projects/...` 폐기.

### Resolved (2026-04-18 — PR-1 착수 시)

5. ✅ **WS 표기법 canonical = 점 표기** (`<category>.<action>`) — 서버 engine EventBus가 이미 점 표기 다수 사용. PR-1은 Catalog 선언만, 실제 콜론→점 정규화 migration은 Phase 20 follow-up.
6. ✅ **WS AUTH protocol = PR-9로 분리** — 현재 쿼리 토큰 기반 업그레이드 인증만으로는 refresh/revoke/challenge 부재. PR-1은 `auth.*` Catalog stub만, 정식 protocol은 PR-9 신설.
7. ✅ **Payload schema = v1.5 tygo (컴파일 타임) + PR-10 런타임 검증 분리** — PR-1에 tygo 기반 Go struct → TS interface 자동 생성 포함. `// wsgen:payload` 주석 opt-in. zod/ajv 런타임 검증은 PR-10 신설.

---

## Open Decisions (None — 전부 Resolved)

---

## Wave 제안 (3 Wave + Wave 0, 총 9 PR)

### Wave 0 — Pre-Flight (직렬 1)
> 필수 선행. MEMORY 파편화 해소 후에야 Phase 19 전체 plan의 근거가 정돈됨.

- **PR-0 MEMORY Canonical Migration** (S, Low risk) — user home → repo 복원 + QMD path 변경

**Gate**: memory/ 재작성 + MEMORY.md 인덱스 갱신 + QMD reindex 완료

### Wave 1 — Foundation Fixes (병렬 3)
> 의존 없음 (PR-0 후)

- **PR-1 WS Contract SSOT (서버 기준)** (L, Med) — codegen으로 수동 drift 방지
- **PR-3 HTTP Error Standardization** (M, Low)
- **PR-6 Auditlog Expansion** (L, Med, DB migration)

**Gate**: 3 PR main 머지 + contract test CI 녹색

### Wave 2 — Enforcement + Security (병렬 3)
> Wave 1 이후 (envelope 표준 + apperror 배선 완료 후 측정)

- **PR-2 PlayerAwareModule Mandatory** (L, Med) — 서버 redaction 완결
- **PR-5 Coverage Gate Enforcement** (M, High risk) — 75%/threshold 강제
- **PR-7 Zustand Action Unification** (M, Med) — PR-1 기반

**Gate**: 커버리지 Go 70%+ · Frontend 60%+ · redaction test 전 모듈 통과

### Wave 3 — Refactor + Cleanup (병렬 2)
> Wave 1·2 이후 (envelope·coverage 안정 상태)

- **PR-4 File Size Refactor Wave** (L, Med) — 13 파일 분할
- **PR-8 Module Cache Isolation** (S, Low) — PR-7 기반

**Gate**: 500+/400+ 파일 0건 · 세션 전환 E2E 테스트 추가

### 독립 / 차후
- ~~**P0 F-a11y-1** (@jittda/ui 0/278)~~ **REMOVED** — 사용자 확정: `@jittda/ui`는 이 프로젝트가 아닌 타 프로젝트(jittda-frontend-hub) 의존성. v3는 Tailwind 4 직접 사용이 정식 스택. 감사 전제 오류.
- **P0 F-a11y-3** (outline-none 57건 focus-visible 없음): WCAG 2.4.7 실패 확정. 독립 hotfix PR.
- **P0 F-sec-3** (voice token 평문 로그): 독립 hotfix PR (1시간 내)
- **P2 백로그 28건**: Phase 20 이후 기술 부채 PR로 수렴

---

## 예상 리소스
- Wave 0: 1 PR 직렬 ≈ 반나절
- Wave 1: 3 PR 병렬 ≈ 3-4일
- Wave 2: 3 PR 병렬 ≈ 4-5일 (mockgen 재도입 영향)
- Wave 3: 2 PR 병렬 ≈ 2일
- 독립 hotfix (2건): 1-2시간
- **Phase 19 총 기간**: 약 11-13 영업일 (병렬 실행 기준)

## 다음 액션
1. 사용자가 본 backlog 검토 + Open Decisions 4건 답변
2. `/plan-finish` Phase 19 audit (shadow) → `/plan-new` Phase 19 implementation
3. 18.8 observation 3일 누적 후 `/plan-finish` 18.8 → Phase 18.9(required 승격)와 병행 진행
