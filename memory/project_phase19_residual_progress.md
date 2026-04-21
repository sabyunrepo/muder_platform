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
| W0 | PR-0 MEMORY Canonical Migration | ✅ 완료 (#122 `c2f34a9`) + hygiene #123 `22b1a5a` |
| W1 | PR-3 HTTP Error / PR-1 WS Contract / PR-6 Auditlog + H-1 voice token | 착수 대기 |
| W2 | PR-5a/b/c Coverage Gate + mockgen → PR-7 Zustand Action | pending |
| W3 | PR-8 Module Cache Isolation + H-2 focus-visible | pending |
| W4 | PR-9 WS Auth Protocol / PR-10 Runtime Payload Validation | pending |

## 부수 PR

- **#121 preflight chore** (commit `3d8ccec`, 2026-04-21) — `.claude/scripts/plan-preflight.sh` M3 cutover(2026-04-15) 이후 legacy `~/.claude/skills/plan-autopilot` 경로 잔존 결함 수정. 추가로 inline bash hook(`[ -f x ] && touch y`) 오해석도 guard로 차단. `/plan-go` 파이프라인 정상화. PR-0 진행 전제 조건.
- **#122 PR-0 본체** (commit `c2f34a9`, 2026-04-21) — 9 files · +197/-35. Task 1–6 + Gate 충족. user home → repo 단일 출처 전환.
- **#123 hygiene** (commit `22b1a5a`, 2026-04-21) — 42 files × -1줄 (`originSessionId` strip). PR-0 이후 기존 repo 파일 일괄 정리. 로직 변경 0.

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
