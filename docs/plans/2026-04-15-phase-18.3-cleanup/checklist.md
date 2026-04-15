<!-- STATUS-START -->
**Active**: Phase 18.3 보안 하드닝 + CI 정비 — Wave 2/2
**PR**: PR-4 (100%) — 완료
**Task**: 완료
**State**: completed
**Blockers**: none
**Last updated**: 2026-04-15
<!-- STATUS-END -->

# Phase 18.3 보안 하드닝 + CI 정비 체크리스트

> 부모: [design.md](design.md) | 실행: [plan.md](plan.md)

---

## Wave 0 — 보안 + CI 병렬 (parallel ×2)

### PR-0: Security hardening ✅
- [x] Task 1 — M-7 Recovery path redaction: persist 시점에 engine.BuildStateFor(playerID) 결과를 playerID 별 `session:{id}:snapshot:{playerID}` 로 저장 + SendSnapshot recovery path 가 player-specific 블롭 조회
- [x] Task 2 — M-a startModularGame 실패 시 cleanup: `cleanupOnStartFail(ctx, eng, logger)` helper 추가, 4개 실패 경로 모두 적용
- [x] Task 3 — M-e KindStop 와 엔딩 플로우: 분석 완료 — KindStop 은 host explicit 호출만. 코드 변경 불필요. refs/ending-flow.md 작성
- [x] Task 4 — L-2 persistSnapshot/deleteSnapshot/sendSnapshotFromCache ctx parent 를 `s.Ctx()` 로 변경
- [x] Task 5 — L-6 panic dump: `Interface("panic", r)` → `Str("panic", fmt.Sprint(r))` + debug 레벨 스택 분리 (hub.go notifyPlayerLeft/notifyPlayerRejoined)
- [x] Task 6 — L-7 모듈 에러 메시지 원문 노출 축소: starter.go BuildModules 에러 → generic "failed to initialise game modules"
- [x] Task 7 — 신규 단위 테스트: snapshot_pr0_test.go (M-7 per-player blobs, M-a cleanup/duplicate, L-2 ctx cancel propagation)

**PR-0 gate**:
- [x] `go test -race ./internal/session/... ./internal/engine/... ./internal/module/... ./internal/ws/...` pass
- [ ] PR merged to main (PR #40 open)

### PR-1: CI infra debt
- [ ] Task 1 — CI-1 `config.TestLoad_Defaults`: `os.Unsetenv` 으로 env 격리 + t.Setenv 로 명시 세팅, main CI 녹색
- [ ] Task 2 — CI-2 golangci-lint Go 1.25 호환: latest tag (혹은 supported 버전) 로 업데이트, Makefile/CI 스크립트 반영
- [ ] Task 3 — CI-3 ESLint 9 flat config: `eslint.config.js` 작성 + 기존 규칙 이식, `pnpm lint` 통과
- [ ] Task 4 — GH Actions: golangci-lint + eslint job 명시적 추가 (없으면)
- [ ] Task 5 — README/CONTRIBUTING 업데이트 (설치 명령어, 버전 명시)

**PR-1 gate**:
- [ ] `golangci-lint run` pass 로컬
- [ ] `pnpm lint` pass
- [ ] `go test -race ./internal/config/...` pass (env 독립)
- [ ] PR merged to main

---

## Wave 1 — 하이진 + E2E (parallel ×2)

### PR-2: Low hygiene batch
- [ ] Task 1 — L-3 `recentLeftAt` O(N) 선형 스캔: per-session sub-map 으로 전환 (`map[sessionID]map[playerID]time.Time`)
- [ ] Task 2 — L-4 snapshotKey 네임스페이스 prefix `mmp:session:` — 마이그레이션 경로 정의 (24h 후 기존 키 자연소멸)
- [ ] Task 3 — L-5 Hub.Stop 동시 writer 경합: 클라이언트 map 클리어 전에 stopping 플래그 설정 후 broadcast 루프가 플래그 체크
- [ ] Task 4 — 회귀 테스트

### PR-3: E2E stubbed-backend CI job
- [ ] Task 1 — L-8 Docker compose 서비스(Postgres+Redis+server stub) 를 CI 에서 기동
- [ ] Task 2 — `PLAYWRIGHT_BACKEND=1` 자동 세팅 → skip guard 대부분 동작, 핵심 3 시나리오 필수 실행
- [ ] Task 3 — nightly 뿐 아니라 PR 기본 CI job 에 포함 (optional → required)
- [ ] Task 4 — 시나리오: 방 생성→시작→페이즈 진행, 재접속 복원, redaction 확인

**Wave 1 gate**: Go + 프론트 + E2E 전부 pass + user confirm

---

## Wave 2 — 풀 회귀 + 문서 (sequential)

### PR-4: Regression + docs ✅
- [x] Task 1 — `go test -race -count=1 ./...` 풀 수트 (config 포함) green
- [x] Task 2 — `pnpm test` + `pnpm exec tsc --noEmit` + `pnpm lint` 전부 pass
- [x] Task 3 — `memory/project_phase183_progress.md` 작성 + MEMORY.md 갱신
- [x] Task 4 — `feedback_ci_infra_debt.md` 갱신 (해결 항목 체크)
- [ ] Task 5 — `/plan-finish` (사용자가 직접 실행)

**Wave 2 gate**: user 확인 + archive

---

## Phase completion gate

- [x] M-7/M-a/M-e 보안 3건 해결
- [x] Low 6건 (L-2~L-8) 해결
- [x] CI 부채 3건 해결
- [x] 풀 회귀 green
- [x] Memory 갱신
- [ ] `/plan-finish` 실행 (사용자 직접)
