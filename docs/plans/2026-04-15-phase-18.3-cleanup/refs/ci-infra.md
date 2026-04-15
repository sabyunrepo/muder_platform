# Phase 18.3 — CI 인프라 부채 상세

## CI-1. `config.TestLoad_Defaults` env leak
- **File**: `apps/server/internal/config/config_test.go` (추정)
- **현상**: 로컬/CI 환경에 `CORS_ORIGINS`, `DATABASE_URL`, `GAME_RUNTIME_V2` 등이 export 되어 있으면 기본값 테스트가 실제 env 를 읽어 실패. `.github/workflows` 의 전역 env 설정 또는 shell profile 이 원인.
- **Fix**:
  - 테스트 시작 시 `t.Setenv("VAR", "")` 또는 관련 키 `os.Unsetenv`
  - 또는 `LoadConfig(WithEnv(map[string]string{}))` 주입형 API 도입
- **권장**: 후자. 순수 함수 테스트로 전환.

## CI-2. golangci-lint ↔ Go 1.25
- **현상**: 기존 `golangci-lint` 버전이 Go 1.25 파서 호환 안됨 — `make lint` 실패. 프로젝트 memory `feedback_ci_infra_debt.md` 참조.
- **Fix 후보**:
  - `golangci-lint v1.62+` (Go 1.25 지원 확인 필요)
  - 또는 `staticcheck + go vet + revive` 조합으로 대체
- **권장**: 최신 golangci-lint. 버전을 `.golangci.yml` 에 pin.
- **반영**: `Makefile`, `.github/workflows/ci.yml`, `README.md` 설치 가이드

## CI-3. ESLint 9 config
- **현상**: ESLint 9 는 `eslint.config.js` flat config 기본. 기존 `.eslintrc.*` 사용 중. `pnpm lint` 가 deprecation 경고 또는 실패.
- **Fix**: `apps/web/eslint.config.js` 신규 + 기존 규칙 이식 (React, TS, import, a11y)
- **주의**: 플러그인 호환 버전 체크 (`eslint-plugin-react-hooks`, `@typescript-eslint/*`)
- **분리**: config 작성 PR 과 rule migration PR 분리 권장 (diff 가 크면)

## 우선순위

1. CI-1 (env leak) — CI 안정화에 즉효
2. CI-2 (lint 복구) — 코드 리뷰 자동화 재개
3. CI-3 (ESLint 9) — 개발자 경고 제거

## 검증

- Local: `go test -race ./internal/config/...` + `golangci-lint run` + `cd apps/web && pnpm lint`
- CI: `.github/workflows/ci.yml` 에서 `test`, `lint-go`, `lint-web` job 분리 후 green 확인
