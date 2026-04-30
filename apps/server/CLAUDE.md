# apps/server — Go 백엔드 룰

> Go 1.25 + gorilla/websocket + sqlc + pgx + asynq + go-redis. PostgreSQL + Redis. zerolog.

# 카논 위치 (1룰 1 master)

## 이 파일이 master (Go 백엔드 한정)

### 계층 / DI / 로깅

- Handler → Service(인터페이스) → Repository/Provider(구현)
- DI: 생성자 주입 (수동, 프레임워크 없음)
- 로깅: `zerolog` 만 사용 (`log.Println` / `fmt.Println` 금지)

### 테스트 스택

- `mockgen` (go.uber.org/mock v0.6.0, Go 1.24 tool directive) + `testcontainers-go`
- 75%+ 커버리지 목표 (현재 enforcement gate 41%)
- 위치: `apps/server/internal/<pkg>/*_test.go`

### 개발 환경 시작 (dev compose)

```bash
HOST_UID=$(id -u) HOST_GID=$(id -g) \
  docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build
```

**왜 `HOST_UID`/`HOST_GID` 필요?** `Dockerfile.dev`가 ARG로 호스트 UID/GID 받아 매칭되는 non-root user(`appuser`) 생성. 미설정 시 fallback `1000:1000` → Mac dev (UID 501) 등에서 mismatch 시 호스트 bindmount(`apps/server/tmp/`) 권한 충돌.

**1회만 `--build` 필요** — Dockerfile.dev 변경 반영. 이후엔 생략 가능.

**`direnv` 사용 시** — `.envrc`에:
```bash
export HOST_UID=$(id -u)
export HOST_GID=$(id -g)
```
이후 `direnv allow` 1회로 자동 적용.

**호스트 포트 (dev compose)** — langfuse 등 다른 컨테이너 충돌 회피:
- postgres: `localhost:25432` / redis: `localhost:26379` / server: `localhost:8080`, `localhost:9090`

dev psql: `PGPASSWORD=mmp_dev psql -h localhost -p 25432 -U mmp -d mmf`

근거: `docs/superpowers/specs/2026-04-28-ci-infra-recovery-design.md`.

## 다른 곳이 master (pointer만)

| 룰 | master |
|----|--------|
| 파일/함수 크기 (Go 500줄 / 함수 80줄, sqlc/mockgen 자동생성 예외) | `memory/feedback_file_size_limit.md` |
| 모듈 시스템 (PlayerAware 의무, registry boot panic 강제 — F-sec-2 게이트) | `memory/project_module_system.md` |
| 에러 처리 (AppError + RFC 9457 Problem Details + 에러 코드 레지스트리) | `memory/project_error_system.md` |
| 코드 리뷰 패턴 (Go/DB/보안 — auditlog, 입력 검증, 비밀정보 redact) | `memory/feedback_code_review_patterns.md` |
| WS 인증 (`?token=` 쿼리 파라미터, Authorization 헤더 ❌) | `memory/feedback_ws_token_query.md` |
| 사용자 친화 설명 형식 (dev compose 등 운영 docs) | `memory/feedback_explanation_style.md` |
