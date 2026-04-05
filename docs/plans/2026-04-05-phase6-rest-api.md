# Phase 6: REST API Domain Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 7개 도메인(auth, room, theme, editor, profile, admin)의 REST API Handler → Service → Repository 계층 구현 + JWT 인증 미들웨어 + OpenAPI spec

**Architecture:** Chi 라우터 그룹으로 `/api/v1/` prefix. 각 도메인은 `internal/domain/{name}/` 패키지에 service.go(인터페이스+구현), handler.go(HTTP), handler_test.go 구조. JWT 미들웨어는 `internal/middleware/auth.go`. JSON 헬퍼는 `internal/httputil/`. main.go에서 DI 조립 + 라우트 등록.

**Tech Stack:** Go 1.25, chi/v5, sqlc/pgx, go-redis, golang-jwt/jwt/v5, go-playground/validator/v10

**Dependency:** go.mod에 `golang-jwt/jwt/v5`, `go-playground/validator/v10` 추가 필요

---

## Task 0: 공유 인프라 (httputil + JWT middleware + validator)

**Files:**
- Create: `apps/server/internal/httputil/json.go`
- Create: `apps/server/internal/httputil/pagination.go`
- Create: `apps/server/internal/middleware/auth.go`
- Create: `apps/server/internal/middleware/auth_test.go`
- Modify: `apps/server/go.mod` (jwt, validator 의존성)

### 설계

**httputil/json.go** — 모든 핸들러가 공유하는 JSON 읽기/쓰기 헬퍼:
```go
package httputil

import (
    "encoding/json"
    "net/http"

    "github.com/mmp-platform/server/internal/apperror"
)

// WriteJSON writes a JSON response with the given status code.
func WriteJSON(w http.ResponseWriter, status int, v any) {
    w.Header().Set("Content-Type", "application/json")
    w.WriteHeader(status)
    json.NewEncoder(w).Encode(v)
}

// ReadJSON reads and validates a JSON request body into dst.
func ReadJSON(r *http.Request, dst any) error {
    if r.Body == nil {
        return apperror.BadRequest("request body is required")
    }
    dec := json.NewDecoder(r.Body)
    dec.DisallowUnknownFields()
    if err := dec.Decode(dst); err != nil {
        return apperror.BadRequest("invalid JSON: " + err.Error())
    }
    return nil
}
```

**httputil/pagination.go** — 커서/오프셋 페이지네이션:
```go
package httputil

import (
    "net/http"
    "strconv"
)

type Pagination struct {
    Limit  int32
    Offset int32
}

func ParsePagination(r *http.Request, defaultLimit, maxLimit int32) Pagination {
    limit := defaultLimit
    offset := int32(0)
    if v := r.URL.Query().Get("limit"); v != "" {
        if n, err := strconv.Atoi(v); err == nil && n > 0 {
            limit = int32(min(n, int(maxLimit)))
        }
    }
    if v := r.URL.Query().Get("offset"); v != "" {
        if n, err := strconv.Atoi(v); err == nil && n >= 0 {
            offset = int32(n)
        }
    }
    return Pagination{Limit: limit, Offset: offset}
}
```

**middleware/auth.go** — JWT Access Token 검증 미들웨어:
```go
package middleware

import (
    "context"
    "net/http"
    "strings"

    "github.com/golang-jwt/jwt/v5"
    "github.com/google/uuid"
    "github.com/mmp-platform/server/internal/apperror"
)

type contextKey string
const UserIDKey contextKey = "userID"
const UserRoleKey contextKey = "userRole"

type JWTConfig struct {
    Secret []byte
}

// Auth returns middleware that validates JWT and sets userID+role in context.
func Auth(cfg JWTConfig) func(http.Handler) http.Handler {
    return func(next http.Handler) http.Handler {
        return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
            header := r.Header.Get("Authorization")
            if header == "" {
                apperror.WriteError(w, r, apperror.Unauthorized("missing authorization header"))
                return
            }
            tokenStr := strings.TrimPrefix(header, "Bearer ")
            if tokenStr == header {
                apperror.WriteError(w, r, apperror.Unauthorized("invalid authorization format"))
                return
            }

            token, err := jwt.Parse(tokenStr, func(t *jwt.Token) (any, error) {
                if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
                    return nil, apperror.Unauthorized("unexpected signing method")
                }
                return cfg.Secret, nil
            })
            if err != nil || !token.Valid {
                apperror.WriteError(w, r, apperror.New(apperror.ErrAuthTokenInvalid, http.StatusUnauthorized, "invalid or expired token"))
                return
            }

            claims, ok := token.Claims.(jwt.MapClaims)
            if !ok {
                apperror.WriteError(w, r, apperror.Unauthorized("invalid token claims"))
                return
            }

            sub, _ := claims.GetSubject()
            userID, err := uuid.Parse(sub)
            if err != nil {
                apperror.WriteError(w, r, apperror.Unauthorized("invalid user ID in token"))
                return
            }

            role, _ := claims["role"].(string)
            if role == "" {
                role = "PLAYER"
            }

            ctx := context.WithValue(r.Context(), UserIDKey, userID)
            ctx = context.WithValue(ctx, UserRoleKey, role)
            next.ServeHTTP(w, r.WithContext(ctx))
        })
    }
}

// UserIDFrom extracts the user ID from the request context.
func UserIDFrom(ctx context.Context) uuid.UUID {
    id, _ := ctx.Value(UserIDKey).(uuid.UUID)
    return id
}

// UserRoleFrom extracts the user role from the request context.
func UserRoleFrom(ctx context.Context) string {
    role, _ := ctx.Value(UserRoleKey).(string)
    return role
}

// RequireRole returns middleware that checks the user has the required role.
func RequireRole(roles ...string) func(http.Handler) http.Handler {
    roleSet := make(map[string]bool, len(roles))
    for _, r := range roles {
        roleSet[r] = true
    }
    return func(next http.Handler) http.Handler {
        return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
            role := UserRoleFrom(r.Context())
            if !roleSet[role] {
                apperror.WriteError(w, r, apperror.Forbidden("insufficient permissions"))
                return
            }
            next.ServeHTTP(w, r.WithContext(r.Context()))
        })
    }
}
```

### Step 1: go mod에 jwt, validator 의존성 추가
```bash
cd apps/server && go get github.com/golang-jwt/jwt/v5 github.com/go-playground/validator/v10
```

### Step 2: httputil 패키지 생성 (json.go, pagination.go)

### Step 3: JWT auth middleware + RequireRole 작성

### Step 4: auth middleware 단위 테스트 (유효 토큰, 만료 토큰, 없는 토큰, 잘못된 형식)

### Step 5: 커밋
```bash
git add -A && git commit -m "feat(phase6): add httputil, JWT auth middleware, RequireRole"
```

---

## Task 1: Auth 도메인 (OAuth + JWT 발급 + Refresh)

**Files:**
- Create: `apps/server/internal/domain/auth/service.go`
- Create: `apps/server/internal/domain/auth/handler.go`
- Create: `apps/server/internal/domain/auth/handler_test.go`
- Create: `apps/server/internal/domain/auth/token.go`

### 설계

**service.go** — AuthService 인터페이스:
```go
type AuthService interface {
    // OAuthCallback exchanges code for user, creates/finds user, returns tokens
    OAuthCallback(ctx context.Context, provider, code string) (*TokenPair, error)
    // RefreshToken validates refresh token and returns new token pair
    RefreshToken(ctx context.Context, refreshToken string) (*TokenPair, error)
    // Logout invalidates refresh token
    Logout(ctx context.Context, userID uuid.UUID) error
}

type TokenPair struct {
    AccessToken  string `json:"access_token"`
    RefreshToken string `json:"refresh_token"`
    ExpiresIn    int    `json:"expires_in"`
}
```

**token.go** — JWT 생성/검증 유틸리티:
- `GenerateAccessToken(userID uuid.UUID, role string, secret []byte) (string, error)` — 15분 만료
- `GenerateRefreshToken(userID uuid.UUID, secret []byte) (string, error)` — 30일 만료
- Refresh token은 Redis에 저장 (rotation: 이전 토큰 무효화)

**handler.go** — HTTP 엔드포인트:
```
POST /api/v1/auth/callback     — OAuth 콜백 (provider, code)
POST /api/v1/auth/refresh      — Refresh token rotation
POST /api/v1/auth/logout       — 로그아웃 (인증 필요)
GET  /api/v1/auth/me           — 현재 유저 정보 (인증 필요)
```

### 핵심 로직
1. OAuth callback: provider별 토큰 교환 → 유저 정보 → DB upsert → JWT pair 발급
2. Refresh: Redis에서 refresh token 검증 → 새 pair 발급 → 이전 토큰 삭제 (rotation)
3. Family attack 방어: refresh token 재사용 감지 시 해당 유저의 모든 refresh token 삭제

### Step 1: token.go — JWT 생성 함수 + 테스트
### Step 2: service.go — AuthService 인터페이스 + 구현체
### Step 3: handler.go — 4개 엔드포인트
### Step 4: handler_test.go — httptest로 각 엔드포인트 테스트
### Step 5: 커밋
```bash
git commit -m "feat(phase6): add auth domain (OAuth callback, JWT, refresh rotation)"
```

---

## Task 2: Profile 도메인

**Files:**
- Create: `apps/server/internal/domain/profile/service.go`
- Create: `apps/server/internal/domain/profile/handler.go`
- Create: `apps/server/internal/domain/profile/handler_test.go`

### 설계

**service.go:**
```go
type ProfileService interface {
    GetProfile(ctx context.Context, userID uuid.UUID) (*ProfileResponse, error)
    UpdateProfile(ctx context.Context, userID uuid.UUID, req UpdateProfileRequest) (*ProfileResponse, error)
}

type ProfileResponse struct {
    ID        uuid.UUID `json:"id"`
    Nickname  string    `json:"nickname"`
    Email     *string   `json:"email,omitempty"`
    AvatarURL *string   `json:"avatar_url,omitempty"`
    Role      string    `json:"role"`
    Balance   int64     `json:"coin_balance"`
}

type UpdateProfileRequest struct {
    Nickname  string  `json:"nickname" validate:"required,min=2,max=20"`
    AvatarURL *string `json:"avatar_url" validate:"omitempty,url"`
}
```

**handler.go:**
```
GET    /api/v1/profile          — 내 프로필 (인증)
PUT    /api/v1/profile          — 프로필 수정 (인증)
GET    /api/v1/users/:id        — 공개 프로필 조회
```

### Step 1: service.go 인터페이스 + 구현 (db.Queries 주입)
### Step 2: handler.go + 라우트
### Step 3: handler_test.go
### Step 4: 커밋
```bash
git commit -m "feat(phase6): add profile domain (get, update, public view)"
```

---

## Task 3: Room 도메인

**Files:**
- Create: `apps/server/internal/domain/room/service.go`
- Create: `apps/server/internal/domain/room/handler.go`
- Create: `apps/server/internal/domain/room/handler_test.go`

### 설계

**service.go:**
```go
type RoomService interface {
    CreateRoom(ctx context.Context, hostID uuid.UUID, req CreateRoomRequest) (*RoomResponse, error)
    GetRoom(ctx context.Context, roomID uuid.UUID) (*RoomDetailResponse, error)
    GetRoomByCode(ctx context.Context, code string) (*RoomDetailResponse, error)
    ListWaitingRooms(ctx context.Context, limit, offset int32) ([]RoomResponse, error)
    JoinRoom(ctx context.Context, roomID, userID uuid.UUID) error
    LeaveRoom(ctx context.Context, roomID, userID uuid.UUID) error
}

type CreateRoomRequest struct {
    ThemeID    uuid.UUID `json:"theme_id" validate:"required"`
    MaxPlayers int32     `json:"max_players" validate:"required,min=2,max=12"`
    IsPrivate  bool      `json:"is_private"`
}
```

**handler.go:**
```
POST   /api/v1/rooms            — 방 생성 (인증)
GET    /api/v1/rooms            — 대기 방 목록
GET    /api/v1/rooms/:id        — 방 상세
GET    /api/v1/rooms/code/:code — 코드로 방 조회
POST   /api/v1/rooms/:id/join   — 방 참가 (인증)
POST   /api/v1/rooms/:id/leave  — 방 나가기 (인증)
```

### 핵심 로직
- 방 코드: 6자리 랜덤 영문+숫자 생성 (crypto/rand)
- JoinRoom: 인원 초과 체크, 이미 참가 체크
- LeaveRoom: 호스트가 나가면 방 삭제 or 호스트 이전

### Step 1: service.go
### Step 2: handler.go
### Step 3: handler_test.go
### Step 4: 커밋
```bash
git commit -m "feat(phase6): add room domain (create, join, leave, list)"
```

---

## Task 4: Theme 도메인 (공개 API)

**Files:**
- Create: `apps/server/internal/domain/theme/service.go`
- Create: `apps/server/internal/domain/theme/handler.go`
- Create: `apps/server/internal/domain/theme/handler_test.go`

### 설계

**service.go:**
```go
type ThemeService interface {
    GetTheme(ctx context.Context, themeID uuid.UUID) (*ThemeResponse, error)
    GetThemeBySlug(ctx context.Context, slug string) (*ThemeResponse, error)
    ListPublished(ctx context.Context, limit, offset int32) ([]ThemeSummary, error)
    GetCharacters(ctx context.Context, themeID uuid.UUID) ([]CharacterResponse, error)
}
```

**handler.go:**
```
GET    /api/v1/themes           — 출판된 테마 목록
GET    /api/v1/themes/:id       — 테마 상세
GET    /api/v1/themes/slug/:slug — slug로 조회
GET    /api/v1/themes/:id/characters — 캐릭터 목록
```

### Step 1~4: service → handler → test → 커밋
```bash
git commit -m "feat(phase6): add theme domain (public listing, detail, characters)"
```

---

## Task 5: Editor 도메인 (제작자 API)

**Files:**
- Create: `apps/server/internal/domain/editor/service.go`
- Create: `apps/server/internal/domain/editor/handler.go`
- Create: `apps/server/internal/domain/editor/handler_test.go`

### 설계

**service.go:**
```go
type EditorService interface {
    // Theme CRUD (creator only)
    CreateTheme(ctx context.Context, creatorID uuid.UUID, req CreateThemeRequest) (*ThemeResponse, error)
    UpdateTheme(ctx context.Context, creatorID, themeID uuid.UUID, req UpdateThemeRequest) (*ThemeResponse, error)
    DeleteTheme(ctx context.Context, creatorID, themeID uuid.UUID) error
    ListMyThemes(ctx context.Context, creatorID uuid.UUID) ([]ThemeSummary, error)
    // Publish workflow
    PublishTheme(ctx context.Context, creatorID, themeID uuid.UUID) (*ThemeResponse, error)
    UnpublishTheme(ctx context.Context, creatorID, themeID uuid.UUID) (*ThemeResponse, error)
    // Character CRUD
    CreateCharacter(ctx context.Context, creatorID, themeID uuid.UUID, req CreateCharacterRequest) (*CharacterResponse, error)
    UpdateCharacter(ctx context.Context, creatorID, charID uuid.UUID, req UpdateCharacterRequest) (*CharacterResponse, error)
    DeleteCharacter(ctx context.Context, creatorID, charID uuid.UUID) error
    // ConfigJson
    UpdateConfigJson(ctx context.Context, creatorID, themeID uuid.UUID, config json.RawMessage) error
}
```

**handler.go:**
```
GET    /api/v1/editor/themes             — 내 테마 목록 (인증+CREATOR)
POST   /api/v1/editor/themes             — 테마 생성
PUT    /api/v1/editor/themes/:id         — 테마 수정
DELETE /api/v1/editor/themes/:id         — 테마 삭제
POST   /api/v1/editor/themes/:id/publish — 출판
POST   /api/v1/editor/themes/:id/unpublish — 출판 취소
POST   /api/v1/editor/themes/:id/characters     — 캐릭터 추가
PUT    /api/v1/editor/characters/:id             — 캐릭터 수정
DELETE /api/v1/editor/characters/:id             — 캐릭터 삭제
PUT    /api/v1/editor/themes/:id/config          — configJson 수정
```

### 핵심 로직
- 모든 변경: creatorID == theme.CreatorID 검증 (resource-based auth)
- PublishTheme: 최소 검증 (캐릭터 수 >= minPlayers, configJson 존재)
- Slug: title에서 자동 생성 (한글 → romanize or hash)

### Step 1~4: service → handler → test → 커밋
```bash
git commit -m "feat(phase6): add editor domain (theme/character CRUD, publish workflow)"
```

---

## Task 6: Admin 도메인

**Files:**
- Create: `apps/server/internal/domain/admin/service.go`
- Create: `apps/server/internal/domain/admin/handler.go`
- Create: `apps/server/internal/domain/admin/handler_test.go`

### 설계

**service.go:**
```go
type AdminService interface {
    ListUsers(ctx context.Context, limit, offset int32) ([]UserSummary, error)
    UpdateUserRole(ctx context.Context, userID uuid.UUID, role string) error
    ListAllThemes(ctx context.Context, limit, offset int32) ([]ThemeSummary, error)
    ForceUnpublishTheme(ctx context.Context, themeID uuid.UUID) error
    ListAllRooms(ctx context.Context, limit, offset int32) ([]RoomSummary, error)
}
```

**handler.go (RequireRole("ADMIN") 미들웨어):**
```
GET    /api/v1/admin/users              — 유저 목록
PUT    /api/v1/admin/users/:id/role     — 역할 변경
GET    /api/v1/admin/themes             — 전체 테마 목록
POST   /api/v1/admin/themes/:id/unpublish — 강제 비공개
GET    /api/v1/admin/rooms              — 전체 방 목록
```

### 핵심 로직
- 추가 sqlc 쿼리 필요: ListAllUsers, ListAllThemes, ListAllRooms, UpdateUserRole
- DB migration 추가 (admin용 쿼리)

### Step 1~4: sqlc 쿼리 추가 → service → handler → test → 커밋
```bash
git commit -m "feat(phase6): add admin domain (user/theme/room management)"
```

---

## Task 7: main.go DI 조립 + 라우트 등록

**Files:**
- Modify: `apps/server/cmd/server/main.go`
- Modify: `apps/server/internal/config/config.go` (JWT secret 추가)

### 설계

main.go에서:
1. Config에서 JWT secret 로드
2. 각 도메인 서비스 생성 (queries, cache, logger 주입)
3. Auth 미들웨어 인스턴스 생성
4. `/api/v1/` 그룹에 라우트 등록
5. public / authed / admin 3개 그룹

```go
r.Route("/api/v1", func(r chi.Router) {
    // Public
    r.Post("/auth/callback", authHandler.Callback)
    r.Post("/auth/refresh", authHandler.Refresh)
    r.Get("/themes", themeHandler.List)
    r.Get("/themes/{id}", themeHandler.Get)
    r.Get("/themes/slug/{slug}", themeHandler.GetBySlug)
    r.Get("/themes/{id}/characters", themeHandler.Characters)
    r.Get("/rooms", roomHandler.ListWaiting)
    r.Get("/rooms/{id}", roomHandler.Get)
    r.Get("/rooms/code/{code}", roomHandler.GetByCode)
    r.Get("/users/{id}", profileHandler.PublicProfile)

    // Authenticated
    r.Group(func(r chi.Router) {
        r.Use(middleware.Auth(jwtCfg))

        r.Post("/auth/logout", authHandler.Logout)
        r.Get("/auth/me", authHandler.Me)
        r.Get("/profile", profileHandler.Get)
        r.Put("/profile", profileHandler.Update)
        r.Post("/rooms", roomHandler.Create)
        r.Post("/rooms/{id}/join", roomHandler.Join)
        r.Post("/rooms/{id}/leave", roomHandler.Leave)

        // Creator (CREATOR, ADMIN)
        r.Route("/editor", func(r chi.Router) {
            r.Use(middleware.RequireRole("CREATOR", "ADMIN"))
            // ... editor routes
        })
    })

    // Admin
    r.Group(func(r chi.Router) {
        r.Use(middleware.Auth(jwtCfg))
        r.Use(middleware.RequireRole("ADMIN"))
        // ... admin routes
    })
})
```

### Step 1: config.go에 JWTSecret 추가
### Step 2: main.go DI 조립
### Step 3: 빌드 확인 `go build ./...`
### Step 4: 커밋
```bash
git commit -m "feat(phase6): wire all domain services in main.go"
```

---

## Task 8: OpenAPI Spec + TS 타입 생성

**Files:**
- Create: `apps/server/api/openapi.yaml`
- Create: `packages/shared/api/types.ts` (generated)
- Modify: `Taskfile.yml` (openapi-typescript 태스크)

### 설계
- OpenAPI 3.1 spec 수동 작성 (모든 엔드포인트)
- `openapi-typescript` 로 TS 타입 자동 생성
- Taskfile에 `task api:types` 태스크 추가

### Step 1: openapi.yaml 작성
### Step 2: openapi-typescript 설치 + Taskfile 태스크
### Step 3: 타입 생성 확인
### Step 4: 커밋
```bash
git commit -m "feat(phase6): add OpenAPI spec + TS type generation"
```

---

## 병렬 실행 전략

독립적인 Task를 에이전트로 병렬 실행 가능:

```
Round 1 (동시): Task 0 (공유 인프라)
Round 2 (동시): Task 1 (Auth) | Task 2 (Profile) | Task 3 (Room) | Task 4 (Theme)
Round 3 (동시): Task 5 (Editor) | Task 6 (Admin)
Round 4 (순차): Task 7 (main.go 조립) → Task 8 (OpenAPI)
```

Task 5/6은 추가 sqlc 쿼리가 필요하므로 Round 2 완료 후 진행.

---

**진행:** Phase 6 계획 작성 완료 (2026-04-05)
