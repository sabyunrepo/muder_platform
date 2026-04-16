# Phase 18.7 — CI/Test Automation Hardening

**Date:** 2026-04-16
**Status:** Planning → Execution
**Scope:** 4개 Wave / 7 PR / +1 Hotfix (PR #53 분리)

## 배경

2026-04-16 로컬 서버에서 `/clue-relations` 엔드포인트가 `SQLSTATE 42P01`로 실패. Phase 17.5에서 추가된 마이그레이션 `00022_clue_relations.sql`이 **적용되지 않은 상태**였음. 같은 구조적 문제가 nightly `phase-18.1-real-backend.yml`에도 존재해 매일 FAILURE 중이었음.

이 사건을 단일 버그가 아닌 **CI 파이프라인 구조 부채**의 징후로 보고, 단발 hotfix + 통합 정비의 2단 접근을 채택.

## 문제 목록 (증거 기반)

| # | 카테고리 | 현상 | 증거 |
|---|---------|------|------|
| 1 | Migration drift | nightly FAIL 누적 | `phase-18.1-real-backend.yml`에 goose 스텝 전무 |
| 2 | Go 버전 드리프트 | 1.24/1.25 혼재 | ci.yml=1.25, 나머지=1.24 |
| 3 | 캐시 부재 | CI 빌드 3~5분 낭비 | pnpm cache 미설정, docker buildx 없음 |
| 4 | 보안 스캔 0건 | 취약점 감지 불가 | govulncheck/trivy/osv/gitleaks 전무 |
| 5 | 커버리지 가시성 | 숫자 확인 불가 | coverage.out만 생성, upload·threshold 없음 |
| 6 | 의존성 수동 업데이트 | 패치 지연 | dependabot/renovate 0건 |
| 7 | E2E 스킵 다수 | 테스트 커버리지 구멍 | 36개 test.skip, PLAYWRIGHT_BACKEND gate 6곳 |

## 목표

1. 오늘 같은 migration drift가 **CI에서 먼저 잡히도록** drift gate 설치 (Hotfix #53)
2. 워크플로우·캐시·버전을 **한 번에 재정렬**
3. 보안·관측성·의존성 자동화를 **최소 운영 비용**으로 도입
4. E2E를 **병렬화·다브라우저 matrix**로 확장

## 접근

- **Hotfix** (PR #53, 즉시 머지): phase-18.1 goose + drift gate + seed
- **Phase 18.7 본체** (Wave 4개, 7 PR)
  - Wave 1: 캐시·Makefile·SHA pinning
  - Wave 2: 커버리지·보안 스캔·SBOM
  - Wave 3: E2E shard·firefox matrix·flaky quarantine
  - Wave 4: Renovate

## PR 맵

| Wave | PR | 제목 |
|------|----|------|
| H | #53 | fix(ci): goose migration + drift gate for phase-18.1 real-backend |
| 1 | PR-1 | perf(ci): pnpm + Go + Docker 캐시 재정렬 |
| 1 | PR-2 | chore(repo): Makefile/Taskfile 정리 + SHA pinning + harden-runner |
| 2 | PR-3 | feat(ci): coverage upload + PR summary + regression guard |
| 2 | PR-4a | security(ci): govulncheck + gitleaks (fast feedback) |
| 2 | PR-4b | security(ci): trivy + osv-scanner + CodeQL (SARIF upload) |
| 2 | PR-5 | supply-chain(ci): SBOM + provenance attestation |
| 3 | PR-6 | test(e2e): shard + firefox matrix + skip 복원 |
| 4 | PR-7 | chore(deps): Renovate 설정 |

## 상세 문서

- [plan.md](./plan.md) — Wave별 작업 순서, 구현 지침
- [checklist.md](./checklist.md) — PR 단위 체크박스
- [refs/ci-matrix.md](./refs/ci-matrix.md) — 워크플로우별 역할·트리거 매트릭스
- [refs/security-stack.md](./refs/security-stack.md) — 보안 스캔 툴 스택 정당성

## Confirmed Decisions (2026-04-16)

- **Repo visibility: private** → Codecov `CODECOV_TOKEN` secret 등록 완료 (2026-04-16T10:27Z)
- **Hotfix 분리**: PR #53으로 즉시 머지, Phase 18.7과 병렬

## Out of Scope

- 커버리지 0% 도메인 테스트 작성 (Phase 18.8 후보: coin/creator/sound/voice/infra)
- `routes_editor_*.go` 통합 테스트 작성 (Phase 18.5 연장)
- `game-session-live.spec.ts` 재활성화 (Phase 18.1 Follow-up)
- LiveKit/voice E2E (인프라 전제 부족)

## Success Criteria

- nightly real-backend green 3회 연속
- PR CI 총 소요 시간 기존 대비 ≥30% 단축
- Security tab에 CodeQL + Trivy + osv 알림 3종 활성
- Codecov 뱃지 README에 표시, 리그레션 가드 -2%p 미만 enforce
- E2E shard=2 총 시간 40%+ 단축
- Renovate PR 24h 내 최소 1건 생성
