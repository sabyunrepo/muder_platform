# PR-1 — fix(rooms): MaxPlayers optional + theme fallback

> 부모: [../plan.md](../plan.md)
> Wave: 1 (parallel) | 의존: - | 브랜치: `fix/rooms-maxplayers-optional`

---

## 목적

H7 해결: `CreateRoomRequest.MaxPlayers`가 `validate:"required"`라 FE가 생략하면 400. FE는 이미 `theme_id`만 보내도록 설계되어 있으므로 서버에서 optional 수용 + theme 기본값 fallback으로 정렬.

---

## Scope

```yaml
scope_globs:
  - apps/server/internal/domain/room/service.go
  - apps/server/internal/domain/room/handler.go
  - apps/server/internal/domain/room/handler_test.go
  - apps/server/internal/domain/room/service_test.go  # 신규
```

**변경 없음**: `db/migrations/**`, `db/queries/**`, FE 전부.

---

## Tasks

### Task 1 — Request 구조 변경
- `service.go:19-24` `CreateRoomRequest.MaxPlayers`를 `*int32`로 변경
- validate 태그 `required,min=2,max=12` → `omitempty,min=2,max=12`
- JSON 직렬화 확인: nil이면 `"max_players"` 필드 자체가 omit되도록 (or 안 보내면 nil)

### Task 2 — Service fallback 로직
- `service.go:129-187 CreateRoom`:
  1. `theme, err := s.themeRepo.GetByID(ctx, req.ThemeID)` 호출 (기존 있으면 재사용, 없으면 신규)
  2. `maxPlayers := theme.MaxPlayers` 기본값
  3. `if req.MaxPlayers != nil` → `maxPlayers = *req.MaxPlayers`
  4. 범위 검증: `theme.MinPlayers ≤ maxPlayers ≤ theme.MaxPlayers`
  5. 범위 밖이면 `AppError` VALIDATION_ERROR 반환
  6. `CreateRoomParams.MaxPlayers = maxPlayers`로 저장

### Task 3 — handler_test 확장
- 기존 케이스 유지
- 추가:
  - optional 생략 → 201 + fallback 적용 확인
  - 범위 밖 → 400 VALIDATION_ERROR

### Task 4 — service_test 테이블 테스트
- 신규 `service_test.go`:
  - min-1 → error
  - min → OK
  - max → OK
  - max+1 → error
  - nil → theme default

### Task 5 — after_task pipeline
- `go fmt ./apps/server/...`
- `go test -race -count=1 ./apps/server/internal/domain/room/...`
- scope 내 변경 파일 `wc -l` 500줄 이하 확인

---

## 핵심 파일 참조

| 파일 | 역할 |
|------|------|
| `service.go:19-24` | CreateRoomRequest struct |
| `service.go:129-187` | CreateRoom impl (theme 조회 추가) |
| `handler.go:28-47` | ReadJSON + validation (변경 없음) |
| `httputil/json.go:26-41` | validator 체인 (자동 omitempty 처리) |
| `db/migrations/00004_rooms.sql:8` | max_players NOT NULL (변경 없음) |

---

## 검증

- `curl -X POST localhost:8080/api/v1/rooms -H "Auth..." -d '{"theme_id":"<uuid>"}'` → 201 + `response.max_players == 8`
- `curl -X POST localhost:8080/api/v1/rooms -H "Auth..." -d '{"theme_id":"<uuid>", "max_players": 1}'` → 400
- 기존 E2E `game-session.spec.ts`에서 `NO_THEMES` 관련 skip 감소 확인 (수동)

---

## 리뷰 포인트

- 서버 로그에 `theme-fallback` info log 남기는지
- `room.max_players`는 여전히 NOT NULL (저장 시점엔 always 값)
- 기존 테스트 전부 green (subtractive 변경 없음)
