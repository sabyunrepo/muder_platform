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
| W1 | PR-3 HTTP Error / H-1 voice token / PR-1 WS Contract / PR-6 Auditlog | PR-3 ✅ #128 `03897f9` + H-1 ✅ #125 `367ca35` + PR-1 대부분 선제 완료 (헤더 메타만 본 PR · 진행 중) · PR-6 대기 |
| W2 | PR-5a/b/c Coverage Gate + mockgen → PR-7 Zustand Action | pending |
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

### PR-6 Auditlog Expansion — 현황 스캔만, 다음 세션 착수 (2026-04-21)
- **상태**: paused — 이번 세션 현황 스캔만 수행. 구현은 다음 세션.
- 선제 완료 (2/7): T1 migration, T4 review handler
  - `apps/server/db/migrations/00026_auditlog_expansion.sql:26-44` — schema_v2 완비
  - `review_handler.go:113,148,183,212` — approve/reject/suspend/trusted 4건
- 실질 잔여 (5/7):
  - **T2** auth password_change — 엔드포인트 자체 미구현. `event.go:34` 상수만 존재. 결정 필요 (PR-6 스코프 확장 vs 별도 PR)
  - **T3** admin ban/unban — `ActionAdminBan/Unban` 호출 0건. ban 엔드포인트 유무 먼저 확인
  - **T5** editor clue_edge/relation — `ActionEditorClueEdgesReplace`만 주입됨 (`clue_edge_handler.go:54`). Create/Delete + Relation_Create/Relation_Delete 4건 호출 필요
  - **T6** handler 단위 테스트 — `admin/handler_test.go` 9 + `auth/handler_test.go` 7 모두 NoOpLogger. CapturingLogger 주입 후 ≥6건 신규 작성 필요
  - **T7** staging 검증 — 00026 Down 절이 `DELETE WHERE session_id IS NULL` → rollback 시 user-only 데이터 소실 리스크. 먼저 migration 테스트 플랜 필요
- **규모 추정**: M (원래 L+ 추정 대비 축소). recordAudit 호출 5건 + 테스트 ≥6건 + staging 검증.
- **다음 세션 재개 가이드**:
  1. `/plan-resume` — active-plan.json 의 `current_pr=PR-6` 복원
  2. `git checkout -b feat/phase-19-residual/pr-6-auditlog-expansion`
  3. 착수 순서: editor clue_edge/relation 4건 → admin ban/unban 결정 → auth password_change 결정 → T6 테스트 → T7 staging
  4. 상세 scan_summary: `.claude/active-plan.json` `prs.PR-6.scan_summary`

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
