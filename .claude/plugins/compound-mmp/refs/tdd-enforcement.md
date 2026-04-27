# TDD Soft Ask 정책 — Go / React

## 정책 결정 (사용자 결정 2026-04-27)

**Soft ask 채택** — Superpowers의 실제 구현 수준과 동일.

### 근거 1: Superpowers 분석
`/tmp/compound-mmp-research/superpowers/skills/test-driven-development/SKILL.md` 30~45행 "Delete it. Start over." 메시지는 **markdown rule + subagent self-enforce**일 뿐 실제 코드 자동 삭제 메커니즘이 존재하지 않는다. 약속(promise)에 의존하는 soft 강제.

### 근거 2: PR-2c (#107) 사고
`handleCombine` deadlock latent는 테스트 파일이 **있었지만** 동시성 시나리오를 누락했기 때문에 발생. "테스트 존재 != 안전" → 강제 삭제는 false sense of security 유발 위험.

따라서 사후 검증은 4-agent의 `oh-my-claudecode:test-engineer` (sonnet)가 수행하고, 사전 단계는 사용자 승인 가능한 soft ask로 충분.

## Go (`tdd-mmp-go`)

### 트리거
새 `.go` 파일 생성 시도 (Edit 또는 Write tool, file_path가 `apps/server/.../*.go`).

### 검사
다음 중 하나가 존재하면 통과:
- 동일 디렉토리 `*_test.go` 존재
- `internal/<pkg>/<name>_test.go` 존재
- 파일명이 `*_test.go` 자체이거나 `*_mock.go`/`*_gen.go` (자동 생성)

### 부재 시 동작 (PreToolUse hook 출력)
```json
{
  "hookSpecificOutput": {
    "hookEventName": "PreToolUse",
    "permissionDecision": "ask",
    "permissionDecisionReason": "TDD soft ask: <name>_test.go 가 없습니다. 테스트를 먼저 만드시겠습니까? (Y/n) — 도메인 모델·마이그레이션은 N 응답 가능."
  }
}
```

### 사용자 N 응답
진행 허용. 다만 4-agent test-engineer가 사후 P2(MEDIUM) coverage 경고 생성 가능.

## React (`tdd-mmp-react`)

### 트리거
새 `.tsx` 컴포넌트 파일 생성 시도 (`apps/web/src/components/...` 또는 `apps/web/src/pages/...`).

### 검사
- 동일 디렉토리 `<name>.test.tsx` 존재
- `__tests__/<name>.test.tsx` 존재
- `apps/web/src/test/<name>.test.tsx` 존재 (legacy)

### 부재 시 동작
Go와 동일한 ask 모드. `apps/web/CLAUDE.md`의 Vitest+RTL+MSW 패턴 인용.

## 예외 (자동 통과)

| 패턴 | 이유 |
|------|------|
| `*_test.go`, `*.test.tsx` | 본인이 테스트 |
| `*_mock.go`, `*_gen.go` | 자동 생성 |
| `apps/server/cmd/*` | main 엔트리포인트 |
| `apps/web/src/types/*` | 순수 타입 선언 |
| `apps/web/src/constants/*` | 상수만 |
| `migrations/*` | DB 마이그레이션 |

## 구현

`hooks/pre-edit-size-check.sh`이 size 검사와 함께 TDD 검사도 수행 (단일 hook, 다중 정책). PR-5에서 구현.
