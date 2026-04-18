# PR-4 Execution Plan — Wave 3 착수 순서 · 리스크 · 테스트

## 1. Wave 배치 (backlog 확정)

```
Wave 0 → PR-0 (memory migration)
Wave 1 → PR-1 (WS Contract SSOT) + PR-3 (HTTP Error Standard) + PR-6 (Auditlog)
Wave 2 → PR-2a/2b/2c (PlayerAware) + PR-5 (Coverage Gate) + PR-7 (Zustand Unification)
Wave 3 → PR-4a (Go split) ∥ PR-4b (TS split) + PR-8 (Module Cache Isolation)
```

PR-4a 와 PR-4b 는 파일셋 disjoint 이므로 Wave 3 내 **병렬 실행**. PR-7 머지 후 PR-4b 착수하면 GameChat 상태 이동이 smooth.

## 2. PR-4a vs PR-4b 선후 판단

| 선행 후보 | 근거 |
|-----------|------|
| **PR-4a 먼저** (Go) | Wave 2 PR-2 의 module 파일을 직접 건드림. PR-2a 머지 후 diff noise 최소화 위해 빠르게 이어 착수. |
| **PR-4b 먼저** (TS) | PR-7 (Zustand Action Unification) 완료 후 GameChat 상태 이동 반영 용이. 단 PR-7 이 Wave 2 에 머지된다면 Wave 3 초입엔 이미 준비 완료. |

**권장**: Wave 3 시작일에 PR-4a 와 PR-4b 를 **동시 병렬 실행** (worktree 분리). 일정상 작업자 1명이면 PR-4a 선행 (리뷰어 Go domain 우선 확보 용이).

## 3. Git 워크플로우

- 브랜치: `refactor/phase-19-pr-4a-go-split`, `refactor/phase-19-pr-4b-ts-split`
- 커밋 단위: pr-4a-go-split.md §5 (11 커밋) + pr-4b-ts-split.md §5 (4 커밋)
- PR 제목:
  - `refactor(phase-19): PR-4a — Go 모듈·인프라 9 파일 분할 (F-go-3/4)`
  - `refactor(phase-19): PR-4b — TS editor/api · GameChat · FriendsList 분할 (F-react-1/3/4)`
- 하나의 PR 당 main 머지 전 **사용자 확인 1회** 필수 (Wave 3 Gate 에 포함).

## 4. 테스트 전략

### 4.1 PR-4a (Go)

| 수준 | 스위트 | Gate |
|------|-------|------|
| Unit | `go test ./apps/server/internal/module/...` | 전 모듈 기존 테스트 100% pass (리팩터 불변식) |
| Unit | `go test ./apps/server/internal/ws/...` | Hub broadcast / lifecycle / reconnect 기존 테스트 pass |
| Unit | `go test ./apps/server/internal/domain/social/...` + `domain/editor/...` | 기존 service test 분할 후 pass |
| Integration | `go test -tags=integration ./apps/server/...` (testcontainers) | registry.Register 호출 검증 |
| Lint | `golangci-lint run ./apps/server/...` | file size rule (있다면) 통과 |
| 신규 테스트 | `registry_test.go`: `TestRegistry_AllCoreModulesRegistered` — 29개 모듈 이름이 registry 에 등록되었는지 검증 (blank import 누락 탐지) | 신규 추가, **PR-4a 필수** |

### 4.2 PR-4b (TS)

| 수준 | 스위트 | Gate |
|------|-------|------|
| Unit | `pnpm test` (Vitest) | 기존 GameChat/FriendsList/api 테스트 pass |
| Type | `pnpm typecheck` | import path 변경 반영 |
| Lint | `pnpm lint` | no-unused-imports / no-cycle 통과 |
| Build | `pnpm build` | tree-shake 후 bundle size ≤ baseline+3% |
| E2E | `pnpm test:e2e` (Playwright, 에디터 + 게임 + 소셜 플로우) | 기존 시나리오 pass |

### 4.3 mmp-test-strategy 반영

- mockgen / testcontainers-go 기존 패턴 유지 (PR-4a 는 package 경로 변경만)
- MSW handler 경로 변경 없음 (PR-4b 배럴 유지)
- 커버리지 리포트: PR-4 전후 `go tool cover` 동일성 ± 0.5%p 유지

## 5. 리스크 · 완화 매트릭스

| ID | 리스크 | 영향 | 완화 |
|----|-------|------|------|
| R1 | 모듈 디렉터리 승격 시 `package xxx_test` black-box 테스트 package 이름 누락 | CI 빨강 | 각 sub-package 생성 시 test 파일 package 선언 grep 으로 사전 확인 |
| R2 | blank import 경로 갱신 누락 → 런타임 `engine.Register` 미호출 → "unknown module" 500 | 프로덕션 장애 | `registry_test.go` TestRegistry_AllCoreModulesRegistered 신규 추가. cmd/server/main.go 변경 시 `go vet` import 경로 전수 검증 |
| R3 | TS 배럴로 tree-shake 저해, bundle size 증가 | 번들 크기 | vite build analyze 전후 비교. 배럴은 hook re-export 만, type-only re-export 사용 |
| R4 | accusation tally.go 함수 추출 시 lock 경계 누락 → 데이터 레이스 | 게임 로직 버그 | `handleAccusationVote` 의 mu.Lock 보유 범위를 tallyVotes 호출 이전으로 한정. race detector `go test -race` 필수 |
| R5 | GameChat 파일 분할로 `useWsEvent` 구독이 탭 컴포넌트 unmount 시 leak | 메모리 누수 | useChatMessages hook 을 shell(index.tsx) 에서만 사용. 탭 컴포넌트는 구독 없음 |
| R6 | Phase 20 또는 다른 feature PR 과 git conflict | 리뷰 지연 | Wave 3 시작 직후 PR 생성, conflict 발생 시 rebase + 커밋 단위 cherry-pick |

## 6. Finding 해소 매핑 (최종)

| Finding | PR | 해소 방식 | Acceptance |
|---------|:--:|---------|-----------|
| **F-go-3 500+ 10건 (P1)** | PR-4a | 6 모듈 디렉터리 승격 + 3 인프라 분할. 수동 500+ 파일 0건 수렴 (sqlc · 테스트 파일 제외) | `find apps/server -name '*.go' -not -name '*_test.go' -not -path '*/db/sqlc/*' | xargs wc -l | awk '$1>500'` empty |
| **F-go-4 함수 80+ 6건 중 1건 (P1)** | PR-4a | `accusation.handleAccusationVote` 101줄 → 60줄 + `tallyVotes` 40줄 (tally.go) | gocyclo / funlen ≤ 80 linter pass |
| **F-react-1 GameChat state 이중 (P1)** | PR-4b (partial) | 파일 분할만 이번 PR, state 모델은 PR-7 에서 완결 | GameChat shell 150줄 이하 |
| **F-react-3 editor/api.ts 423 (P1)** | PR-4b | api/ 디렉터리 + 배럴 + sub-files | 파일 400+ 0건 |
| **F-react-4 FriendsList 415 (P1)** | PR-4b | FriendsList/ 디렉터리 + 탭 컴포넌트 추출 | 파일 400+ 0건, 컴포넌트 150+ 0건 |

## 7. 후속 작업 (PR-4 merge 후)

1. **ESLint rule 활성화**: file-size · function-size (Biome 기반), 400/150/60 한도 강제 → CI gate 로 재발 방지. 별도 PR.
2. **sibling 파일 통합** (features/editor/): `editorClueApi`, `editorMapApi`, `flowApi`, `readingApi`, `mediaApi`, `templateApi`, `imageApi`, `editorConfigApi`, `clueEdgeApi` 를 `api/` 디렉터리로 마이그레이션 → F-react-3 완전 해소. Phase 20 이후 기술 부채 PR 로.
3. **module-architect 리뷰**: 각 모듈 디렉터리 승격 후 `Factory 독립성 테스트` + `PhaseReactor 순서 테스트` 확장 (mmp-test-strategy 스킬 → test-engineer 요청). Phase 20 착수 전 1회.
4. **docs-navigator 인덱싱**: `docs/plans/2026-04-05-rebuild/module-spec.md` 의 모듈 경로 예시 업데이트 필요 여부 확인 (module-spec 은 이름 기반이므로 영향 low 예상). 갱신 시 QMD reindex.

## 8. 진척도 tracker (체크리스트)

- [ ] PR-4a Wave 3 착수 가능 시점: Wave 2 (PR-2a/b/c + PR-7) 전부 main 머지 후
- [ ] Go-backend-engineer 에 Factory 서명 리뷰 요청 완료 (module-architect → go-backend-engineer)
- [ ] Test-engineer 에 "모듈 Factory 독립성 테스트 + PhaseReactor 순서 테스트" 요청 완료
- [ ] React-frontend-engineer 에 "ConfigSchema → 에디터 UI 매핑" 영향도 조회 완료 (schema 파일 이동 여부)
- [ ] `registry_test.go` TestRegistry_AllCoreModulesRegistered 작성
- [ ] bundle size baseline 측정 (PR-4b 착수 전)
- [ ] PR-4a / PR-4b PR 생성 + 사용자 승인
- [ ] main 머지 후 `find ... | awk '$1>500'` / `awk '$1>400'` 0건 확인
- [ ] MEMORY.md `project_phase19_audit_progress.md` 에 Finding 해소 기록
