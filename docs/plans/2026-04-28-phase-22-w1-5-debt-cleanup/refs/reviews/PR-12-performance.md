# PR-12 Performance Review

## Verdict: conditional

---

## HIGH

**build cache 미포함 → 매 run 전체 컴파일** — `~/.cache/go-build` 제외로 incremental compile 가속이 사라짐. testcontainers-go v0.42 + race-instrumented 테스트의 컴파일 비용은 cold 기준 약 90~120초 추정 (go.sum 477줄·중규모 dep tree, -race 2~3× overhead). golangci-lint, coverage, e2e-stubbed build 합산 시 CI 1회 실행 총 컴파일 추가 비용 ~3~5분.

---

## MEDIUM

**cache key 공유 race** — 9개 workflow 모두 동일 key `go-mod-Linux-<go.sum hash>`. 동시 push 시 마지막 `actions/cache` save 만 살아남음 (GHA last-writer-wins). 발생 빈도는 낮지만 force-push / merge train 환경에서 cache miss → 연쇄 full-download 위험.

**restore-keys fallback 의 false economy** — `go-mod-Linux-` partial hit 시 stale mod cache 로 빌드 시도 → go download 보정 발생. 실제 절감 없이 복잡성만 추가되는 케이스 가능.

---

## LOW

**Go 버전 혼재** — ci.yml + security 계열은 `1.25`, e2e-stubbed/flaky/module-isolation 은 `1.24`. 동일 key prefix 공유 시 mod 캐시는 호환 가능하나, `go build` 아티팩트는 별도 디렉토리라 실질 충돌 없음. 단, 두 버전이 같은 restore-keys 에 매칭되면 stale 경고 가능.

---

## 정량 추정

| 구간 | Before (PR-172 stuck) | After (PR-12) |
|------|----------------------|---------------|
| mod cache fetch | 5분+ (0.0 MB/s 정체) | ~30초 (370 MB @ 50 MB/s 추정) |
| build cache fetch | 포함 → 2.4 GB+ 비대 (stuck 원인) | 없음 (0초) |
| 컴파일 (incremental) | ~30초 (cache hit) | **~90~120초 (cold, -race)** |
| 총 예상 | ∞ (stuck) | **~2~2.5분** |

**순효과**: fetch 정체 5분+ → 2.5분 이하. **~2.5분 단축**. build cache 미포함 컴파일 추가비용 (~90초) 을 감수해도 stuck 상태 대비 압도적 개선.

---

## 결론

fetch throughput 정체(Azure blob → containerized runner 0.0 MB/s) 는 2.4 GB build cache가 직접 원인이므로 제외 결정은 타당. 단, build cache 를 장기적으로 포기하면 -race 컴파일 비용이 누적됨. **조건부 통과**: 머지는 허용하되 `~/.cache/go-build` 를 별도 key(`go-build-${{ github.sha }}`) + `save-always: true` 로 작게 분리하는 후속 DEBT를 등록 권고.
