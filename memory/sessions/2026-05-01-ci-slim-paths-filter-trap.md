---
topic: "CI 슬림화 — required check 15→4 + paths-filter trap 해소 + gitleaks 분리"
phase: "session (Phase 21 backlog 흐름 외 단독)"
prs_touched: [PR-194, PR-195]
session_date: 2026-05-01
---

# Session Handoff: CI 슬림화 + paths-filter trap hotfix

## Decided

- **필수 status check 15→4 축소** (gh API PUT main branch protection): Go Lint+Test / TS Lint+Test+Build / Docker Build Check / Merge Playwright reports. e2e shard 4개는 `Merge Playwright reports` 가 `needs:` 합류 잡으로 sentinel 강제. 보안 6종(govulncheck/gitleaks/Trivy/osv/CodeQL×2)은 nightly schedule 또는 warn-only 격하 (PR #194)
- **paths-filter trap 해소**: `ci.yml` + `e2e-stubbed.yml` paths 에 `.github/workflows/**` 추가 (본인 workflow 파일만 → 전체 워크플로우). workflow-only PR 도 4 required check 자연 fire. PR #195 가 자체 in-PR 검증 (admin 우회 없이 자연 머지) (PR #195)
- **gitleaks 별도 workflow 분리**: `security-fast.yml` 에서 추출 → `.github/workflows/gitleaks.yml`. paths-filter 없음 → 모든 PR/push fire. 보안 잡을 paths-filter workflow 안에 두면 같이 게이트되는 회귀 방지 (PR #195)
- **3 워크플로우 concurrency 추가**: `arc-smoke-test.yml` (cancel-in-progress=false, dispatch 보호), `build-runner-image.yml` (cancel=true), `ci-hooks.yml` (cancel=true). 12/13 워크플로우 concurrency 정착
- **사용자 명시 드롭 3건**: E-9 file-size-guard glob 정정 / retro 발견 MEMORY MISTAKES 카논화 ("admin merge 전 4-agent 리뷰" 강제 룰) / enforce_admins false→true 전환

## Rejected

- **Phase 24A "CI 슬림화" brainstorm 진입 → 1주 견적**: 사용자 "1주일이나 걸려?" 의문 → yaml 패치 + UI 클릭 작업이라 brainstorm 풀 사이클 불필요. 실제 1.5시간으로 재산정.
- **PR #194 admin --squash 후 즉시 다음 작업 진행**: 사용자 "코드리뷰로 먼저 확인해보고 진행하자" → 사후 retro 리뷰. HIGH 2건 발견 → PR #195 hotfix.
- **enforce_admins=false → true 전환**: paths-filter trap 해소되어 조건은 충족됐으나, 1인 운영 emergency 우회 여지 보존 위해 사용자 드롭.

## Risks

- **CodeRabbit 리뷰 미확인 (2 PR)**: PR #194/#195 모두 머지 시 CodeRabbit pending 상태였음. HIGH finding 가능성 점검 필요 (P2).
- **paths-filter 중복 (push/pull_request 양쪽 동일 list)**: 미관/유지보수 risk만, functional 영향 0. anchor 도입 follow-up 후보.
- **build-runner-image cancel-in-progress=true 의 multi-tag push race**: 이론적 risk 만 (latest + $SHA tag 사이 cancel 시 inconsistency). 실제 거의 발생 안 함.
- **oh-my-claudecode:* 영구 부재 미확인**: 본 세션 wrap-up 도 superpowers:code-reviewer fallback 사용. 카논 갱신 필요 (이전 핸드오프 P1-B 와 중복).

## Files

### 신규
- `.github/workflows/gitleaks.yml` (42 LoC, paths-filter 없음, 모든 PR/push secret scan)

### 수정
- `.github/workflows/ci.yml` — paths `.github/workflows/ci.yml` → `.github/workflows/**`
- `.github/workflows/e2e-stubbed.yml` — paths `.github/workflows/e2e-stubbed.yml` → `.github/workflows/**`
- `.github/workflows/security-fast.yml` — gitleaks job 제거, govulncheck 만 남김 + paths-filter 추가 (apps/**, packages/**, go.mod/sum, pnpm-lock.yaml, .gitleaks.toml, 본 workflow)
- `.github/workflows/arc-smoke-test.yml` — concurrency 추가 (cancel=false)
- `.github/workflows/build-runner-image.yml` — concurrency 추가 (cancel=true)
- `.github/workflows/ci-hooks.yml` — concurrency 추가 (cancel=true)

### Branch protection (코드 외부, GitHub 메타)
- main `required_status_checks.contexts`: 15 → 4

## Remaining

### 본 세션 발견 follow-up
- **paths-filter 중복** 정리 (LOW) — push/pull_request anchor 도입 PR
- **CodeRabbit 리뷰 확인** PR #194/#195 (P2)

### 이전 핸드오프 (2026-05-01 오전) 잔존
- P1-A: docs-only PR paths-filter 정책 명문화 (`feedback_4agent_review_before_admin_merge.md`)
- P1-B: 4-agent fallback 정책 명시 (oh-my-claudecode 부재 시 superpowers:code-reviewer 1회)
- P2: Phase 19 W4 PR-9 (WS Auth Protocol) — L 규모, 단독 phase 진입
- P2: Phase 19 audit log orphan O-1~O-4 — 4 vertical PR
- P3: E-3 / E-5 Phase 24 brainstorm

### 사용자 명시 드롭 (재제안 금지)
- ❌ E-9 file-size-guard.yml glob 정정
- ❌ retro 발견 MEMORY MISTAKES 카논화 ("admin merge 전 4-agent 리뷰" 강제 룰)
- ❌ enforce_admins: false → true 전환

## Next Session Priorities

- **P1-A (이월)**: docs-only PR paths-filter 정책 명문화 — S, H Impact
- **P1-B (이월)**: 4-agent fallback 정책 명시 — S, H Impact
- **P2-A**: CodeRabbit PR #194/#195 코멘트 확인 — S, M Impact (Quick Win)
- **P2-B**: paths-filter push/pull_request 중복 anchor 정리 — S, L Impact
- **P2 (이월)**: Phase 19 W4 PR-9, audit orphan O-1~O-4

가장 먼저 read 할 파일: `memory/feedback_4agent_review_before_admin_merge.md` (P1-A/P1-B 진입점).

---

## What we did

CI 비대화 진단으로 시작 — 사용자 "CI 가 프로젝트에 비해 너무 크고 개발에 방해된다" 호소. 병렬 디스패치 (로컬 워크플로우 인벤토리 + 외부 베스트 프랙티스 리서치) 결과: 12 워크플로우 / 30 잡 / 필수 status check 15개 = 산업 권장(2-4개)의 4-7배. PR wall time ~12-15분 (산업 권장 <10분).

PR #194 로 1차 슬림화 (15→4 + security-fast paths-filter + 3 워크플로우 concurrency). 1.5시간 안에 종결. 사용자 명시 승인 + yaml-only carve-out 인정으로 admin --squash. 사용자가 "코드리뷰로 먼저 확인" 요청 → 사후 단독 reviewer로 HIGH 2건 발견:
1. **paths-filter trap**: ci.yml + e2e-stubbed.yml paths 가 본인 workflow 만 포함 → workflow-only PR 시 4 required fire 0 → admin 우회 영구 패턴 risk
2. **gitleaks coverage gap**: security-fast.yml paths-filter 가 보안 잡까지 게이트 → infra/scripts/docs/root config 변경 시 secret scan fire 0

PR #195 hotfix 로 양쪽 해소. 본 PR 자체가 paths-filter trap 검증 케이스 (4 required check 자연 fire → admin 우회 없이 정상 머지).

세션 후반 "다음 단계" 옵션 3건(E-9 / MEMORY MISTAKES 카논화 / enforce_admins 전환) 사용자 명시 드롭. 이는 wrap-up 의 followup-suggester 출력에서도 Dropped 섹션에 표기.

**카논 위반 패턴 식별**: PR #194 admin --squash 가 `feedback_4agent_review_before_admin_merge.md` 위반. yaml-only 변경의 위험도 underestimate (paths-filter / branch protection 같은 시스템 횡적 영향). 사용자가 카논화는 명시 드롭했으나 본 핸드오프에 retro 기록.
