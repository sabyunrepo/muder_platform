---
pr: 168
title: "Performance Review — PR-4 Runner Cache Volume"
branch: chore/w1-5-runner-cache
base: main
reviewer_focus: performance / efficiency
review_date: 2026-04-29
files_changed: 6
diff: "+341/-36"
---

# PR-168 Performance Review

## 요약 (200단어 이내)

PR-168은 4 containerized runner에 `playwright-cache` + `hostedtool-cache` named volume을 도입하여 매 run마다 발생하는 Playwright browser (~230MB) fresh download를 차단하는 것이 핵심 목표다. 4-agent 리뷰 H-2 fold-in으로 `GOMODCACHE`/`PNPM_STORE_PATH`/`GOCACHE` volume을 제거해 `setup-go`/`setup-node` GHA cache 충돌은 회피했다. 결과적으로 cache 효과는 **Playwright binary (cold→hot ~3~5분 → ~5~10초)** + **toolchain hostedtool-cache (setup-* 첫 install → 즉시 hit)** 두 축으로 한정된다. Race condition은 Playwright atomic extraction + hostedtool per-version 격리로 실질 위험 없음(MEDIUM 등급으로 하향). 주요 미해결 이슈는 (1) `hostedtool-cache` 실제 경로 매핑 검증 미실시 (MEDIUM), (2) 진단 step 영구 잔존 (LOW), (3) services block → manual docker run 전환으로 startup latency가 GHA-managed 대비 +5~15초 증가 (LOW), (4) 4 shard 동시 `pnpm install --frozen-lockfile` + build (GHA cache 독립) 로 network burst 가능 (LOW). 1st run에서 Playwright hit 여부는 4 shard 도착 순서에 의존하며, 동시 실행 시 실제로는 복수 shard가 동시 download를 시작할 수 있다 (MEDIUM).

---

## Findings

### MEDIUM-PERF-1 — Playwright 1st run: 4 shard 동시 download 가능성

**위치**: `infra/runners/docker-compose.yml:88` (playwright-cache volume), `e2e-stubbed.yml:266` (Install Playwright browsers for matrix)

**근거**: PR-4 spec (refs/pr-4-runner-cache.md §Case A)은 "첫 shard만 download, 나머지 즉시 hit"을 가정. 그러나 `pnpm exec playwright install --with-deps ${{ matrix.browser }}`는 `PLAYWRIGHT_BROWSERS_PATH`가 가리키는 `/opt/cache/playwright` 경로에서 browser-specific 디렉토리 (`chromium-NNNN/`, `firefox-NNNN/`) 존재 여부를 확인한다. 4 shard (chromium×2 + firefox×2)가 동시 스케줄될 경우, 각 browser-version 디렉토리가 아직 없으므로 chromium 2 shard와 firefox 2 shard가 각각 동시에 download를 시작한다. 동일 browser version을 두 shard가 동시에 쓰면 추출 중간 상태를 다른 shard가 읽을 위험이 있다.

**실측 어려움**: Playwright 내부가 `{browser}-{revision}/` 임시 디렉토리 → atomic rename 방식인지, 아니면 직접 쓰기인지 소스 확인 필요. Playwright 공식 문서(context7)에서 "atomic extraction" 명시 미확인 상태.

**추정**:
- 최선: atomic rename → 2번째 shard는 설치 완료 후 즉시 hit. 실제 net download 2회 (chromium 1 + firefox 1).
- 최악: partial write race → browser binary 손상. 재시도(--retries=1) 로 커버되나 time cost +3~5분.

**권고**: `playwright install`에 lockfile 메커니즘이 있는지 확인. 없다면 shard별 브라우저 매핑이 이미 되어 있으므로 (chromium 2개, firefox 2개) 동일 browser 버전이 중복 다운로드되는 시간 낭비만 발생하고 corruption 위험은 atomic rename으로 완화 가능. 1st run 실제 시간 = max(chromium download, firefox download) ≈ 3~5분. spec의 "첫 shard만" 주장은 정확히는 "첫 chromium shard + 첫 firefox shard" 각각 1회 download로 재정정 필요.

---

### MEDIUM-PERF-2 — hostedtool-cache 실제 경로 매핑 검증 미실시

**위치**: `infra/runners/docker-compose.yml:25` (`RUNNER_TOOL_CACHE: /opt/hostedtoolcache`), `e2e-stubbed.yml:154` (Setup Go), `e2e-stubbed.yml:255` (Setup Node.js)

**근거**: `RUNNER_TOOL_CACHE` 환경변수를 명시(L-ARCH-1)했으나 `actions/setup-go@v5` / `actions/setup-node@v4`가 실제로 이 변수를 읽어 `/opt/hostedtoolcache` 경로에 toolchain을 저장하는지 CI log 검증이 없다. `setup-go` v5 소스 기준 `RUNNER_TOOL_CACHE`를 우선 읽고 없으면 기본 경로를 사용한다고 알려져 있으나, myoung34/github-runner 이미지 내부에서의 동작은 GitHub-hosted runner와 다를 수 있다.

**추정**:
- 경로 미매핑 시: `hostedtool-cache` volume이 마운트되어 있어도 Go/Node toolchain은 컨테이너 내 임시 경로에 설치 → run 사이에 cache miss → 매 run `Setup Go`/`Setup Node` full install (~20~40초/각).
- 경로 매핑 정상 시: 2nd run부터 즉시 hit (~5~10초).

**권고**: 첫 CI run 완료 후 `docker exec containerized-runner-1 ls /opt/hostedtoolcache` 로 Go/Node toolchain 존재 확인. 없으면 `RUNNER_TOOL_CACHE` env가 setup-* 에 도달하지 않은 것 → workflow `env:` 또는 step-level `env:` 로 명시 필요.

---

### MEDIUM-PERF-3 — services block → manual docker run 전환으로 startup latency 증가

**위치**: `e2e-stubbed.yml:85` (Start postgres + redis), `e2e-stubbed.yml:128` (health wait loop)

**근거**: 기존 `services:` block은 GHA runner가 job 시작 전 병렬로 postgres + redis를 풀링하고 health check 완료 후 첫 step을 실행한다 (순수 대기 없음, job 시작 시점에 이미 healthy 상태 보장). PR-168이 이를 `docker run` + `for i in $(seq 1 30)` 폴링 루프로 교체했다. 이는 `Checkout` step 이후 postgres/redis pull + start + health를 직렬 수행한다.

**비교**:

| 항목 | 기존 services block | PR-168 manual docker run |
|---|---|---|
| postgres:17-alpine pull | 병렬 (job pre-setup) | 직렬 (Checkout 이후) |
| 첫 이미지 pull | 병렬 숨김 | 직렬 +30~60초 (cold) |
| 캐시된 이미지 | 병렬 숨김 | 직렬 +2~5초 (warm) |
| health wait | job 시작 전 완료 | +5~15초 loop |
| cleanup | GHA 자동 | manual step 필요 (추가됨) |

**추정**:
- cold (이미지 미캐시): +60~90초 per shard
- warm (이미지 캐시됨): +7~20초 per shard

`services:` block이 self-hosted runner에서 network 식별 실패로 동작 불가하다는 근본 원인은 타당하므로 trade-off는 수용 가능. 단, 왜 startup latency가 증가하는지 spec에 명시되어 있지 않아 측정 비교 없이 교체된 상태.

**권고**: 첫 성공 run의 "Start postgres + redis" step 시간을 기록해 baseline 수립. 이미지를 runner base image에 pre-bake하거나 `docker pull` 단계를 별도 step으로 분리해 병렬화 가능 여부 검토. Phase 23 custom image 전환 시 이 latency는 자동 소멸.

---

### LOW-PERF-1 — 진단 step (Diagnostic) 영구 잔존

**위치**: `e2e-stubbed.yml:57-76` (Diagnostic — step user/group/docker)

**근거**: PR-168 commit `6aa013c`에 추가된 진단 step이 `b320681`까지 제거되지 않았다. 이 step은 매 shard(4개) + merge-reports job마다 실행되지는 않으나 (merge-reports에는 없음), 4 e2e job × per run 실행된다. `id`, `whoami`, `ls`, `docker version`, `docker ps`, `sudo docker version` 6회 shell 호출 + 출력 = ~2~3초/shard.

**추정 비용**: 4 shard × 2~3초 = 8~12초/run. 연간 100 run 가정 시 ~15~20분 누적 낭비.

**권고**: docker permission 문제가 해소된 후 제거. 주석 `# PR-168 542497b 이후 docker permission denied (exit 126) 원인 파악용`이 임시 목적을 명시하므로, CI 3회 green 확인 후 삭제 commit.

---

### LOW-PERF-2 — 4 shard 동시 `pnpm install` network burst (GHA cache miss 시)

**위치**: `e2e-stubbed.yml:263` (Install dependencies), `e2e-stubbed.yml:267` (Install Playwright browsers)

**근거**: pnpm store는 H-2 fold-in으로 GHA cache(`actions/setup-node` `cache: 'pnpm'`)를 사용한다. pnpm GHA cache는 각 shard가 독립적으로 restore하고, cache miss 시 각 shard가 독립적으로 registry에서 download한다 (shared volume이 아니므로). 4 shard 동시 miss는 동일 패키지를 4번 parallel download하고 host 네트워크 대역폭을 경쟁한다.

**추정**: pnpm-lock.yaml 변경 run (cache miss 시) 4 shard × ~2~3분 parallel download. 실제 시간은 host network bandwidth에 의존 (sabyun@100.90.38.7 환경). H-2로 volume cache 제거가 의도적이므로 이는 known trade-off.

**권고**: pnpm-lock 변경이 잦지 않으면 무시 가능. 잦다면 `pnpm-cache` named volume 복원 (단, race-safe 검증 선행 필요 — H-4 근거로 제거된 상태이므로 신중하게 재검토).

---

### LOW-PERF-3 — `docker network ls | grep` 매 run 실행 오버헤드

**위치**: `e2e-stubbed.yml:96` (runners-net 동적 검출)

```bash
RUNNERS_NET=$(sudo docker network ls --format '{{.Name}}' | grep -E '(^|_)runners-net$' | head -1)
```

**근거**: `docker network ls` + `grep` 파이프는 Docker daemon API 1회 호출 (~50~200ms). 매 shard(4개) × 1회 = 총 4회 실행. 단, `runners-net` explicit name 부여(PR-168 6d5a71d)로 2nd run부터는 검출 즉시 성공.

**추정 비용**: 4 × 100ms = ~400ms/run. 무시 가능.

**권고**: 성능 관점 허용. 단, `runners-net` explicit name 이미 보장되므로 동적 검출 대신 `RUNNERS_NET=runners-net` 하드코딩으로 단순화 가능. 그러나 fallback 안전성(이름 변경 시 에러로 조기 실패)을 위해 현재 구조 유지 권장.

---

### LOW-PERF-4 — `docker exec -i ... psql < file` connection overhead

**위치**: `e2e-stubbed.yml:247-250` (Seed E2E theme)

```bash
sudo docker exec -i -e PGPASSWORD=mmp_e2e "$PG_NAME" psql -U mmp -d mmp_e2e -v ON_ERROR_STOP=1 < apps/server/db/seed/e2e-themes.sql
```

**근거**: `docker exec`는 container subprocess 생성 (~50~100ms) + psql 연결 (~20~50ms) 오버헤드. `services:` block 사용 시 `psql -h localhost -p PORT`로 직접 접근하던 것과 비교.

**추정 비용**: ~150ms. 무시 가능.

**권고**: 성능 관점 허용.

---

## Cache Hit Ratio 가설 검증

| Scenario | 1st run | 2nd run | 비고 |
|---|---|---|---|
| **playwright-cache (chromium)** | miss → ~150MB download ~2~3분 | hit → ~5~10초 | 4 shard 중 chromium 첫 shard만 download |
| **playwright-cache (firefox)** | miss → ~80MB download ~1~2분 | hit → ~5~10초 | firefox 첫 shard만 download |
| **hostedtool-cache (Go 1.24)** | miss → full install ~20~40초 | hit → ~5~10초 | RUNNER_TOOL_CACHE 매핑 검증 필요 |
| **hostedtool-cache (Node 20)** | miss → full install ~15~30초 | hit → ~5~10초 | RUNNER_TOOL_CACHE 매핑 검증 필요 |
| **pnpm store (GHA cache)** | miss → ~2~3분 | hit → ~10~20초 | lock 변경 시 새 key |
| **go.sum (GHA cache)** | miss → ~1~2분 | hit → ~10~20초 | go.sum 변경 시 새 key |

**총 setup 시간 추정**:
- 1st run: ~8~12분 (cold volume + GHA cache miss)
- 2nd run: ~30~60초 (Playwright + toolchain volume hit + GHA cache hit)
- 70% 단축 주장: 2nd run 기준 달성 가능. 단 pnpm GHA cache miss 시 +2~3분 추가.

---

## Race Condition 가설 검증

| 항목 | 위험도 | 근거 |
|---|---|---|
| playwright-cache 동시 write | **MEDIUM** (추정) | atomic rename 가정. 공식 확인 미완료. |
| hostedtool-cache 동시 write | **LOW** | per-version dir 격리 (`node/20.x.x/`, `go/1.24.x/`) → idempotent overwrite |
| postgres/redis container 이름 충돌 | **LOW** | `run_id-browser-shard` 조합으로 unique |
| mmp-server port 8080 충돌 | **LOW** | H-ARCH-1 pkill + ss precheck 가드 |

---

## 권고 액션 우선순위

| Priority | Finding | Action |
|---|---|---|
| MEDIUM | MEDIUM-PERF-2 (hostedtool-cache 매핑 미검증) | 첫 green run 후 `docker exec runner-1 ls /opt/hostedtoolcache` 확인 |
| MEDIUM | MEDIUM-PERF-1 (Playwright 1st run 동시 download) | Playwright install atomic 동작 확인. spec의 "첫 shard만" 표현 정정 |
| MEDIUM | MEDIUM-PERF-3 (services→manual docker startup latency) | 첫 run Step time 기록 → baseline 수립 |
| LOW | LOW-PERF-1 (Diagnostic step 잔존) | CI 3회 green 후 step 제거 commit |
| LOW | LOW-PERF-2 (4 shard pnpm burst) | lock 변경 빈도 낮으면 허용 |
| LOW | LOW-PERF-3 (docker network ls overhead) | 무시 가능 또는 하드코딩 단순화 |
| LOW | LOW-PERF-4 (docker exec psql overhead) | 무시 가능 |

---

## 미해결 측정 항목 (benchmark 권고)

1. **Playwright cache hit 실시간 측정**: `Install Playwright browsers` step 시간 — 1st run vs 2nd run 비교.
2. **hostedtool-cache 효과**: `Setup Go`/`Setup Node` step 시간 — `RUNNER_TOOL_CACHE` 매핑 성공 여부 간접 확인.
3. **postgres/redis startup**: `Start postgres + redis` step 시간 — services block 대비 overhead 측정.
4. **총 e2e job 시간**: 1st run → 2nd run 개선율. spec의 "70% 단축" 실제 달성 여부.

CI run 성공 후 GitHub Actions job step timings (UI Summary)에서 위 4항목 측정 권고.

---

## 카논 ref

- `refs/pr-4-runner-cache.md` — PR-4 spec
- `refs/reviews/PR-168.md` — 4-agent security/perf/arch/test 통합 리뷰
- `../../2026-04-28-phase-22-runner-containerization/checklist.md` — W1 plan
- `checklist.md` — W1.5 plan
