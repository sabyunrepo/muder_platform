---
name: tdd-mmp-go
description: |
  Go 새 파일 작성 시 동일 디렉토리에 *_test.go가 없으면 TDD soft ask로 테스트를 먼저 만들도록 안내.
  자동 활성화 트리거: "Go 코드 작성", "Go 핸들러 만들어", "internal/<pkg> 구현", "go test", "testify",
  "mockgen", "table-driven test", apps/server/internal/ 하위 .go 파일 작성, 새 Go 패키지 도입.
  Soft ask 모드 — N 응답으로 진행 허용 (도메인 모델·마이그레이션·자동 생성물 예외).
  4-agent test-engineer가 사후 P2 coverage 검증 수행.
---

# tdd-mmp-go — Go TDD Soft Ask

## 정책 요약

- **트리거**: 새 `.go` 파일 작성 시도 (Write tool, file_path가 `apps/server/.../*.go` 또는 repo 내 `.go`).
- **검사**: 동일 디렉토리에 `*_test.go` (또는 `<base>_test.go`) 존재 여부.
- **부재 시 동작**: PreToolUse hook이 `permissionDecision: "ask"` JSON 출력 → 사용자 Y/N 결정.
- **N 응답**: 진행 허용. 4-agent `oh-my-claudecode:test-engineer`가 PR review 시 P2(MEDIUM) coverage 경고 생성 가능.

카논 root: `.claude/plugins/compound-mmp/refs/tdd-enforcement.md`.

## 자동 통과 예외

> **Single source of truth**: `hooks/pre-edit-size-check.sh` § "자동 통과 예외 (size + TDD 모두 스킵)" case 블록. 아래 표는 참조용 사본 — drift 발견 시 hook이 master.

| 패턴 | 이유 |
|------|------|
| `*_test.go` | 본인이 테스트 |
| `*_mock.go`, `*_gen.go`, `*sqlc.go`, `*.pb.go` | 자동 생성 |
| `apps/server/cmd/*` | main 엔트리포인트 |
| `migrations/*`, `*.sql` | DB 마이그레이션 |

자동 통과는 `hooks/pre-edit-size-check.sh` 단일 hook이 size 검사와 함께 처리.

## Go 코드 룰 (apps/server/CLAUDE.md 카논)

테스트 패턴 권장 순서:
1. **table-driven test** — `tests := []struct{name string; in T1; want T2}{...}` for-range. testify `assert`.
2. **interface mock** — `mockgen` 자동 생성 (`go:generate mockgen -destination=mock_foo.go ...`). hand-written mock 금지.
3. **race detector** — `go test -race ./internal/<pkg>/...` 항상 활성.
4. **t.Cleanup** — defer 대신 t.Cleanup으로 fixture 정리.

## 파일 시그니처 예시

```go
// apps/server/internal/domain/foo/handler.go (신규)
package foo

func Handle(ctx context.Context, req *Request) (*Response, error) {
    // ...
}
```

```go
// apps/server/internal/domain/foo/handler_test.go (먼저 작성 권장)
package foo

import (
    "context"
    "testing"
    "github.com/stretchr/testify/assert"
)

func TestHandle(t *testing.T) {
    tests := []struct{
        name    string
        in      *Request
        want    *Response
        wantErr bool
    }{
        {name: "happy path", in: &Request{...}, want: &Response{...}, wantErr: false},
        {name: "invalid input", in: nil, wantErr: true},
    }
    for _, tc := range tests {
        t.Run(tc.name, func(t *testing.T) {
            got, err := Handle(context.Background(), tc.in)
            if tc.wantErr { assert.Error(t, err); return }
            assert.NoError(t, err)
            assert.Equal(t, tc.want, got)
        })
    }
}
```

## N 응답 시 명시 권장

```
사용자: N
이유: 도메인 모델 (struct만 정의, 행위 없음)
```

PR description 또는 commit body에 "N 응답 사유"를 한 줄 명시 → 4-agent test-engineer가 이해 후 false positive 방지.

## 카논 ref

- TDD 정책 근거: `refs/tdd-enforcement.md` (PR-2c handleCombine deadlock 사례)
- Go 코드 룰: `apps/server/CLAUDE.md`
- 4-agent 매핑: `refs/post-task-pipeline-bridge.md`
- Anti-patterns: `refs/anti-patterns.md`
