---
pr: 170
reviewer: test (sonnet-4-6)
date: 2026-04-29
findings: {high: 1, medium: 3, low: 2}
verdict: conditional
---

# PR-170 테스트/검증 가능성 리뷰

## Summary

4 DEBT 모두 1st CI run 자체가 검증이다. DEBT-1/2/3은 통과 = fix 확인. 그러나 DEBT-4 health 대기 루프에 **30s timeout이 이론상 충분하지 않을 수 있다** (worst-case docker healthcheck cycle > 30s). 또한 `Export service connection env` step에 `set -euo pipefail` 미설치로 인한 silent empty URL 위험과, testcontainers를 사용하는 테스트(editor, auditlog 패키지)가 docker.sock 직접 접근을 필요로 하나 이에 대한 대응이 없어 go test 결과의 완전성이 불명확하다. PR 자체는 회귀를 만들지 않으나, 30s timeout과 testcontainers 미대응 두 이슈를 수용하고 머지 진행할지 판단이 필요하다.

---

## Findings

### T-1 [HIGH] healthcheck 대기 루프 30s — 이론적 타임아웃 부족 가능성

**위치**: `ci.yml` L76–90 (`for i in $(seq 1 30)`)

**갭**: health 대기 루프는 1초 슬립 × 30회 = 최대 30초 대기. postgres 컨테이너 healthcheck 설정은 `--health-interval 5s --health-timeout 3s --health-retries 10`. Docker healthcheck는 컨테이너 시작 후 첫 번째 check를 `--health-start-period`(기본 0s) 이후 수행하나, healthy 판정까지 최악 경우 약 5~10s(postgres 초기화) + 5s(첫 interval) = 15s 내외다. 그러나 **이론적 최악 경우**:
- 이미지 cold-pull(네트워크 지연) + postgres 느린 초기화 → 시작에 20s 초과 가능
- `--health-retries 10` × `--health-interval 5s` = 50s가 docker의 최대 unhealthy 판정 시간이므로, docker가 `healthy`로 바꾸기 전에 loop가 30s에서 종료될 수 있다

**정밀 분석**:
- 실제 CI 환경(이미지 캐시 존재, postgres:17-alpine 2~5s 시작)에서는 30s로 충분
- `docker run` 직후 이미지가 이미 로컬에 없으면 pull 시간(수십 초)이 추가됨 — 단, `docker run`은 pull을 포함하므로 loop 진입 전 완료됨
- 실질 위험: `docker run` 명령 후 컨테이너 시작은 빠르나, healthy 전환까지 interval 1회(5s) 이상이 필요. 30s는 6회 interval을 수용 — 충분하다

**재평가**: PR-168 e2e-stubbed.yml에서 동일 패턴이 이미 검증 통과. 실질 위험은 LOW이나 이론상 갭이 존재하여 HIGH로 분류.

**증거**: `ci.yml:76` (`seq 1 30`), `ci.yml:62–64` (`--health-interval 5s --health-retries 10`)

**영향**: 드물게 slow runner에서 CI flake — 컨테이너가 31s에 healthy가 되면 Go 테스트가 connection error로 실패하고 원인이 불명확해진다.

**권고 (fold-in)**: loop를 `seq 1 60`으로 확장하거나, `--health-start-period 10s`를 추가하여 초기 판정 지연을 명시. 대안: `docker wait` 대신 `timeout 60 bash -c 'until [ "$(docker inspect --format...)" = healthy ]; do sleep 1; done'` 패턴.

---

### T-2 [MEDIUM] testcontainers-go가 docker.sock 직접 접근 필요 — PR-170 미대응

**위치**: `apps/server/internal/domain/editor/test_fixture_test.go`, `apps/server/internal/auditlog/store_test.go`

**갭**: `go test -race ./...` 실행 시 editor 및 auditlog 패키지 테스트가 `testcontainers-go`를 사용하여 postgres:16-alpine 컨테이너를 runner 프로세스(sudo 없이)에서 직접 시작한다. DEBT-3 해설에 "runner user의 docker group 정착은 Phase 23 carry-over"라고 명시되어 있어, **현재 runner user는 docker.sock 접근 권한이 없을 가능성이 있다**.

- DEBT-4: postgres/redis 시작은 `sudo docker run`으로 우회 ✓
- testcontainers: `sudo` 경로 없음 — Go 표준 라이브러리 내부에서 `docker` 호출

**증거**: `test_fixture_test.go:41` (`postgres.Run(ctx, "postgres:16-alpine", ...)`), `store_test.go:51` (동일 패턴). DEBT-3 comment: `security-deep.yml:33–38` ("docker group 정착은 Phase 23")

**영향**: testcontainers 테스트가 CI에서 `permission denied: /var/run/docker.sock` 로 실패하면 coverage 하락, Go coverage gate(41% threshold) 위반 가능. 또는 이미 prior art로 실패 중이라면 이 PR 이전부터 같은 상태.

**판단**: 이 이슈는 PR-170이 신규 도입한 것이 아니라 pre-existing이다. PR-170의 DEBT-4가 이 문제를 악화하지 않는다. 그러나 DEBT-4 관련 코멘트에서 "services block 제거 → hostname 방식으로 전환"의 검증 범위가 testcontainers 테스트를 포함하는지 명확하지 않으므로 MEDIUM으로 기록.

**권고 (follow-up)**: CI 첫 녹색 run 로그에서 `editor` 및 `auditlog` 패키지 test 결과 확인 필수. 실패 시 Phase 23 docker group 정착 전까지 `DOCKER_HOST=unix:///var/run/docker.sock` 명시 또는 `testcontainers.WithDockerClient` 우회 검토.

---

### T-3 [MEDIUM] `Export service connection env` step — `set -euo pipefail` 미설치

**위치**: `ci.yml:93–97` (`- name: Export service connection env`)

**갭**: step의 `run:` block에 `set -euo pipefail` 없음. GHA `run:` 기본은 `set -e`만 적용된다. `${PG_NAME}` 변수가 GITHUB_ENV로부터 주입될 때, 이론적으로 값이 비어있을 경우:
```
DATABASE_URL=postgres://mmp:mmp_test@:5432/mmp_test?sslmode=disable
```
와 같이 hostname이 누락된 URL이 생성된다. `set -u`가 없으면 unbound variable 에러도 발생하지 않는다.

**실질 위험**: "Start postgres + redis" step이 `set -euo pipefail`로 보호되어 있고, 해당 step 성공 시에만 `PG_NAME`이 GITHUB_ENV에 기록된다. step 실패 시 GHA job이 즉시 중단되므로 Export step은 실행되지 않는다. 따라서 실질 위험은 낮다.

**증거**: `ci.yml:93–97`, PR-168 e2e-stubbed.yml의 동일 step도 `set -euo pipefail` 없음 (일관성 있는 패턴이나 갭은 동일)

**영향**: 실질 발생 가능성 낮음. 단, 코드 일관성 측면에서 "Start postgres" step의 `set -euo pipefail` 패턴이 Export step에도 적용되어야 한다.

**권고 (fold-in)**: Export step `run:` 첫 줄에 `set -euo pipefail` 추가. 2줄 변경.

---

### T-4 [MEDIUM] DEBT-2 CodeQL symlink — `go` matrix에서 Node v20 보장 없음

**위치**: `security-deep.yml:141–156` (Setup Node.js v20 + Override system node steps)

**갭**: `if: matrix.language == 'javascript-typescript'` 조건이 두 step 모두에 적용된다. `go` matrix job은 Node symlink 없이 실행된다. CodeQL v4의 autobuild(`codeql-action/autobuild`) 가 go 분석 시에도 내부적으로 Node를 사용하는지 여부가 불명확하다 — 만약 go matrix에서도 Node가 필요하다면 현재 수정이 불충분.

**증거**: `security-deep.yml:141` (`if: matrix.language == 'javascript-typescript'`). CodeQL action 내부 동작: autobuild는 언어에 무관하게 Node.js worker process를 사용하는 것으로 알려져 있음.

**실질 위험**: `go` CodeQL은 PR-170 이전에도 동일 Node 환경으로 실행되었으므로, 만약 `go` matrix가 기존에 실패하지 않았다면 Node가 go matrix에 불필요하거나 이미 다른 경로로 해결됨. CI 첫 run 로그에서 `go` matrix CodeQL 완료 여부 확인 필요.

**영향**: `go` matrix CodeQL 실패 시 SARIF 업로드 누락 — Security tab 분석 공백.

**권고 (conditional fold-in)**: CI 첫 run 후 go matrix 결과 확인. 실패 시 `if:` 조건을 `always()` 또는 `matrix.language != ''`로 변경.

---

### T-5 [LOW] DEBT-1 gitleaks artifact 비활성 — scan 자체 정상 여부 assertion 없음

**위치**: `security-fast.yml:73` (`GITLEAKS_ENABLE_UPLOAD_ARTIFACT: false`)

**갭**: artifact 업로드를 비활성화한 결과, gitleaks 스캔의 성공 여부가 GHA job summary에만 노출된다. gitleaks-action의 scan exit code가 0인지 확인하는 별도 assertion이 없다. GITLEAKS_ENABLE_SUMMARY: true로 summary는 생성되나, 시크릿 탐지 시 action이 non-zero exit으로 fail하는지 여부가 수정 후에도 보장되는가를 1st run으로만 확인 가능.

**증거**: `security-fast.yml:63–74`, gitleaks-action v2.3.9 행동: `GITLEAKS_ENABLE_UPLOAD_ARTIFACT: false`는 upload step만 skip. scan exit code는 독립적으로 유지됨 — gitleaks 탐지 시 action은 여전히 non-zero exit.

**영향**: 실질 영향 없음. artifact 없이도 scan 방어력 유지. GHA job summary로 visual 확인 가능.

**권고**: 첫 CI 녹색 run 후 `gitleaks` job의 summary tab에서 scan 완료 메시지 존재 확인. 문서화 이슈로 Phase 23 artifact 복원 시 해소.

---

### T-6 [LOW] container name collision 간 edge case — 동시 workflow run

**위치**: `ci.yml:38–39` (`PG_NAME="ci-go-pg-${{ github.run_id }}-${{ github.run_attempt }}"`)

**갭**: 컨테이너 이름은 `run_id + run_attempt`로 unique. 동일 브랜치에 push + PR 이벤트가 동시 발생할 때 `concurrency.cancel-in-progress: true`가 동일 workflow group 내에서 이전 run을 취소한다. 그러나 **서로 다른 workflow** (ci.yml vs security-deep.yml) 가 동일 runner에서 동시 실행될 때 이들은 각각 다른 run_id를 가지므로 컨테이너 이름 충돌이 없다.

**edge case**: runner pool이 1개만 남은 상황에서 동일 runner에서 ci.yml의 attempt-1이 cleanup 전 죽고 attempt-2가 시작되면 → attempt-2는 `sudo docker rm -f "$PG_NAME" "$REDIS_NAME"` (line 54)로 attempt-1 컨테이너를 cleanup한 후 새로 시작. 이 동작이 의도적으로 구현되어 있음 (이전 run cleanup 코드).

**증거**: `ci.yml:53–54` (`sudo docker rm -f "$PG_NAME" "$REDIS_NAME" 2>/dev/null || true`)

**영향**: 설계 범위 내에서 충분히 처리됨. 실질 위험 없음.

**권고**: 없음. 현재 구현으로 충분.

---

## 검증 가능성 총평

| DEBT | CI run 검증 | 비고 |
|------|------------|------|
| DEBT-1 gitleaks | 1st run pass = fix 확인 | summary 노출 확인 |
| DEBT-2 CodeQL Node | js-ts matrix 1st run = fix 확인 | go matrix 결과 추가 확인 필요 |
| DEBT-3 Trivy sudo docker | 1st run pass = fix 확인 | SARIF 업로드까지 확인 |
| DEBT-4 services → manual | 1st run Go test pass = fix 확인 | testcontainers 패키지 결과 별도 확인 |

**1st CI run이 가장 강한 evidence**. 4개 DEBT 모두 workflow 자체가 자동 검증이며, 별도의 테스트 코드 추가 없이 pass/fail로 판단 가능.

---

## Sign-off

- **Verdict**: conditional — 30s timeout(T-1)과 testcontainers 미대응(T-2)에 대한 사용자 수용 확인 후 merge 가능
- **Fold-in 권고**: T-3 (`set -euo pipefail` Export step), T-1 (loop 60으로 확장)
- **Follow-up**: T-2 (testcontainers docker.sock) Phase 23 carry-over, T-4 (go matrix CodeQL) 1st run 후 판단
- **PR-168 패턴 일관성**: DEBT-4의 구현이 e2e-stubbed.yml 패턴과 일치 (동일 healthcheck 루프, 동일 RUNNERS_NET 검출, 동일 container name 패턴)
- **카논 ref**: `docs/plans/2026-04-28-phase-22-w1-5-debt-cleanup/refs/pr-8-runner-action-compat.md`
