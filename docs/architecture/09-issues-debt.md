---
file: 09-issues-debt.md
purpose: 현재 문제점 + 기술 부채 + 미해결 backlog — 설계 AI의 1차 입력
audience: design-AI
last_verified: 2026-04-30
sources_of_truth:
  - memory/project_ci_admin_skip_until_2026-05-01.md
  - memory/feedback_ci_infra_debt.md
  - memory/sessions/2026-04-28-debt-cleanup-runner-network.md
  - memory/sessions/2026-04-29-phase-23-custom-runner-image-merge.md
  - memory/project_phase19_residual_progress.md
related: [02-backend.md, 05-realtime.md, 06-infra-cicd.md, 08-roadmap.md]
---

# 09. Issues, Debt, and Open Questions

> AI 주의: 이 문서가 설계 AI의 **첫 입력**이다. 신규 기능 추가·문제 해결 진입 시 여기서 ID(`DEBT-*`, `ISSUE-*`, `RISK-*`, `TODO-*`)를 인용한다.
> ID는 영구 식별자 — 본 문서에서만 발행·관리. 다른 곳에서 새로 만들지 말 것.

## 범례 {#legend}

- **유형**: `DEBT` 코드/CI 누적 부채 · `ISSUE` 미구현·미결정 작업 · `RISK` 보안·운영 위험 · `TODO` 단순 작업
- **상태**: `open` 미해결 · `in-progress` 진행 중 · `closed` 해결됨 (요약 유지)
- **우선순위**: P0 즉시 / P1 다음 phase / P2 다음 분기 / P3 backlog
- **Effort**: S(<1d) / M(1~3d) / L(>3d)
- **Impact**: H 코어 영향 / M 영역 영향 / L 국소

## P0 — 즉시 처리 {#p0}

| ID | 제목 | 상태 | 영역 | 현상 | 원인 가설 | 영향 | 근거 | 차단 작업 |
|---|---|---|---|---|---|---|---|---|
| RISK-PAT | GHCR/runner PAT 노출 | open · S · H | infra | `docker compose config` 출력에 PAT plain text 노출. 회전 미확인 | host runner compose에 직접 PAT 환경변수 사용 | 토큰 탈취 시 GHCR push·repo 변조 가능 | sessions/2026-04-28-debt-cleanup-runner-network.md L16 | 사용자 GH UI revoke + 재발급 검증 |
| ISSUE-pr168-ci | PR #168 CI 결과 polling | open · S · M | infra | `chore/w1-5-runner-cache` firefox shard 1 in_progress 상태로 세션 종료 | runner image + service container init bug 다중 fix 후 검증 미완 | green 시 admin-merge → W1.5 PR-1 진입 가능 | sessions/2026-04-28 L28, L65 | `gh run list --branch=chore/w1-5-runner-cache` 확인 |
| DEBT-4-gitleaks | gitleaks Secret scan 분석 미완 | open · M · M | security | 결과 분석 미완 — false positive vs real 구분 안 됨 | DEBT-4 진단 루프 단계 | admin-skip 만료 차단 사유 #4 | project_ci_admin_skip_until_2026-05-01.md L15, sessions L75 | false positive면 baseline 추가, real이면 secret rotation |
| DEBT-5-govulncheck | govulncheck CRITICAL/HIGH CVE 검토 + 5분 timeout | open · M · M | security | 결과 분석 미완 + 5분 timeout 빈발 | 의존성 트리 크기 + workflow timeout 설정 | admin-skip 만료 차단 사유 #5 | project_ci_admin_skip_until_2026-05-01.md L15, sessions L75 | 분석 결과 분류 + workflow timeout 조정 |

## P1 — 다음 phase {#p1}

| ID | 제목 | 상태 | 영역 | 현상 | 원인 가설 | 영향 | 근거 | 차단 작업 |
|---|---|---|---|---|---|---|---|---|
| ISSUE-w15-pr1 | W1.5 PR-1 orphan-gate fixture | open · M · M | ci | E2E orphan listener guard fixture 부재 → PR-167 H-TEST-1 fold-in 보류 | DEBT-3 fix와 fixture 도입을 동일 PR에 묶지 못함 | 회귀 방지 부재 | sessions/2026-04-28 L70 | branch `chore/w1-5-orphan-gate` 생성 + PR |
| ISSUE-w15-pr5 | W1.5 PR-5 ci.yml runs-on 전환 | open · M · M | ci | `ci.yml` 4 job 이 `[self-hosted, containerized]` 미전환 (e2e-stubbed.yml만 W3 partial) | dev compose `:8080` 충돌 회피용 점진 전환 | DEBT-1/2 효과 영구 회복 차단 + collision 잠재 | sessions/2026-04-28 L31, L71 | branch `chore/w1-5-ci-runs-on` 생성 |
| ISSUE-w15-pr7 | host `~/infra-runners` git clone 절차 | open · M · L | infra | host runner compose가 git repo 아님 → PR 머지 자동 동기화 부재 | manual SCP 부담 + PAT 노출 원인 | infra drift + 운영 부담 | sessions/2026-04-28 L72 | branch `chore/w1-5-host-repo-sync` |
| ISSUE-19r-w1 | Phase 19 Residual W1 — PR-3/PR-1/PR-6/H-1 | open · L · H | backend/web | HTTP Error / WS Contract / Auditlog + voice token redaction 미구현 | Phase 19 Implementation P0 후 W1으로 분할 | API 응답 일관성·WS drift·감사 누락 | project_phase19_residual_progress.md L18 | plan: docs/plans/2026-04-21-phase-19-residual/ |
| ISSUE-19r-w2 | Phase 19 Residual W2 — PR-5a/b/c + PR-7 | open · L · H | backend/web | Coverage Gate + mockgen 자동화 + Zustand Action 패턴 미구현 | 커버리지 gate 41%로 정체 + 프론트 액션 일관성 부족 | 신규 모듈 회귀 위험 + 프론트 유지보수성 | project_phase19_residual_progress.md L19 | 동일 plan dir |
| ISSUE-19r-w3 | Phase 19 Residual W3 — PR-8 + H-2 | open · M · M | backend/web | Module Cache Isolation + focus-visible 접근성 | 세션 간 캐시 누설 가능성 + WCAG 2.1 AA 미충족 | 보안·접근성 | project_phase19_residual_progress.md L20 | 동일 plan dir |
| ISSUE-19r-w4 | Phase 19 Residual W4 — PR-9 + PR-10 | open · L · H | ws | WS Auth Protocol + Runtime Payload Validation 미구현 | 재접속 auth.resume 미확정 + WS payload 핸들러 임시 검증 | 인증 우회·payload 주입 위험 | project_phase19_residual_progress.md L21 | 동일 plan dir |

## P2 — 다음 분기 {#p2}

| ID | 제목 | 상태 | 영역 | 현상 | 원인 가설 | 영향 | 근거 |
|---|---|---|---|---|---|---|---|
| DEBT-coverage-go | Go 커버리지 41% (목표 75%) | open · L · M | backend | enforcement gate 41% — Phase 19.1 이후 정체 | 통합 테스트 시간 + module 다양성 | 회귀 탐지율 낮음 | apps/server/CLAUDE.md L24 |
| DEBT-coverage-web | Web 커버리지 49% / Branches 77% / Functions 53% (목표 75%) | open · L · M | web | Phase 21에서 raise 예정 | 컴포넌트 외부 의존 다수 (라이브 WS) | 회귀 탐지율 낮음 | apps/web/CLAUDE.md L17 |
| ISSUE-graphify-pr11-14 | graphify-driven backlog 11~14 (Mutex/Linter/Dead-code/Audio) | open · L · M | meta | Phase 21로 이월 | Phase 19 audit에서 graphify 분석 결과 도출 | 코드 품질 누적 | project_phase19_residual_progress.md L25 |
| RISK-prod-deploy | prod K8s 배포 정책 미확정 | open · L · H | infra | "K8s 1 Deployment + Cloudflare Pages" 명시뿐, 매니페스트·배포 워크플로우 부재 | infra phase 미진입 | 본격 운영 진입 차단 | memory/project_overview.md L15 |
| ISSUE-mobile | apps/mobile 활성도 UNVERIFIED | open · ? · ? | mobile | Expo 패키지 존재 — 실제 작업 활성도 직접 확인 필요 | 메모리 미갱신 | 향후 모바일 기능 설계 시 정합성 | memory/project_overview.md L17 |
| DEBT-graphify-stale | graphify-out 2026-04-22 빌드 + `.needs_update` 마크 | open · S · L | meta | 8일 묵음 — 신규 모듈·migration 반영 안 됨 | 일상 watch 비활성 + Phase 종료 시점만 rebuild 정책 | AI 설계 입력 정확도 저하 | graphify-out/.needs_update mtime 2026-04-30 |
| TODO-ws-msg-catalog | WS 메시지 타입 정확 enum 문서화 부재 | open · S · L | docs | `internal/ws/envelope_catalog_*.go` 4 카테고리는 식별, 개별 타입 enum 미수록 | 본 문서 작성 시 확인 시간 부족 | 신규 메시지 추가 시 패턴 확인 시간 증가 | 본 architecture 문서 자체 |
| TODO-cmd-entrypoint | `apps/server/cmd/` 정확한 진입점 위치 UNVERIFIED | open · S · L | docs | 02-backend.md L13 UNVERIFIED 표기 | 직접 read 미수행 | 신규 합류 AI의 부팅 흐름 파악 시간 증가 | 02-backend.md L13 |

## P3 — Backlog {#p3}

| ID | 제목 | 상태 | 영역 | 비고 |
|---|---|---|---|---|
| ISSUE-p2-bag | P2 백로그 28건 (Phase 19 audit 잔여) | open · ? · ? | meta | Phase 22+ 기술 부채. 본 문서에 개별 항목 미수록 — `docs/plans/2026-04-17-platform-deep-audit/refs/phase19-backlog.md` 참조 |
| ISSUE-mockgen-tools | Go 1.24 tool directive (`go.mod`) | open · S · L | tooling | `go.mod` line 174 `tool go.uber.org/mock/mockgen` — Go 1.25 toolchain과 호환 확인 필요 |
| ISSUE-cloudflare-tunnel | Cloudflare Tunnel 외부 연결 | open · M · M | infra | "나중에" 명시뿐 — 시점 미정 (memory/project_infra_docker.md L9) |
| ISSUE-livekit-spatial | spatial_voice 모듈 미검증 운영 부하 | open · M · M | voice | LiveKit room + 근접 기반 audio mixing — prod 부하 검증 부재 |

## 최근 해결 (closed) — 요약 {#closed-recent}

| ID | 해결 | PR | 비고 |
|---|---|---|---|
| DEBT-1-gofmt | Go gofmt 4 file | #167 (`6fa7460`) | 2026-04-28 W1.5 |
| DEBT-2-staticcheck | text_chat_test.go S1025 | #167 (`6fa7460`) | 2026-04-28 W1.5 |
| DEBT-3-e2e-register | E2E `/api/v1/auth/register` HTTP 500 | #167 + verify in PR-168 commit `4b21eba` | "Seed E2E user OK" 검증 |
| H-SEC-1 | pkill cross-kill 위험 | #167 fold-in `dddf2d5` | 4-agent HIGH |
| H-ARCH-1 | 가드 sunset 표지 부재 | #167 fold-in | 4-agent HIGH |
| H-ARCH-2 | scope creep | #167 fold-in (disclosure) | 4-agent HIGH |
| H-1/2/4/5 (PR-168) | fork PR poisoning + cache 충돌 + race-safe + Option A | PR-168 fold-in commits | 4-agent HIGH 5건 |
| ISSUE-stop-hook-schema | Stop hook JSON 스키마 위반 | #169 (`35f8e0e`) | hookSpecificOutput → systemMessage |
| Phase 19.1 W1 (PR #111~#113) | strict env / coverage lint AST / PeerLeakAssert | 머지 완료 | 2026-04-18 |
| Phase 23 chicken-egg | KT registry → ghcr.io | #180 (`035f004`) | Phase 23 머지 |
| Phase 23 RunnerScaleSet | KT Cloud KS values + smoke test | #179 (`4ad8c27`) | Phase 23 |
| Phase 23 image-resident toolchain | Go/Node/Playwright 사전 설치 | #176 (`01d2808`) | Phase 23 |

> 더 오래된 closed 항목은 `10-history-summary.md` 참조.

## 횡단 위험 (cross-cutting risks) {#cross-cutting}

> Phase 19 Audit에서 식별된 8 cross-cutting + 4 decisions resolved. 본 문서는 미해결만 추적.

| 영역 | 미해결 위험 |
|---|---|
| **보안** | RISK-PAT (P0), ISSUE-19r-w4 (WS auth/payload, P1) |
| **WS drift** | ISSUE-19r-w1 PR-1, TODO-ws-msg-catalog |
| **재접속 정합성** | ISSUE-19r-w4 PR-9 (auth.resume 확정) |
| **per-player redaction** | PR-2c #107 사고 카논 — 신규 모듈 추가 시 4-agent 리뷰 강제 |
| **CI 안정성** | DEBT-4/5, ISSUE-w15-pr5 (runs-on 일관성) |
| **운영 정합성** | ISSUE-w15-pr7 (host repo sync), RISK-prod-deploy |
| **관측성** | Sentry/OTel는 활성, alert 규칙 미정의 (UNVERIFIED) |
| **접근성** | ISSUE-19r-w3 H-2 (focus-visible / WCAG 2.1 AA) |

## AI 진입 포인트 가이드 {#ai-entry-guide}

### "현재 가장 시급한 게 뭐야?"
→ P0 4건 (RISK-PAT, ISSUE-pr168-ci, DEBT-4-gitleaks, DEBT-5-govulncheck)

### "신규 기능 추가하려는데 막힌 부분이 있을까?"
→ ISSUE-19r-w4 (WS auth/payload validation 미완성) → 신규 WS 메시지 추가 시 임시 검증 필요. PR-10 머지 후 cleanup 부담 고려.
→ DEBT-coverage-* → 신규 코드의 테스트 커버리지 PR 단위로 enforce.

### "보안 관점에서 손볼 곳?"
→ RISK-PAT (P0) → ISSUE-19r-w4 (P1) → PR-8 Module Cache Isolation (P1).

### "성능·관측성 우려?"
→ DEBT-5-govulncheck timeout (P0) → spatial_voice 부하 (P3) → alert 규칙 정의 (UNVERIFIED).

### "어떤 PR을 다음으로 머지하면 가장 효과적?"
→ 머지 순서 권장 (의존성 고려): PR-168 → W1.5 PR-1/PR-5/PR-7 → DEBT-4/5 → 19r W1 → W2 → W3 → W4.
