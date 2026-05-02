# apps/server - Go 백엔드 규칙

Go 1.25 + gorilla/websocket + sqlc + pgx + asynq + go-redis. PostgreSQL + Redis. `zerolog`.

이 파일은 기존 `apps/server/CLAUDE.md`를 Codex용으로 이전한 지시문이다. Codex가 따라야 할 백엔드 규칙은 이 파일을 우선 갱신한다.

## 기본 소통 언어

- 사용자-facing 설명, 작업 보고, 운영 문서는 기본적으로 한국어로 작성한다.
- 비전문가도 이해할 수 있게 작성한다. 백엔드, DB, 인프라 용어는 처음 등장할 때 쉬운 말로 풀어쓰고, 사용자/운영 관점의 영향을 함께 설명한다.
- 코드 식별자, 로그, 에러 메시지, 명령어는 원문을 유지한다.

## 백엔드 카논

- 계층 구조: Handler -> Service interface -> Repository/Provider implementation.
- 의존성 주입: 생성자 주입을 사용하며 DI 프레임워크는 쓰지 않는다.
- 로깅: `zerolog`만 사용한다. `log.Println` 또는 `fmt.Println`은 사용하지 않는다.
- 테스트: `mockgen` (`go.uber.org/mock` v0.6.0, Go 1.24 tool directive) + `testcontainers-go`.
- 커버리지 목표: 75%+. 현재 enforcement gate가 더 낮아도 gate를 낮추지 않는다.
- 테스트 위치: `apps/server/internal/<pkg>/*_test.go`.

## Dev Compose

```bash
HOST_UID=$(id -u) HOST_GID=$(id -g) \
  docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build
```

- `HOST_UID`와 `HOST_GID`가 필요한 이유: `Dockerfile.dev`가 호스트 UID/GID와 맞는 non-root `appuser`를 만들기 때문이다.
- 값이 없으면 fallback `1000:1000`이 사용되고, macOS 호스트 UID 501 환경에서는 `apps/server/tmp/` bindmount 권한 충돌이 날 수 있다.
- `--build`는 Dockerfile/dev image 변경 후에만 필요하다.
- `direnv`를 쓰면 `.envrc`에 export를 추가하고 `direnv allow`를 한 번 실행한다.

개발 포트:

- PostgreSQL: `localhost:25432`
- Redis: `localhost:26379`
- Server: `localhost:8080`, `localhost:9090`

개발용 psql:

```bash
PGPASSWORD=mmp_dev psql -h localhost -p 25432 -U mmp -d mmf
```

근거: `docs/superpowers/specs/2026-04-28-ci-infra-recovery-design.md`.

## 백엔드 포인터

| 규칙 | Master |
| ---- | ------ |
| 파일/함수 크기: Go 500줄, 함수 80줄. sqlc/mockgen 생성 파일은 예외 | `memory/feedback_file_size_limit.md` |
| 모듈 시스템: PlayerAware 필수, registry boot panic gate | `memory/project_module_system.md` |
| 에러: AppError + RFC 9457 Problem Details + 에러 코드 레지스트리 | `memory/project_error_system.md` |
| 리뷰 패턴: Go/DB/보안, audit log, validation, secret redaction | `memory/feedback_code_review_patterns.md` |
| WebSocket 인증: Authorization header가 아니라 `?token=` 쿼리 파라미터 사용 | `memory/feedback_ws_token_query.md` |
| 사용자 친화 운영 문서 스타일 | `memory/feedback_explanation_style.md` |
