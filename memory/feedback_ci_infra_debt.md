---
name: CI 인프라 부채 (Phase 18.3에서 해결 완료)
description: 2026-04-08 기준 발견, 2026-04-15 Phase 18.3 PR-1에서 전부 해결.
type: feedback
originSessionId: 0a24815c-1878-4801-8c1c-2465d442d1b3
---
## ✅ 해결 완료 (Phase 18.3 PR-1, 커밋 33d2d72)

### [해결] Go Lint — golangci-lint Go 1.25 호환 (CI-2)

**증상** (해결 전):
```
Error: can't load config: the Go language version (go1.24) used to build
golangci-lint is lower than the targeted Go version (1.25.0)
```

**해결**: `golangci/golangci-lint-action@v6` + golangci-lint v2 로 업그레이드.
v2는 Go 1.25 toolchain 호환. CI workflow + Makefile 반영 완료.

---

### [해결] TypeScript Lint — ESLint 9 flat config (CI-3)

**증상** (해결 전):
```
ESLint: 9.39.4
ESLint couldn't find an eslint.config.(js|mjs|cjs) file.
```

**해결**: `apps/web/eslint.config.js` 생성 (ESLint 9 flat config).
기존 `.eslintrc.*` 규칙 이식 완료. `pnpm lint` pass 확인.

---

### [해결] config.TestLoad_Defaults env leak (CI-1)

**증상** (해결 전): `TestLoad_Defaults`가 테스트 환경 변수를 오염시켜
다른 테스트와 CI 환경에서 flaky 실패 발생.

**해결**: `t.Setenv` + `cleanEnv` helper로 env 격리.
`go test -race ./internal/config/...` pass 확인.

---

## 현재 상태

- CI-1, CI-2, CI-3 모두 해결 완료
- `go test -race -count=1 ./...` — 37 패키지 전부 green
- `pnpm lint` — ESLint 9 flat config 적용, pass
- `pnpm typecheck` — pass
- Frontend 19개 테스트 실패는 Social/Profile mock 누락 (Phase 18.3 범위 외, pre-existing)

## 잔여 이슈

없음. Phase 18.3에서 CI 인프라 부채 전부 해결.
