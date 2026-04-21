---
name: MMP v3 이메일/비밀번호 인증
description: 로컬 인증 (이메일/비밀번호), OAuth와 병행, E2E 테스트 계정 e2e@test.com
type: project
---
이메일/비밀번호 로그인. OAuth(카카오/구글)와 병행.

**Why:** OAuth 설정 없이 개발/테스트할 수 있도록.

**How to apply:**
- E2E 테스트 계정: `e2e@test.com` / `e2etest1234` (닉네임: E2E테스터)
- 기존 `test@test.com` 계정은 비밀번호 불명 (사용 불가)
- API: `POST /api/v1/auth/register`, `POST /api/v1/auth/login`
- Health: `GET /health` (백엔드 직접), `/api` prefix는 Vite proxy 경유
- provider = "local", provider_id = email
- bcrypt 해싱, password_hash 컬럼 (migration 00009)
- 프론트: LoginPage에 이메일/비번 폼 + 회원가입/로그인 전환

**구현 파일:**
- `apps/server/db/migrations/00009_password_auth.sql`
- `apps/server/internal/db/users_password.go`
- `apps/server/internal/domain/auth/service.go` (Register, Login)
- `apps/server/internal/domain/auth/handler.go` (HandleRegister, HandleLogin)
- `apps/web/src/features/auth/LoginPage.tsx`
