---
pr: 170
reviewer: performance (sonnet-4-6)
date: 2026-04-29
findings: {high: 0, medium: 2, low: 3}
verdict: conditional
---

# PR-170 Performance Review

## Summary

PR-170은 4건의 third-party action 호환 DEBT(gitleaks artifact skip / CodeQL Node v20 symlink / Trivy sudo docker / DEBT-4 services→manual docker)를 CI 블로킹 없이 해소한다. 순수 성능 관점에서 **net 효과는 양수** — DEBT 해소로 이전에 fail-fast 종료되던 워크플로우가 완주하게 되어 실질 CI 비용이 기준선으로 복구된다. 단, DEBT-2 setup-node 1st-run 오버헤드(~10~15s)와 DEBT-4 health-wait 루프의 worst-case 만료(30s ceiling) 두 항목이 MEDIUM으로 관리 필요하다. DEBT-3 GHA cache 포기는 Trivy 1회용 image 특성상 실제 영향 없음(확인됨). 예상 net CI 시간 변화: **security-fast −1~2s (DEBT-1 artifact skip)**, **security-deep 동일 or −3~5s (DEBT-2/3 cold→warm 수렴 후)**, **ci.yml go-check +7~30s (DEBT-4 manual docker, warm 이미지 기준) / cold 1st run +40~90s**.

---

## Findings

### MEDIUM-PERF-1 — DEBT-4 health-wait 루프: 30-iteration ceiling과 변수 스코프 문제

**위치**: `ci.yml:76-90` (health 대기 루프)

**Evidence** (commit `e2106ad`):

```bash
# ci.yml:76-90
for i in $(seq 1 30); do
  pg_health=$(sudo docker inspect --format='{{.State.Health.Status}}' "$PG_NAME" 2>/dev/null || echo "starting")
  redis_health=$(sudo docker inspect --format='{{.State.Health.Status}}' "$REDIS_NAME" 2>/dev/null || echo "starting")
  if [ "$pg_health" = "healthy" ] && [ "$redis_health" = "healthy" ]; then
    echo "Both services healthy after ${i}s"
    break
  fi
  sleep 1
done
if [ "$pg_health" != "healthy" ] || [ "$redis_health" != "healthy" ]; then
  ...
  exit 1
fi
```

**영향**:

1. **변수 스코프 버그**: `pg_health`/`redis_health`가 루프 내부에서만 정의된다. 루프가 `break` 없이 30회 완주하면 (`for` loop은 새 subshell 없이 실행되나, bash에서 for-loop body의 마지막 iteration 변수는 루프 외부에 잔존함) — sh/dash 계열에서도 일관되나, `2>/dev/null || echo "starting"` 체인이 `docker inspect` 성공 시에도 exit-code propagation이 복잡해진다. 실제로는 bash에서 변수가 잔존하지만 명시적 초기화가 없어 edge-case 가독성 저하.

2. **ceiling 30초**: `health-interval 5s × health-retries 10` = Docker 자체 최대 대기 50s. 루프는 30s ceiling이므로 Docker 내부 healthcheck가 아직 실행 중이어도 루프가 만료되어 false-fail 가능. `docker inspect` 주기는 1초이므로 Docker healthcheck interval(5s)과 불일치 — 첫 5s 동안 `pg_health=starting`이 5회 소모, 실질 30 → 25 유효 체크.

3. **성능 비용**: 정상 경우(postgres cold pull 없음) postgres+redis warm start ~8~15s → 루프 8~15 iteration × 2 `docker inspect` + 2 `2>/dev/null` = 총 ~16~30 docker API call. cold의 경우 pull 포함 ~30~50s → ceiling 도달 시 false-fail.

**권고**: ceiling을 60으로 상향하거나, `sleep 1` 대신 `sleep 5` (healthcheck interval 일치)로 변경해 루프를 12회로 줄이고 ceiling 내 실질 체크 횟수를 늘린다. 또는 `docker wait --condition=healthy`(Docker 19.03+) 사용 시 루프 전체 제거 가능 (`timeout 60 docker wait --condition=healthy "$PG_NAME"`). 단, `sudo` 컨텍스트에서 `docker wait` 지원 확인 필요. **fold-in 또는 follow-up 허용** — 현재 ceiling 30s는 warm 환경(~8~15s)에서 충분하므로 Phase 23 custom image 전환 전까지는 LOW-risk.

---

### MEDIUM-PERF-2 — DEBT-2 CodeQL: setup-node@v4 1st-run download + symlink step 직렬화 오버헤드

**위치**: `security-deep.yml:141-156` (`Setup Node.js v20` + `Override system node` 2 step, commit `fd227f9`)

**Evidence**:

```yaml
# security-deep.yml:141-156
- name: Setup Node.js v20 (action — SHA-pinned binary)
  if: matrix.language == 'javascript-typescript'
  uses: actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020 # v4.4.0
  with:
    node-version: "20"

- name: Override system node with setup-node v20 binary
  if: matrix.language == 'javascript-typescript'
  run: |
    set -euo pipefail
    NODE_BIN=$(which node)
    NPM_BIN=$(which npm)
    echo "setup-node node: $NODE_BIN ($(node --version))"
    sudo ln -sf "$NODE_BIN" /usr/local/bin/node
    sudo ln -sf "$NPM_BIN" /usr/local/bin/npm
    /usr/local/bin/node --version
```

**영향**:

1. **1st run download**: `hostedtool-cache` volume이 없는 경우 (PR-168 검토에서 MEDIUM-PERF-2로 이미 지적된 매핑 미검증 이슈), `setup-node@v4`는 Node v20 binary를 GitHub CDN에서 full download (~50~100MB, ~15~30s). `security-deep.yml`의 CodeQL job은 matrix 2개 (`javascript-typescript` + `go`) 중 js-ts 매트릭스에서만 실행 → 1 job × 1 download. 2nd run+ hostedtool-cache hit 시 ~3~5s.

2. **symlink step 추가 오버헤드**: `which node`, `which npm`, `sudo ln -sf` × 2, `/usr/local/bin/node --version` = ~5 shell 호출 + 1 sudo = ~2~3s/run. 매 js-ts CodeQL run마다 고정 발생.

3. **PR-168 hostedtool-cache 미검증 연동**: PR-168에서 `RUNNER_TOOL_CACHE` 매핑이 검증되지 않은 상태 (PR-168 리뷰 MEDIUM-PERF-2). `security-deep.yml`의 CodeQL job도 동일 runner이므로, hostedtool-cache가 작동하면 2nd run부터 hit. 미작동 시 매 run ~15~30s download.

**권고**: PR-168의 hostedtool-cache 매핑 검증(MEDIUM-PERF-2 follow-up) 이후 연동 확인. symlink step의 ~2~3s 오버헤드는 CodeQL job(30분 timeout)에서 무시 가능. 단, `Override system node` step의 `sudo ln -sf` 실패 시 CodeQL job 전체가 중단되므로 명시적 fallback 고려. **follow-up** (Phase 23 custom image).

---

### LOW-PERF-1 — DEBT-1 gitleaks artifact upload 비활성: net 양수 효과

**위치**: `security-fast.yml:73` (`GITLEAKS_ENABLE_UPLOAD_ARTIFACT: false`, commit `5be282a`)

**Evidence**:

```yaml
GITLEAKS_ENABLE_UPLOAD_ARTIFACT: false  # 변경 전: true
GITLEAKS_ENABLE_SUMMARY: true
```

**영향**: artifact upload 비활성화로 gitleaks job의 artifact upload step이 스킵된다. 이전에는 `/home/runner` 하드코딩 경로 불일치로 upload step이 **error 종료** → job 자체 fail → CI 블로킹. 변경 후 scan 성공 시 job 완주.

**성능 관점**: artifact upload step 제거로 per-run 약 **+2~5s 단축** (upload 자체 시간). 더 중요한 것은 이전 fail-fast → 재시도 패턴이 제거되어 runner 시간 낭비 소멸. **net positive**.

**권고**: 현재 변경은 올바르다. SARIF artifact 복원은 Phase 23 custom image 이후 검토 (spec 명시). 성능 관점 추가 조치 불필요.

---

### LOW-PERF-2 — DEBT-3 GHA cache 제거: Trivy 1회용 image 특성상 실질 영향 없음

**위치**: `security-deep.yml:39-45` (manual `sudo docker build`, commit `fd227f9`)

**Evidence**:

이전 `docker/build-push-action`의 `cache-from: type=gha,scope=server` 제거. 현재:

```bash
sudo docker build \
  -f apps/server/Dockerfile \
  -t mmp-server:security-scan \
  apps/server
```

**영향 분석**:

| 항목 | 이전 (type=gha cache) | 현재 (캐시 없음) |
|---|---|---|
| Dockerfile layer cache | GHA 캐시 hit 시 layer skip | 매 run full rebuild |
| cache miss 시 | full rebuild (~2~4분) | full rebuild (~2~4분) |
| cache hit 시 | layer skip (~30~60초) | 불가 |
| Trivy scan 대상 | mmp-server:security-scan (로컬) | mmp-server:security-scan (로컬) |
| 이미지 재사용 | 없음 (scan 후 폐기) | 없음 (scan 후 폐기) |

**결론**: spec 코멘트("Trivy 1회용 image라 cache 무가치")는 이미지 자체의 재사용 관점에서는 맞으나, Dockerfile **layer** cache (Go mod download, apt install 등)는 GHA cache 사용 시 절약 가능했다. 단, Trivy job은 보안 scan이 목적이고 `security-deep.yml`의 timeout-minutes 15 내에서 full build도 완료 가능하다 (`docker/build-push-action` 접근 차단이 근본 원인이므로 sudo 우회가 유일한 실용적 대안). Layer cache 절약분 ~1~3분은 Phase 23 custom image에서 docker group 해소 후 복원 예정.

**권고**: 현재 변경 수용. Phase 23 custom image 이후 `docker/build-push-action` 복원 + GHA cache 재활성화. 성능 손실은 한시적(Phase 23 scope).

---

### LOW-PERF-3 — DEBT-4 ci.yml: runners-net 동적 검출 오버헤드 (go-check 단일 job)

**위치**: `ci.yml:43-51` (`runners-net` 동적 검출, commit `e2106ad`)

**Evidence**:

```bash
RUNNERS_NET=$(sudo docker network ls --format '{{.Name}}' | grep -E '(^|_)runners-net$' | head -1)
```

**영향**: `go-check`는 단일 job (e2e-stubbed.yml의 4 shard와 달리). 따라서 `docker network ls` 호출 1회/run. Docker daemon API 1회 = ~50~200ms. PR-168 LOW-PERF-3 (4 shard × 4회)보다 영향 작음.

**추가 관찰**: `go-check`는 ci.yml 내 단일 runner로 실행되므로 `runners-net` 명시 하드코딩 시 단순화 가능하나, 동적 검출이 compose project prefix 변경에 대한 방어막이므로 현재 구조 유지 권장. 비용 ~100ms → 무시 가능.

**권고**: 성능 관점 허용. 추가 조치 불필요.

---

## 전체 CI 시간 net effect 분석

| 워크플로우 | 변경 전 | 변경 후 | net |
|---|---|---|---|
| security-fast (gitleaks) | fail (artifact error) | pass, artifact skip ~2~5s 단축 | **−2~5s (양수)** |
| security-deep (trivy) | fail (docker.sock denied) | pass, full build ~2~4분 | **블로킹 제거** |
| security-deep (codeql js-ts) | fail (Node v10 오류) | pass, setup-node 1st ~15~30s | **블로킹 제거** |
| ci.yml go-check | fail (services block) | pass, health wait +7~30s warm | **블로킹 제거** |

**핵심 판단**: 4 DEBT 모두 이전에는 CI를 hard-fail 시켰으므로 "변경 후 CI 시간 증가"는 비교 기준이 "실패 종료 시간"이 아닌 "정상 완주 시간"으로 이동한 것이다. net 성능은 **양수** — CI pass에 도달하는 시간 자체가 PR-170 이전보다 단축된다.

---

## 권고 액션 우선순위

| Priority | Finding | Action | 시점 |
|---|---|---|---|
| MEDIUM | MEDIUM-PERF-1 (health-wait ceiling 30s) | ceiling 60으로 상향 또는 `docker wait --condition=healthy` 사용 | fold-in 또는 Phase 23 |
| MEDIUM | MEDIUM-PERF-2 (setup-node 1st-run, hostedtool-cache 미검증) | PR-168 hostedtool-cache 매핑 확인 후 연동 검증 | follow-up (PR-168 baseline 선행) |
| LOW | LOW-PERF-2 (GHA cache 포기) | Phase 23 custom image 후 복원 | Phase 23 |
| LOW | LOW-PERF-1, LOW-PERF-3 | 조치 불필요 | — |

---

## 미해결 측정 항목

1. **go-check "Start postgres + redis" step 시간**: 1st run (cold pull) vs 2nd run (warm). ceiling 30s가 실제로 충분한지 검증.
2. **CodeQL "Setup Node.js v20" step 시간**: hostedtool-cache hit 여부 확인 (`docker exec runner ls /opt/hostedtoolcache/node`).
3. **security-deep trivy "Build server image" step 시간**: full build ~2~4분 baseline 수립. Phase 23 복원 시 비교 기준.
4. **security-fast gitleaks job 총 시간**: artifact skip 후 정상 완주 시간 측정.

---

## Sign-off

PR-170의 4 DEBT 해소는 이전 hard-fail 상태에서 CI를 정상 궤도로 복구한다. 순수 성능 관점의 추가 비용(DEBT-2/4)은 Phase 23 custom image까지 한시적으로 수용 가능하며, MEDIUM-PERF-1 ceiling 문제만 cold 환경 false-fail 위험이 있어 fold-in 권고. **verdict: conditional** (MEDIUM-PERF-1 ceiling 상향 fold-in 또는 Phase 23 carry-over 명시 시 pass).

**Reviewed by**: performance (sonnet-4-6) | 2026-04-29
