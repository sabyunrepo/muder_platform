# PR-B — coverage lint AST 재작성

> Size: **M** · Risk: **Low** · Dependency: 없음

## 목표

`scripts/check-playeraware-coverage.sh` 의 awk+grep 기반 구현은 `return m.BuildState()` literal 만 잡는다. 리뷰에서 **4 가지 우회 패턴**이 지적됨:

1. `return m.buildStateInner()` — 사적 helper
2. `data, err := m.BuildState(); return data, err` — 2 줄 캡처
3. `return json.Marshal(m.snapshot())` — full-state marshal (per-player 로직 부재)
4. `-A2` scope 벗어난 3 줄 이상 본문

PR-B 는 이 gate 를 Go AST 기반으로 재작성해 위 4 패턴을 모두 차단한다.

## Scope

| 파일 | 변경 |
|------|------|
| `scripts/cmd/playeraware-lint/main.go` | 신규 — Go AST walker. 각 패키지에서 `func (m *X) BuildStateFor(...)` 바디를 파싱해 (a) `m.BuildState()` 호출, (b) `m.snapshot()`/그 파생 호출, (c) `Marshal(m.<field>)` 전체 map 직렬화 패턴 탐지 |
| `scripts/check-playeraware-coverage.sh` | AST 툴 호출로 교체 (`go run ./scripts/cmd/playeraware-lint`). 기존 awk 로직 제거. |
| `.github/workflows/ci.yml` | go-check step 경로 업데이트 (이미 shell 호출이므로 minimal) |
| `apps/server/scripts/testdata/playeraware-lint/` | 신규 — 4 우회 패턴 + 정상 패턴 각 1 건씩 테스트 fixture |
| `scripts/cmd/playeraware-lint/main_test.go` | 신규 — fixture 기반 lint 검증 |

## 구현 메모

- AST walker 는 `go/parser` + `go/ast.Inspect` 조합. 패키지 하나씩 순회하며 `FuncDecl` 의 Receiver 가 포인터 타입 + 이름이 `BuildStateFor` 인 함수만 검사.
- **차단 규칙:**
  - `*ast.CallExpr` 중 Selector 가 `m.BuildState` — Class 1
  - `*ast.CallExpr` 중 Selector 가 `m.snapshot` 또는 이름이 `snapshot` 으로 시작하는 메서드 (단 `snapshotFor` 예외) — Class 2
  - `json.Marshal(x)` 에서 x 가 `m.<field>` 직접 참조이고 해당 field 가 `map[...]` 타입 — Class 3
- 예외 (허용):
  - `PublicStateMarker` 임베드 모듈 — BuildStateFor 가 아예 없음. AST walker 는 존재 여부 check 만.
  - 테스트 파일 (`_test.go`) 제외.
- `ALLOW_STUB` 배열은 AST 도구에 CLI flag 로 전달 (`--allow <path>`). 현재 비어있음.

## 테스트

- `scripts/cmd/playeraware-lint/main_test.go` — fixture 기반 table-driven.
- 4 우회 패턴 각각 `wantViolation: true`, 정상 패턴 `wantViolation: false`.
- 실제 모듈 전체에 대해 `go run ./scripts/cmd/playeraware-lint ./apps/server/internal/module/...` 실행 후 violation 0 확인.

## 리스크

- AST 도구는 Go 버전 호환성 관리 필요. `go/parser` 는 표준 라이브러리 내장이라 문제 적음.
- fixture 경로가 실제 모듈과 충돌하지 않도록 `testdata/` 디렉토리에 격리.
- CI runtime 증가: 현재 shell grep ~100ms → AST walker ~500ms (패키지당 parse). 허용 범위.

## 검증 체크리스트

- [ ] AST 도구 빌드 green (`go build ./scripts/cmd/playeraware-lint`)
- [ ] `main_test.go` fixture 6 케이스 전부 pass
- [ ] `go run ./scripts/cmd/playeraware-lint ./apps/server/internal/module/...` exit 0, 메시지 clean
- [ ] `bash scripts/check-playeraware-coverage.sh` 도 AST 도구 호출로 동작 (backward-compat shim)
- [ ] CI workflow 호출 경로 유지
- [ ] fixture 내 4 우회 패턴 자체 포함(self-test) 하고 AST 도구가 모두 감지
