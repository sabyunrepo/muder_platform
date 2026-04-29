# PR-12 Architecture Review

## Verdict: conditional

분기 1건 (HIGH-A1, composite action 추출 carry-over 명시) 만 충족하면 머지 가능. nine-callsite fold-in 자체는 single root cause(`~/.cache/go-build` 누적) → single concern 카논 부합.

## HIGH

### HIGH-A1 — DRY 위반의 운영 부채 명시 부재

9 callsite × 8 line YAML 블록 = 72 줄 사실상 동일 패턴 복제. `actions/cache@v4.2.3` SHA, key 포맷, `restore-keys` 폴백, 주석 9곳 일괄 갱신 의무 발생. setup-go v6 또는 actions/cache v5 출시 시 9 PR 또는 1 거대 PR 강제 — DRY 카논 명백 위반. spec 의 carry-over 섹션에 **"Phase 23 entry: composite action `.github/actions/setup-go-narrow` 추출, 9곳을 `uses: ./.github/actions/setup-go-narrow` 1줄로 환원"** 항목을 명시 추가 필요. carry-over 명문화 없으면 영구 부채화.

## MEDIUM

### MED-A1 — H-2 정합성 narrative 정밀 (정당)

PR-168 H-2 의 본질은 "GHA cache 메커니즘 사용 자체" (named volume override 금지) 였지 "setup-go default cache 범위 보존"이 아니었다. PR-12 는 GHA cache 사용을 유지하면서 path 만 `~/go/pkg/mod` 로 좁히므로 **H-2 retract 아님 정당화 성립**. 단 spec H-1 의 표현을 "H-2 의 *cache 메커니즘 선택* 결정과 양립; *cache 범위* 결정은 본 PR 에서 신규" 로 정밀화하면 audit trail 명확.

### MED-A2 — single-concern 카논 부합 (9 fold-in 정당)

`feedback_branch_pr_workflow.md` 는 type/scope/slug 한 단위만 강조; 9 fold-in 의 위험 신호는 (a) 다른 root cause, (b) 다른 패턴, (c) 독립 rollback 필요. PR-12 는 (a) 단일 root cause(`~/.cache/go-build` size 누적), (b) 8 line 동일 패턴, (c) 1 workflow 만 부분 적용 시 cache key collision 위험 — 9 일괄 갱신이 오히려 **atomicity 보장**. 4 분리는 reject (audit trail noise + 부분 적용 cache pollution 위험).

### MED-A3 — H-3 cache key 통일 정당화 (구조적 정합)

`~/go/pkg/mod` 의 module cache 는 Go toolchain version 무관 (소스 + checksum). Go 1.24/1.25 혼재 7 workflow 에서 단일 key 공유 → cache slot 1개 점유 + cross-workflow restore-keys hit 활성화. version 분리는 슬롯 2배 + hit rate 절반의 anti-pattern. **결정 정당**, 단 spec 에 "상위 build cache(`~/.cache/go-build`)는 toolchain 종속이므로 향후 재도입 시 version-split 필수" 단서 추가 권장.

## LOW

### LOW-A1 — Phase 23 dead code 가능성

base image populate 시 `actions/cache` step 자체가 dead. 다만 image rebuild 주기 vs `go.sum` drift 빈도 트레이드오프 존재 — PR-12 는 image refresh 후에도 incremental delta restore 역할 유지 가능. dead 가 아닌 **fallback 안전망**으로 재정의.

### LOW-A2 — PR-5 (#172) 동시 머지 안전

PR-5 변경은 `runs-on:` 라벨, PR-12 변경은 `setup-go`/`actions/cache` step. 동일 파일이지만 직교 영역. 머지 순서 무관, conflict 없음 — 단 두 PR rebase 시 둘 다 같은 9 workflow touch 했음을 자동 conflict resolver 가 인지하도록 `git rerere` 활성화 권장.

## carry-over (Phase 23)

1. **HIGH-A1 후속**: composite action `.github/actions/setup-go-narrow` 추출 (input: go-version, sum-path → step output: cache-hit). 9 callsite → 1 줄 환원.
2. **LOW-A1 평가**: Custom Image populate 후 `actions/cache` 효과 측정 (hit rate < 5% 시 제거).
3. **W1.5 후속**: PR-167 fold-in 이후 `~/.cache/go-build` 누적이 진짜 root cause 인지 1주 cache size 추적.

## 결론

architectural soundness **conditional pass**. 9 fold-in 은 single root cause + atomicity 측면에서 카논 부합, H-2/H-3 결정은 구조적으로 정당. 단 72줄 YAML 복제는 DRY 부채로 영구화될 위험 — Phase 23 carry-over 에 composite action 추출을 명시 추가 후 머지 권고. PR-5 와 parallel mergeable 정당.
