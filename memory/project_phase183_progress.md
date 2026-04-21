---
name: Phase 18.3 완료 — 보안 하드닝 + CI 정비
description: Phase 18.3 전체 PR-0~PR-4 완료 요약. M-7/M-a/M-e + L-2~L-8 + CI-1/2/3 해결.
type: progress
---
## 개요

- **기간**: 2026-04-15 (Phase 18.2 직후)
- **목적**: Phase 18.0~18.2 누적 잔여 이슈 마무리
- **결과**: 4 PR 머지 + PR-4 문서화. 모든 보안/위생/CI 항목 해결.

## PR 요약

| PR | 브랜치 | 커밋 | 내용 |
|----|--------|------|------|
| PR-0 | feat/phase-18.3-cleanup/PR-0 | ce32ace | M-7/M-a/M-e + L-2/L-6/L-7 보안 하드닝 |
| PR-1 | feat/phase-18.3-cleanup/PR-1 | 33d2d72 | CI-1/2/3 — config env 격리 + golangci-lint v2 + ESLint 9 |
| PR-2 | feat/phase-18.3-cleanup/PR-2 | 38e1d47 | L-3/L-4/L-5 저수준 위생 수정 |
| PR-3 | feat/phase-18.3-cleanup/PR-3 | 5361a64 | L-8 E2E stubbed-backend CI job |
| PR-4 | feat/phase-18.3-cleanup/PR-4 | — | 풀 회귀 확인 + 메모리 갱신 |

## 해결된 Finding 목록

### Security / Reliability (M 등급)
- **M-7**: Recovery path redaction — `session:{id}:snapshot:{playerID}` per-player blob 저장
- **M-a**: startModularGame 실패 시 cleanup — `cleanupOnStartFail()` helper, 4개 실패 경로 적용
- **M-e**: KindStop vs 엔딩 플로우 분석 완료 — 코드 변경 불필요, `refs/ending-flow.md` 작성

### Low Hygiene (L 등급)
- **L-2**: persistSnapshot/deleteSnapshot/sendSnapshotFromCache ctx → `s.Ctx()` 변경
- **L-3**: `recentLeftAt` O(N) 스캔 → `map[sessionID]map[playerID]time.Time` per-session 서브맵
- **L-4**: snapshotKey prefix → `mmp:session:` 네임스페이스 (24h 자연소멸 마이그레이션)
- **L-5**: Hub.Stop 동시 writer 경합 — stopping 플래그 선설정 후 broadcast 루프 체크
- **L-6**: Panic dump 내부경로 → `fmt.Sprint(r)` + debug 레벨 스택 분리
- **L-7**: 모듈 에러 메시지 → generic "failed to initialise game modules"
- **L-8**: E2E CI job — Docker compose stub + `PLAYWRIGHT_BACKEND=1` + 핵심 3 시나리오 필수

### CI 인프라 (CI 등급)
- **CI-1**: `config.TestLoad_Defaults` env leak → `t.Setenv` + `cleanEnv` helper
- **CI-2**: golangci-lint Go 1.25 호환 → golangci-lint v2 (`golangci/golangci-lint-action@v6`)
- **CI-3**: ESLint 9 flat config → `apps/web/eslint.config.js` 생성

## 테스트 결과

### Go (풀 회귀, 2026-04-15)
- 커맨드: `go test -race -count=1 ./...`
- 결과: **37 패키지 전부 pass**, FAIL 없음
- 주요 패키지: apperror, config, session, engine, ws, eventbus, module/*, domain/*

### Frontend (Vitest, 2026-04-15)
- 커맨드: `pnpm vitest run`
- 결과: **934 pass / 19 fail** (97 test files 중 94 pass)
- 실패 2파일: Social.test.tsx (9건), ProfileForm.test.tsx (10건)
- **모두 pre-existing** — main 브랜치에서 동일하게 실패 확인 (mock export 누락, Phase 18.3 범위 외)
- TypeScript: `pnpm typecheck` pass
- ESLint: `pnpm lint` pass (CI-3 해결로 ESLint 9 flat config 적용)

## 커밋 해시 참조

- PR-0 merge: `ce32ace`
- PR-1 merge: `33d2d72`
- PR-2 merge: `38e1d47`
- PR-3 merge: `5361a64`
- PR-4: 본 PR (feat/phase-18.3-cleanup/PR-4)
