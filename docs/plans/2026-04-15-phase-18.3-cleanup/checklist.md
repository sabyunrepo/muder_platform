<!-- STATUS-START -->
**Active**: Phase 18.3 보안 하드닝 + CI 정비 — Wave 0/2
**PR**: PR-0 (0%)
**Task**: 시작 전
**State**: not_started
**Blockers**: none
**Last updated**: 2026-04-15
<!-- STATUS-END -->

# Phase 18.3 보안 하드닝 + CI 정비 체크리스트

> 부모: [design.md](design.md) | 실행: [plan.md](plan.md)

---

## Wave 0 — 보안 + CI 병렬 (parallel ×2)

### PR-0: Security hardening
- [ ] Task 1 — M-7 Recovery path redaction: persist 시점에 engine.BuildStateFor(playerID) 결과를 playerID 별 `session:{id}:snapshot:{playerID}` 로 저장 (또는 블롭에서 role/whisper/private_clue 키 제거) + SendSnapshot recovery path 가 player-specific 블롭 조회
- [ ] Task 2 — M-a startModularGame 실패 시 cleanup: bus.Close, modules Stop, adapter 해제 helper `cleanupOnStartFail` 추가
- [ ] Task 3 — M-e KindStop 와 엔딩 플로우: 엔딩 phase 종료 → snapshot 필요성 검토, 필요 시 WS 이벤트 기반 final state broadcast 로 대체, 문서화
- [ ] Task 4 — L-2 persistSnapshot/SendSnapshot/deleteSnapshot ctx parent 를 `s.Ctx()` 로 변경
- [ ] Task 5 — L-6 panic dump: `Interface("panic", r)` → `Str("panic", fmt.Sprint(r))` + 스택을 debug 레벨로 분리
- [ ] Task 6 — L-7 모듈 에러 메시지 원문 노출 축소: `starter.go` 에서 에러 wrapping 시 내부 경로 제거, 호스트 facing 은 generic + 로그에만 상세
- [ ] Task 7 — 신규 단위 테스트 (redaction recovery path, cleanup 검증, ending 경로, ctx parent)
- [ ] Run after_task pipeline per task

**PR-0 gate**:
- [ ] `go test -race ./internal/session/... ./internal/engine/... ./internal/module/... ./internal/ws/...` pass
- [ ] PR merged to main

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

### PR-4: Regression + docs
- [ ] Task 1 — `go test -race -count=1 ./...` 풀 수트 (config 포함) green
- [ ] Task 2 — `pnpm test` + `pnpm exec tsc --noEmit` + `pnpm lint` 전부 pass
- [ ] Task 3 — `memory/project_phase183_progress.md` 작성 + MEMORY.md 갱신
- [ ] Task 4 — `feedback_ci_infra_debt.md` 갱신 (해결 항목 체크)
- [ ] Task 5 — `/plan-finish`

**Wave 2 gate**: user 확인 + archive

---

## Phase completion gate

- [ ] M-7/M-a/M-e 보안 3건 해결
- [ ] Low 6건 (L-2~L-8) 해결
- [ ] CI 부채 3건 해결
- [ ] 풀 회귀 green
- [ ] Memory 갱신
- [ ] `/plan-finish` 실행
