# wsgen / Codegen 결정성 카논

> Go map iteration randomization으로 인한 codegen output drift 방지. PR-1 (#212) 인지 후 등재.

## 카논

**Go codegen tool에서 collection을 출력 순서에 영향 주는 source로 쓰는 모든 지점은 explicit sort 적용.** map iteration은 Go runtime randomized → 매 실행마다 다른 순서 → output drift → CI fail.

### 강제점

1. **wsgen `extractPayloads` 출력**: `out []PayloadStruct`를 `sort.Slice(out, func(i,j int) bool { return out[i].Name < out[j].Name })`로 정렬. struct name 알파벳 정렬.
2. **`parser.ParseDir` 결과 처리**: `pkgs map[string]*ast.Package` + `pkg.Files map[string]*ast.File` 둘 다 map. iteration 후 collect → sort.
3. **Schema/Catalog 등 다른 codegen tool**: `apps/server/cmd/<tool>/render.go` 또는 처리 pipeline에서 같은 원칙. catalog는 이미 `render.go:25`에서 정렬됨.

### Anti-pattern (금지)

- ❌ `for k, v := range myMap { out = append(out, build(k, v)) }` 후 `out` 그대로 emit
- ❌ codegen 결과를 commit 후 "diff 없음 = OK" 검증 — 우연 stable 출력 가능
- ❌ "wsgen 결과를 그냥 commit하면 되겠지" — sort 추가 없이 random 출력 합치는 건 드리프트 첫 인지자가 다른 PR 작성자

### 검증 의무

```bash
# 같은 입력으로 3번 generate → 모두 동일 출력
for i in 1 2 3; do
  cd apps/server && go generate ./...
done
git diff --exit-code  # 0이어야 PASS
```

## 근거 사례 (PR-1 #212)

- `bcdb7df` (PR-9 머지): `ErrorPayload`/`ConnectedPayload` struct 추가, wsgen 결과 우연 stable 출력으로 commit
- `a468206` (PR-1 첫 fix 시도): 다른 정렬 결과를 commit → 두 번째 CI run에서 다시 drift
- `6568719` (PR-1 진짜 fix): `extractPayloads`에 `sort.Slice` 추가 → 두 번 generate 동일 결과 검증

## 연관 카논

- `memory/MISTAKES.md` 2026-05-02 wsgen-nondeterminism entry
- `apps/server/cmd/wsgen/payload.go` (sort 적용 master)
- `apps/server/cmd/wsgen/render.go:25` (catalog 정렬 sibling 패턴)
- pre-merge gate 후보: `feedback_pre_merge_codegen_gate.md` (작성 보류, 사용자 결정)

## 향후 적용

- wsgen 외 다른 codegen tool 신규 시 본 카논 참조
- mockgen: `mockgen` v0.6.0 자동 생성물은 이미 deterministic (Go map 사용 X)
- sqlc: 자동 생성물 deterministic 검증 — 별도 spike 후 추가 (Q-wsgen-main-drift-scope에서 추적)
