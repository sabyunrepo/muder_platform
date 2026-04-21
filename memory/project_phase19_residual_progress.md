---
name: Phase 19 Residual — 감사 backlog 잔여 PR 실행
description: Phase 19 audit + Architecture Audit Delta 11 PR 중 미착수 7건 + 신규 2건(WS Auth/Payload Validation) + 독립 hotfix 2건. Plan PR #119 머지, W0 PR-0 진행 중.
type: project
---
## 활성화 (2026-04-21)

- **Plan dir**: `docs/plans/2026-04-21-phase-19-residual/`
- **Plan PR**: #119 머지 (commit `19446a2`, admin-skip squash)
- **MD 한도 완화 PR**: #120 머지 (commit `317be66`, 200→500, CLAUDE.md만 200)
- **Active**: `.claude/active-plan.json` → `phase-19-residual` / W0 / PR-0

## 범위 (9 PR + 2 hotfix)

| Wave | 항목 | 상태 |
|------|------|------|
| W0 | PR-0 MEMORY Canonical Migration | ✅ 완료 (#122 `c2f34a9`) + hygiene #123 `22b1a5a` + finalize #124 `6d24a29` |
| W1 | PR-3 HTTP Error / H-1 voice token / PR-1 WS Contract / PR-6 Auditlog | ✅ 완료 — PR-3 #128 `03897f9` + H-1 #125 `367ca35` + PR-1 #129 `80b603e` + PR-6 #131 `d8e6df0` (admin-squash) |
| W2 | PR-5a mockgen / PR-5b Coverage Gate / PR-5c 0% 패키지 복구 / PR-7 Zustand Action | PR-5a #132 `d1ac387` ✅ + PR-5b #133 `f21a6cf` ✅ + PR-5c 진행 중 (branch `feat/phase-19-residual/pr-5c-zero-coverage-recovery`, 7 신규 테스트 파일 + sqlc exclude) / PR-7 ✅ scope audit + 회귀 테스트 10건 완료 (branch `refactor/phase-19-residual/pr-7-zustand-apply-ws-event`) |
| W3 | PR-8 Module Cache Isolation + H-2 focus-visible | pending |
| W4 | PR-9 WS Auth Protocol / PR-10 Runtime Payload Validation | pending |

## 부수 PR

- **#121 preflight chore** (commit `3d8ccec`, 2026-04-21) — `.claude/scripts/plan-preflight.sh` M3 cutover(2026-04-15) 이후 legacy `~/.claude/skills/plan-autopilot` 경로 잔존 결함 수정. 추가로 inline bash hook(`[ -f x ] && touch y`) 오해석도 guard로 차단. `/plan-go` 파이프라인 정상화. PR-0 진행 전제 조건.
- **#122 PR-0 본체** (commit `c2f34a9`, 2026-04-21) — 9 files · +197/-35. Task 1–6 + Gate 충족. user home → repo 단일 출처 전환.
- **#123 hygiene** (commit `22b1a5a`, 2026-04-21) — 42 files × -1줄 (`originSessionId` strip). PR-0 이후 기존 repo 파일 일괄 정리. 로직 변경 0.
- **#126 preflight skill-path fix** (commit `04654a5`, 2026-04-21) — `.claude/commands/plan-*.md` 8개가 여전히 legacy `$HOME/.claude/skills/plan-go/scripts/plan-preflight.sh` (내부 `SKILL_DIR=plan-autopilot`) 호출 → `/plan-go` 진입 시 "plan-autopilot skill not found" 재발. project-local `$CLAUDE_PROJECT_DIR/.claude/scripts/...` 로 교체.
- **#127 preflight path fallback** (commit `e306fa8`, 2026-04-21) — #126 후속. slash command `!` shell substitution 은 `$CLAUDE_PROJECT_DIR` 를 주입하지 않아 `/` 루트로 resolve 됨. `${CLAUDE_PROJECT_DIR:-.}/.claude/scripts/...` parameter expansion fallback 적용. 로컬 검증: `✓ PRE-FLIGHT OK: 6/6 hooks verified`.

## W0 PR-0 진행

branch: `chore/phase-19-residual/pr-0-memory-canonical`

| Task | 상태 | 결과 |
|------|------|------|
| 1. user home ↔ repo diff | ✅ | drift 4건 + user-only 3건 + repo-only 4건 (repo-only는 정상). 예상 9건 → 실제 7건으로 scope 정정 |
| 2. 누락 feedback·progress 복원 | ✅ | 4 파일 복사 (session-id 스트립): feedback_file_size_limit, project_module_system, feedback_sonnet_46_default, project_session_2026-04-19_optimization |
| 3. MEMORY.md 인덱스 재작성 | ✅ | user home canonical 버전 적용 (67줄), 신규 feedback_memory_canonical_repo pointer 추가 |
| 4. QMD mmp-memory path 이전 | ✅ | store_collections.path: `~/.claude/projects/.../memory` → `<repo>/memory`. 64 files 재인덱싱 + context 갱신 |
| 5. user home read-only + CLAUDE.md 갱신 | ✅ (soft mode 확정) | CLAUDE.md QMD 섹션 갱신 + feedback_memory_canonical_repo.md 신설로 문서 엔포스먼트. filesystem chmod은 auto-memory 충돌 리스크로 적용 안 함 (2026-04-21 결정) |
| 6. 본 progress 메모리 생성 | ✅ | 이 파일 |

## W1 진행

### H-1 voice token regression-only (2026-04-21)
- PR #125 `367ca35` — `voice/provider_test.go` 신규 2 테스트 (`TestMockProviderDoesNotLogTokenValue`, `TestLiveKitProviderHasNoLoggerField`). 실제 redact 는 PR #83 `b9cc4ba` 에서 이미 처리됨. 이번은 회귀 방지 테스트만 추가.

### PR-3 HTTP Error Standardization — 선제 완료 검증 (2026-04-21)
- **상태**: Phase 19 Residual plan 작성 이전에 이미 선제 해결된 상태. 코드 변경 0, 문서 체크리스트만 갱신.
- 검증 근거:
  - `.go` 파일 대상 `Grep http\.Error` → 0 hits (audit 시점 ≥12건 → 현재 0건)
  - `seo/handler.go:122/137/152` + `ws/upgrade.go:117` 모두 `apperror.WriteError` 사용
  - `apps/server/.golangci.yml:13-19` `forbidigo` `^http\.Error$` deny + `F-sec-1` 주석 완비
  - handler 테스트 총 10건 (seo 4 + ws/upgrade 6) — 기준 ≥4 의 2.5배
- 비스코프: `seo/handler.go:108,114` `http.NotFound` 2건은 helper 차이로 별도 delta 분류

### PR-6 Auditlog Expansion — 완료 (2026-04-21)
- **상태**: ✅ merged-ready (branch `feat/phase-19-residual/pr-6-auditlog-expansion`)
- **사전 재발견**: 원 plan 이 가정했던 ban/unban/password_change 엔드포인트 + 개별 clue_edge CRUD + clue_relation CRUD 가 **프로젝트 전역에 아예 없음** → 5 action 상수가 wire-up 대상 미존재 → 스코프 자연 축소 (option A+)
- **실제 완료 scope**:
  - T1 ✅ migration 00026 (선제)
  - T2~T5 ✅ 모든 기존 recordAudit 주입 지점 검증 — 작업 0건 필요 (이미 주입됨)
  - **T6 ✅ CapturingLogger + 7건 신규 테스트**:
    - `auditlog/capturing_logger.go` (58 LOC, sync.Mutex, `auditlog.Logger` 구현)
    - auth: `TestChangeHandlerCapturesAudit_Login/Logout/Register` (3)
    - admin: `TestChangeHandlerCapturesAudit_RoleChange/ForceUnpublish` (2)
    - admin/review: `TestChangeHandlerCapturesAudit_Approve` (1)
    - editor: `TestChangeHandlerCapturesAudit_ClueEdgesReplace` (1)
    - `go test ./internal/domain/auth/... ./internal/domain/admin/... ./internal/domain/editor/... ./internal/auditlog/...` → 128 pass / 0 fail
  - **T7 ✅ smoke doc** (`refs/pr-6-migration-smoke.md`, ≈125줄) — up/down/up 순환 + staging 체크리스트 + forward-only 경고 + `audit_events_userrows_archive_00026` 백업 SQL
- **부수 수정 (F-sec-4)**: `admin/handler.go:59-62` `target==nil → actor` fallback 추가 — migration 00026 의 IDENTITY CHECK + admin 라우트 session-less 컨텍스트 조합으로 `ForceUnpublishTheme`/`ForceCloseRoom` 이 audit 무음 폐기하던 결함 수정 (review_handler.go:64-65 와 동일 패턴)
- **Orphan action 상수 7건 → Phase 21 후보**:
  - `ActionUserPasswordChange` (auth.ChangePassword 엔드포인트 부재)
  - `ActionAdminBan` / `ActionAdminUnban` (ban/unban 라이프사이클 부재)
  - `ActionEditorClueEdgeCreate` / `ActionEditorClueEdgeDelete` (개별 CRUD 부재, Replace 만 존재)
  - `ActionEditorClueRelationCreate` / `ActionEditorClueRelationDelete` (`clue_relation_*.go` 파일 전무)
  - Phase 21 권장: Ban/Unban lifecycle + Password Change + Clue Graph 개별 CRUD 5개 벌티컬 독립 PR
- **security-reviewer verdict**: APPROVE-WITH-COMMENTS (BLOCKer 0). F-sec-4 fallback 승인, payload redaction PII 없음, CapturingLogger race-safe. 개선 제안 1+2 (smoke doc 하드닝) 반영. review note PII 스캔은 Phase 19.x follow-up 으로 분리.
- **총 변경**: +7 파일 (capturing_logger + 4 audit test + smoke doc + admin handler +7), 0 파일 삭제.

### PR-1 WS Contract SSOT — 대부분 선제 완료 (2026-04-21)
- **상태**: 8 task 중 7개가 Phase 19 implementation (2026-04-18, `099a096`) 단계에 완비됨. 본 PR 은 Task 5 헤더 메타 동적화만 실질 구현.
- 선제 완료 근거 (task별 파일:라인):
  - T1 콜론 보존: `envelope_catalog.go:55-58` 설계 주석 + `_c2s.go:16`~ 콜론 엔트리 다수
  - T2 deprecated 마커: `envelope_catalog_s2c.go:46-47/79-80` `StatusDeprec`
  - T3 auth.* stub: `envelope_catalog_system.go:27-45` 6개 (C2S 3 + S2C 3) `StatusStub`
  - T4 wsgen:payload 어노테이션: `cmd/wsgen/payload.go:28` + `extractPayloads()` AST 파싱 219줄
  - T6 MSW shared import: `apps/web/src/mocks/handlers/game-ws.ts:22` `WsEventType` enum
  - T7 gameMessageHandlers.ts 통합: 파일 제거, `useGameSync.ts:68` 에 통합 명시
  - T8 CI drift gate: `.github/workflows/ci.yml:79-80` `go run ./cmd/wsgen` + `git diff --exit-code`
- **본 PR 실질 변경**: `cmd/wsgen/render.go` 의 `headerBlock` const → `renderHeader()` 동적 함수. 이벤트 총수 + active/stub/deprec breakdown + payload struct 수를 헤더에 기록. Status 만 바뀐 경우도 headerline 변경 → drift gate 가시화.
- **검증**: `go run ./cmd/wsgen` → 130 events, 2 payload structs · `go test ./internal/ws/...` → 86 pass · 첫 시도에 pending.go 에 auth.* 중복 추가 → panic → 즉시 되돌림 (system.go 에 이미 있음을 재발견)

## W2 PR-7 Zustand Action Unification — scope audit + 회귀 테스트 (2026-04-21)

### 실상 기록
refactor task 1–3은 선행 커밋에서 이미 완료 — 이 PR은 회귀 테스트 보강 + scope audit 문서화.

- **applyWsEvent 단일 reducer**: YAGNI 판정. 현재 Zustand selector action 바인딩 패턴으로 충분.
  WS 이벤트 8종이 `useGameSync.ts` 한 파일(139줄)에 집중되어 있어 switch reducer 전환 이점 없음.
- **selector 바인딩 완료**: `useGameSync.ts` 내 모든 game-session action이 `useGameStore((s) => s.action)` 패턴. `.getState()` 잔존 없음.
- **의도적 `.getState()` 잔존 3곳**:
  1. `useGameSync.ts:131,137` — `getModuleStore(id, sessionId).getState().setData/mergeData`. factory 동적 ID이므로 selector 바인딩 대상 아님. 주석 완비.
  2. `moduleStoreCleanup.ts:34,46` — factory cleanup 루프 내 store.getState().reset(). React 렌더 사이클 외부 호출이므로 정상.
  3. `GamePage.tsx:90` — unmount cleanup에서 `useGameStore.getState().resetGame()`. unmount는 렌더 외부이므로 `.getState()` 올바른 패턴. 주석 추가 완료.
- **Connection ↔ Domain 분리**: 명확. `connectionStore` = WS 클라이언트 생명주기. `gameSessionStore` = 게임 도메인 상태. WS 수신은 `useGameSync` 단일 entry.

### 회귀 테스트 (10건)
파일: `apps/web/src/hooks/__tests__/useGameSync.test.ts` (신규, 248줄)
- `useWsEvent` mock으로 핸들러 직접 캡처 → 이벤트 emit → store 상태 assertion 패턴
- SESSION_STATE → hydrateFromSnapshot → 전체 상태 복원
- PHASE_ADVANCED → setPhase → phase/deadline/round 갱신
- GAME_START → initGame → isGameActive=true + myPlayerId 주입
- GAME_END → resetGame → 상태 초기화
- PLAYER_JOINED → addPlayer → players 배열 추가
- PLAYER_LEFT → removePlayer → players 배열에서 제거
- MODULE_STATE → getModuleStore().setData → 모듈 데이터 전체 교체
- MODULE_EVENT → getModuleStore().mergeData → 모듈 데이터 병합
- 연속 이벤트 시나리오 2건 (GAME_START→PHASE_ADVANCED→PLAYER_JOINED, 이중 hydrate)
- **결과**: 10/10 pass

## W2 PR-5b Coverage Gate (2026-04-21)

### 베이스라인 측정 결과
- **Go**: 43.9% (60 packages, 1464 tests, mockgen 포함)
- **FE Lines/Statements**: 51.75% (11652/22513)
- **FE Branches**: 79.66% (2159/2710)
- **FE Functions**: 55.66% (614/1103)

### 적용 Threshold (baseline - 2% buffer)
- **Go**: 41% (plan target 70%는 Phase 21 — 테스트 보강 PR 선행 필수)
- **FE Lines/Statements**: 49%
- **FE Branches**: 77%
- **FE Functions**: 53%

### 변경 파일
- `.github/workflows/ci.yml` — go-check에 `upload-artifact: go-coverage`, ts-check에 `upload-artifact: web-coverage`, coverage-guard job 실제 gate로 교체 (warn-only placeholder 제거)
- `apps/web/vitest.config.ts` — `thresholds` 블록 추가 (lines/statements 49, branches 77, functions 53)
- `codecov.yml` — project threshold 1%, patch target 70%/threshold 0%

### 로드맵
| Phase | Go | FE Lines | FE Branches | FE Functions |
|-------|----|----------|-------------|--------------|
| 현재(19R) | 41% | 49% | 77% | 53% |
| Phase 20 | 55% | 55% | 80% | 58% |
| Phase 21 | 70% | 65% | 85% | 68% |

하한 상향 전 반드시 추가 테스트 PR로 baseline 끌어올리기.

## 결정 사항

1. ✅ Phase 19 디렉터리 재활용 대신 신규 `2026-04-21-phase-19-residual/` 생성 — 기존 Phase 19 checklist archived
2. ✅ MD 파일 한도 200→500 완화 (CLAUDE.md만 200) — plan/PR 스펙 분할 노이즈 해소
3. ✅ active-plan.json 13 PR 전부 schema 등록 (PR-0/1/3/5a/5b/5c/6/7/8/9/10 + H-1/H-2)
4. ✅ **memory canonical = repo `memory/`** (Task 5) — auto-memory user home 경로는 archival, `originSessionId` frontmatter 금지, QMD mmp-memory 컬렉션 repo 바인딩
5. ✅ **soft mode 확정** (2026-04-21) — filesystem chmod 미적용. 이유: ①auto-memory write 실패 시 미래 세션 노이즈, ②규칙 자체는 CLAUDE.md § QMD + `feedback_memory_canonical_repo.md`로 문서 엔포스. 재발 탐지는 `diff -rq <user-home> memory/` 주기 점검으로 충분.
6. ✅ **hygiene PR 분리** (#123) — PR-0 직후 기존 42건 `originSessionId` 일괄 스트립. PR-0 리뷰 범위 집중도 보존.

## 비범위

- PR-2a/b/c, PR-4a/b — Phase 19 implementation에서 머지 완료
- graphify-driven PR-11~14 (Mutex/Linter/Dead-code/Audio) — Phase 21로 이월
- P2 백로그 28건 — Phase 22+ 기술 부채

## 예상 기간
16–19 영업일 (W0 0.5d / W1 4–5d / W2 6–7d / W3 2d / W4 3–4d)

## 참조

- design: `docs/plans/2026-04-21-phase-19-residual/design.md`
- plan: `docs/plans/2026-04-21-phase-19-residual/plan.md`
- checklist: `docs/plans/2026-04-21-phase-19-residual/checklist.md`
- backlog source: `docs/plans/2026-04-21-phase-19-residual/refs/backlog-source.md`
- 원 backlog: `docs/plans/2026-04-17-platform-deep-audit/refs/phase19-backlog.md`
- delta priority: `docs/plans/2026-04-18-architecture-audit-delta/priority-update.md`
- memory canonical rule: `memory/feedback_memory_canonical_repo.md`
