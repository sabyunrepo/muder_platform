---
name: Phase 18.7 완료
description: CI/Test automation hardening (Hotfix + 7 PR, 4 Wave) — migration drift gate, cache, SHA pin, coverage upload, security scans, SBOM, E2E shard+firefox, Renovate
type: project
originSessionId: a17861e7-5524-41d6-b0e3-eebb414caa6c
---
# Phase 18.7 — CI/Test Automation Hardening (완료)

**기간:** 2026-04-16 (단일 세션 내 8 PR 머지)
**촉발:** 로컬 서버 `/clue-relations` → `SQLSTATE 42P01` (00022_clue_relations 미적용). nightly `phase-18.1-real-backend.yml`도 같은 원인으로 상시 FAIL.
**접근:** Hotfix 1건 즉시 머지 + Phase 18.7 통합 정비 (Wave 4개, 7 PR).

## 머지된 PR 매트릭스

| Wave | PR | 커밋 | 내용 |
|------|----|------|------|
| H | #53 | d4f0583 | Hotfix: goose install + up + **migration drift gate** + seed + ws-client build |
| — | #54 | d85348e | Phase 18.7 design/plan/checklist/refs 5개 문서 |
| 1 | #55 | a7b0ae6 | pnpm cache + buildx GHA cache (docker build 4m → 33s) |
| 1 | #56 | 998b221 | Taskfile.yml 제거 + Makefile 단일화 + **SHA pinning 모든 actions** + harden-runner audit |
| 2 | #58 | 38cadf4 | Go/Vitest coverage Codecov v5 업로드 + PR summary + regression guard placeholder |
| 2 | #59 | 082ae6f | govulncheck + gitleaks fast-feedback (warn-only 6주) |
| 2 | #57 | 55e246c | SBOM (anchore CycloneDX) + attest-build-provenance + release.yml 골격 |
| 2 | #60 | fea0790 | trivy + osv-scanner standalone + CodeQL matrix (warn-only) |
| 3 | #61 | 3b1fda3 | E2E 2×2 matrix (chromium+firefox × shard 1/2) + merge-reports + flaky-report 주간 cron |
| 4 | #62 | f8850f2 | Renovate 4 ecosystem + 보안 auto-merge + helpers:pinGitHubActionDigests |

## 핵심 성과

### 재발 방지
- **Migration drift gate** — `MAX(goose_db_version.version_id) != 최신 파일 번호` fail. 오늘 사건 재발 차단.
- Go 버전 드리프트 해소 (1.24 → 1.25 통일).

### 공급망
- 모든 3rd-party action **SHA pin** (15+ actions).
- `step-security/harden-runner` audit 모드 (1주 후 block 전환 예약).
- Renovate app이 도입되면 SHA도 자동 bump.

### 관측성 및 보안
- Codecov 업로드 확인 (Statements 50.59%, Functions 54.89% — baseline).
- Security tab 3종 알림 활성 (CodeQL + Trivy + osv-scanner).
- govulncheck가 **11 기존 Go 취약점** 식별(go-chi/v5 v5.2.1, Go 1.26 stdlib).
- osv-scanner가 29 vulns, trivy 3 HIGH 식별.

### 성능
- PR CI Docker Build 1m10s → 33s (캐시 효과).
- E2E 10분+ → 2-3분 × 4 shard 병렬 (총 시간 70% 단축).

## 신규 워크플로우

| 파일 | 목적 |
|-----|------|
| `security-fast.yml` | govulncheck + gitleaks (<60s PR 피드백) |
| `security-deep.yml` | trivy + osv-scanner standalone + CodeQL matrix (nightly 04:00 UTC + PR/push) |
| `flaky-report.yml` | 주간 월요일 06:00 UTC `@flaky` 태그 재시도 리포트 |
| `release.yml` | tag `v*` trigger GHCR push + SBOM + provenance (구조만, 활성화 대기) |

## User Action 필요 (Follow-up)

1. **Codecov badge token** — codecov.io 대시보드에서 복사해 README 반영
2. **Renovate GitHub App 설치** — https://github.com/apps/renovate/installations/select_target
3. **Branch protection required checks 갱신** — 이전 `E2E Stubbed Backend (Chromium)` → 4 matrix cells + `Merge Playwright reports` + security 체크 추가
4. **Codecov 토큰 rotate** — 대화 로그에 평문 노출됐으므로 보안상 권장
5. **harden-runner audit → block** (1주 후, 별도 PR)
6. **Regression guard warn → enforce** (2026-05-28 이후, 별도 PR)

## Follow-up Work (Phase 18.8 또는 별도)

- Deps bump: go-chi/v5 v5.2.2, Go 1.26.1 stdlib, dompurify/vite/esbuild 등 (Renovate 자동 일부 처리 기대)
- matrix job의 corepack enable → pnpm/action-setup@v5.0.0 일관화 (사소)
- 커버리지 0% 도메인 테스트 작성 (coin/creator/sound/voice/infra)
- `routes_editor_*.go` 4개 통합 테스트
- E2E skip 36개 재활성화 조사 (PR #61 본문 표 참고)
- `game-session-live.spec.ts` real-backend 재활성화

## 교훈

- **Reusable workflow는 `continue-on-error` 미지원** — standalone job으로 변환 후 step에 적용 (PR #60 osv-scanner 수정 사건)
- **`pnpm/action-setup` v5는 `packageManager` 자동 감지** — `version:` 입력 제거해야 `ERR_PNPM_BAD_PM_VERSION` 회피 (PR #61 merge-reports 수정 사건)
- **gh OAuth token에 `workflow` scope 필수** — workflow 파일 수정 PR 머지 시 (PR #57 차단 사건)
- **초기 보안 스캔 도입은 warn-only**로 시작 — 기존 취약점이 CI block이면 롤아웃 불가
