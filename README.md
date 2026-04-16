# Murder Mystery Platform (MMP v3)

[![codecov](https://codecov.io/gh/sabyunrepo/muder_platform/branch/main/graph/badge.svg)](https://codecov.io/gh/sabyunrepo/muder_platform)
[![Renovate enabled](https://img.shields.io/badge/renovate-enabled-brightgreen?logo=renovatebot)](https://github.com/sabyunrepo/muder_platform/issues?q=is%3Aissue+renovate)

다중 테마 실시간 멀티플레이어 머더미스터리 게임 플랫폼 — v3 리빌드.

## 기술 스택
- **Backend**: Go 1.25 + gorilla/websocket + sqlc + pgx + asynq + go-redis
- **Frontend**: React 19 + Vite (SPA) + Zustand + Tailwind CSS 4
- **Mobile**: Expo (React Native)
- **DB**: PostgreSQL + Redis
- **Voice**: LiveKit
- **Infra**: Docker (scratch) + K8s + Cloudflare Pages + GitHub Actions

## 개발

자세한 개발 가이드는 [CLAUDE.md](./CLAUDE.md)와 `docs/plans/` 설계 문서를 참조.

### 로컬 실행
```bash
pnpm install
make dev
```

### 테스트
```bash
# Go
cd apps/server && go test -race -coverprofile=coverage.out ./...

# Frontend (Vitest + coverage)
pnpm --filter @mmp/web test:coverage
```

## 커버리지

- Codecov 대시보드: https://codecov.io/gh/sabyunrepo/muder_platform
- 백엔드 flag: `backend` (Go `coverage.out`)
- 프론트엔드 flag: `frontend` (Vitest `coverage-final.json`)
- 회귀 가드는 2026-05-28까지 **warn-only**, 이후 enforcement 별도 PR 예정.

> Badge token이 필요하면 codecov.io 대시보드에서 graph token을 복사해 위 badge URL에 `?token=<TOKEN>` 쿼리를 추가.
