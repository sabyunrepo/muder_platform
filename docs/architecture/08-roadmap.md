---
file: 08-roadmap.md
purpose: 진행 중 + 직후 후보 phase — AI가 다음 작업 컨텍스트를 잡는 입력
audience: design-AI
last_verified: 2026-04-30
sources_of_truth:
  - memory/project_phase19_residual_progress.md
  - memory/sessions/2026-04-28-phase-22-w1-complete.md
  - memory/sessions/2026-04-28-debt-cleanup-runner-network.md
  - memory/sessions/2026-04-29-phase-23-custom-runner-image-merge.md
related: [09-issues-debt.md, 10-history-summary.md]
---

# 08. Roadmap (진행 중 + 직후 후보)

> AI 주의: 본 문서는 "지금 살아있는 작업"만 다룬다. 종료된 phase는 `10-history-summary.md`로.
> 미해결 문제·부채 ID는 `09-issues-debt.md`에서 인용한다.

## 진행 중 phase {#in-progress}

### Phase 19 Residual — 감사 backlog 잔여 9 PR + 2 hotfix

- **활성화일**: 2026-04-21 (Plan PR #119 머지, commit `19446a2`)
- **Plan dir**: `docs/plans/2026-04-21-phase-19-residual/`
- **목표**: Phase 19 audit + Architecture Audit Delta 11 PR 중 미착수 7건 + 신규 2건(WS Auth/Payload Validation) + 독립 hotfix 2건
- **예상 기간**: 16~19 영업일 (W0 0.5d / W1 4~5d / W2 6~7d / W3 2d / W4 3~4d)

| Wave | 항목 | ID (09-issues-debt) | 상태 |
|---|---|---|---|
| W0 | PR-0 MEMORY Canonical Migration | (closed — repo memory/ 이전 완료) | 완료 |
| W1 | PR-3 HTTP Error / PR-1 WS Contract / PR-6 Auditlog + H-1 voice token | ISSUE-19r-w1 | open |
| W2 | PR-5a/b/c Coverage Gate + mockgen → PR-7 Zustand Action | ISSUE-19r-w2 | open |
| W3 | PR-8 Module Cache Isolation + H-2 focus-visible | ISSUE-19r-w3 | open |
| W4 | PR-9 WS Auth Protocol / PR-10 Runtime Payload Validation | ISSUE-19r-w4 | open |

#### 비범위
- PR-2a/b/c, PR-4a/b — Phase 19 implementation에서 머지 완료
- graphify-driven PR-11~14 (Mutex/Linter/Dead-code/Audio) — Phase 21로 이월
- P2 백로그 28건 — Phase 22+ 기술 부채

### Phase 22 W1.5 — DEBT cleanup + Runner Network mini-plan

- **활성화일**: 2026-04-28
- **Plan dir**: `docs/plans/2026-04-28-phase-22-w1-5-debt-cleanup/`
- **목표**: Phase 22 W1 완료 후 노출된 main 누적 DEBT 5건 정리 + admin-skip 만료 진입 조건 충족
- **현 상태**:
  - PR #167 머지 (`6fa7460`) — DEBT-1/2/3 fix + 4-agent HIGH 4건 fold-in
  - PR #168 진행 중 (`chore/w1-5-runner-cache`, 8 commits) — Runner Cache + service container fix + RUNNERS_NET 동적 검출. CI in_progress (firefox shard 1)
  - PR #169 머지 (`35f8e0e`) — Stop hook 스키마 fix

| Wave 항목 | ID (09-issues-debt) | 상태 |
|---|---|---|
| PR-1 orphan-gate fixture (H-TEST-1) | ISSUE-w15-pr1 | open · M |
| PR-5 ci.yml runs-on `[self-hosted, containerized]` | ISSUE-w15-pr5 | open · M |
| PR-7 host `~/infra-runners` git clone | ISSUE-w15-pr7 | open · M |
| DEBT-4 gitleaks 분석 | DEBT-4-gitleaks | P0 |
| DEBT-5 govulncheck 분석 | DEBT-5-govulncheck | P0 |

#### 진입 차단
- **PR-168 CI green 미확정** → 다음 세션 첫 작업: `gh run list --branch=chore/w1-5-runner-cache`
- **PAT 회전 미확인** (RISK-PAT P0)

## 최근 머지 (in-flight 회고) {#just-merged}

| Phase | 머지 | 핵심 |
|---|---|---|
| Phase 23 (Custom Runner Image) | 2026-04-29 | KT registry → ghcr.io (#180 `035f004`), KT Cloud KS RunnerScaleSet values + smoke (#179 `4ad8c27`), image-resident toolchain (#176 `01d2808`), CI pruning P0+P1+P2 (#177 `2c63fbc`) |
| Phase 22 W1 (Runner Containerization) | 2026-04-28 | PR #165 + #166 — 5 runner pool 가동 (sabyun@100.90.38.7) |

## 직후 후보 phase {#next-candidates}

### Phase 21 — Coverage Raise + graphify-driven Cleanup
- **목표**: Web 커버리지 49% → 75%, Go 41% → 75%, graphify backlog PR-11~14 (Mutex/Linter/Dead-code/Audio)
- **수용 기준**:
  - Go enforcement gate 75%+ 5 PR 연속 green
  - Web Lines/Branches/Functions 모두 75%+ 1 PR
  - graphify backlog 11~14 각 PR 머지
- **예상 진입**: Phase 19 Residual W4 종료 + 22 W1.5 cleanup 후
- **출처**: `apps/web/CLAUDE.md` L17 (Phase 21 명시), `memory/project_phase19_residual_progress.md` L25

### Phase 24 (가칭) — Prod Readiness
- **목표**: K8s 1 Deployment 매니페스트 + Cloudflare Tunnel 외부 연결 + alert 규칙 정의 + 백업·복구 정책
- **수용 기준**:
  - K8s 매니페스트 + helm chart 또는 kustomize 진입
  - Cloudflare Tunnel으로 ingress :80 외부 노출
  - Sentry/OTel alert 규칙 (예: 5xx 임계, p99 latency)
  - DB 백업 정책 + 복구 시나리오 검증
- **출처**: `09-issues-debt.md` RISK-prod-deploy
- **상태**: 미진입 — Phase 21 종료 후 또는 병행 검토

### Phase 25 (가칭) — Editor UX 확장 + 에디터 정식 v2
- **후보 트리거**: Phase 20 종료 후 사용자 피드백 누적 시
- **상태**: 미정의 — 사용자 피드백 큐 검토 필요

## 정책·메타 변경 후보 {#policy-changes}

| 후보 | 트리거 | 출처 |
|---|---|---|
| admin-skip 정책 만료 | DEBT-1~5 모두 closed + 13 required check 5 PR 연속 green | `memory/project_ci_admin_skip_until_2026-05-01.md` |
| MD 한도 500줄 → 재조정 | plan/PR 스펙 분할 노이즈 재발 시 | `memory/feedback_file_size_limit.md` |
| graphify refresh 정책 (현 D) | watch 비용 < drift 비용 역전 시 | `memory/project_graphify_refresh_policy.md` |
| 4-agent 리뷰 자동화 | review 회피 사고 재발 시 | `memory/feedback_4agent_review_before_admin_merge.md` |

## AI 진입 시 결정 트리 {#decision-tree}

### "지금 어떤 PR을 만들어야 해?"
1. PR-168 머지 대기 중 → polling만 가능 (P0 ISSUE-pr168-ci)
2. PR-168 머지 후 → W1.5 PR-1 (orphan-gate) → PR-5 (runs-on) → PR-7 (host repo)
3. W1.5 종료 후 → DEBT-4/5 분석 → admin-skip 만료 시도
4. admin-skip 만료 후 → Phase 19 Residual W1 진입 (PR-3 HTTP Error 부터)

### "이 phase에 코드를 넣어도 돼?"
- "Phase 19 Residual 활성화 중" → Wave 정합성 확인. W1 미완료에서 W4 손대지 않기.
- "Phase 22 W1.5 활성화 중" → infra/CI 영역만. 백엔드 도메인 변경은 19 Residual로.
- 두 phase 동시 진행 중이지만 **영역 분리**: 19 Residual = 백엔드/WS/web 코드, 22 W1.5 = CI/runner/host infra.

### "신규 phase 디렉토리 어떻게 만들어?"
- 위치: `docs/plans/<YYYY-MM-DD>-<topic>/`
- 필수 파일: `design.md`, `plan.md`, `checklist.md`, `refs/`
- 카논: `memory/feedback_plan_autopilot_gotchas.md`, `mmp-pilot` `/plan-go` 단일 진입점 (M0~M3 cutover 완료)
- 진행 추적: 직접 read + git branch (workflow 자동화 폐기 2026-04-27)

### "phase 종료 처리?"
- `compound-mmp:wrap-up-mmp` 스킬 또는 `/compound-wrap` 슬래시 — 7단계 wrap 시퀀스
- MEMORY 갱신 + MISTAKES/QUESTIONS append + 다음 세션 핸드오프 노트
- graphify fresh rebuild + PR (Phase 종료 시점만)

## 완료된 진행 (회고) {#completed-recent}

> 자세한 1~3줄 요약은 `10-history-summary.md`.

- Phase 23 (Custom Runner Image) — 2026-04-29 머지
- Phase 22 W1 (Runner Containerization) — 2026-04-28 완료
- Phase 20 (단서·장소 에디터 정식) — 2026-04-17 완료 + 스테이징 QA 7/7 통과
- Phase 19.1 (Audit Review Follow-ups W1) — 2026-04-18 완료
- Phase 19 Implementation P0 — 2026-04-18 7/7 완료 (PR-2c #107 + hotfix #108)
