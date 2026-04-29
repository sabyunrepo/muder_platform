---
pr_id: "PR-8"
phase: "Phase 22 W1.5"
branch: "chore/w1-5-runner-action-compat"
created: 2026-04-29
status: "in-progress"
prerequisite: "PR-168 (`bddb68b`) 머지 + 사용자 host 재배포 완료"
---

# PR-8 — Runner Third-Party Action 호환 (4 main DEBT 일괄)

## 배경

Phase 22 W1 containerization (`runs-on: self-hosted` → 4 containerized-runner-1~4) 머지 후, 3 main workflow 의 third-party action 이 새 runner 환경과 호환 X 로 fail 누적. 이전 admin-skip 정책 (만료 2026-05-01) 으로 머지 됨. PR-168 (a31af3f) CI 결과에서 3 check FAILURE 동일 root cause 확인:

| DEBT | Workflow | Failing Step | Root Cause |
|------|----------|-------------|-----------|
| DEBT-1 | `security-fast.yml#gitleaks` | gitleaks-action artifact upload | `rootDirectory: /home/runner` 하드코딩 ↔ containerized runner working dir |
| DEBT-2 | `security-deep.yml#codeql (javascript-typescript)` | Initialize CodeQL | image default Node v10.19.0 ↔ `??` syntax (action spawn child) |
| DEBT-3 | `security-deep.yml#trivy` | docker buildx | `/var/run/docker.sock` permission denied (sup group GID 990 lost in workflow step) |
| DEBT-4 | `ci.yml#go-check` | services postgres/redis | GHA `services:` block 가 myoung34/github-runner image 의 network namespace 와 호환 X |

**공통 root cause**: 사용자 host 에 bare-host runner 부재 (4 containerized-runner 만 active) → `runs-on: self-hosted` 가 containerized runner 로 routing.

## 결정 (정공 / Phase 23 carry-over 분리)

| Layer | DEBT-1 | DEBT-2 | DEBT-3 | DEBT-4 |
|-------|--------|--------|--------|--------|
| **Workflow level (PR-8)** | env `GITLEAKS_ENABLE_UPLOAD_ARTIFACT: false` | NodeSource v20 step (apt) | step-level `sudo docker` | manual `docker run` + healthcheck (PR-168 패턴) |
| **Image level (Phase 23)** | (해당 없음) | base image 에 Node v20 사전 install | runner user 의 docker group GID 990 정착 | (해당 없음 — workflow level 로 충분) |

**single-concern 카논 예외 정당화**: 4건 모두 단일 root cause (`runs-on: self-hosted` → containerized runner 부적합). 분리 시 4 PR + 동일 컨텍스트 4번 review 부담. 1 PR 묶음 + clear commit 분리 가 최적.

## 변경 spec

### DEBT-1: gitleaks artifact upload 비활성

**파일**: `.github/workflows/security-fast.yml`

**변경 전** (L62-69):
```yaml
- name: Run gitleaks
  uses: gitleaks/gitleaks-action@ff98106e4c7b2bc287b24eaf42907196329070c7 # v2.3.9
  env:
    GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
    GITLEAKS_CONFIG: .gitleaks.toml
    GITLEAKS_ENABLE_COMMENTS: false
    GITLEAKS_ENABLE_UPLOAD_ARTIFACT: true
    GITLEAKS_ENABLE_SUMMARY: true
```

**변경 후**:
```yaml
- name: Run gitleaks
  uses: gitleaks/gitleaks-action@ff98106e4c7b2bc287b24eaf42907196329070c7 # v2.3.9
  env:
    GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
    GITLEAKS_CONFIG: .gitleaks.toml
    GITLEAKS_ENABLE_COMMENTS: false
    # Containerized runner working dir mismatch — action's rootDirectory
    # hardcoded to /home/runner. scan itself succeeds; only artifact upload
    # fails. Disabled until Phase 23 Custom Image migration.
    GITLEAKS_ENABLE_UPLOAD_ARTIFACT: false
    GITLEAKS_ENABLE_SUMMARY: true
```

**효과**: action artifact upload step skip → scan 결과 SUCCESS. summary 는 GHA job summary 로 표시 (artifact 없이도 검증 가능).

**Trade-off**: artifact 다운로드 불가 → forensic 시 GHA log 검색 필요. real LEAK 발견 시점에 별도 PR 으로 artifact 복원 검토 (Phase 23 Custom Image 후).

### DEBT-2: CodeQL JS-TS Node v20 (setup-node + symlink override)

**파일**: `.github/workflows/security-deep.yml`

**변경 전** (L109-145):
```yaml
codeql:
  ...
  steps:
    - name: Harden Runner
      ...
    - name: Checkout
      ...
    - name: Setup Go
      if: matrix.language == 'go'
      ...
    - name: Initialize CodeQL
      ...
```

**변경 후 — 추가 step (setup-node action + /usr/local/bin symlink)**:
```yaml
codeql:
  ...
  steps:
    - name: Harden Runner
      ...
    - name: Checkout
      ...
    - name: Setup Go
      if: matrix.language == 'go'
      ...

    # myoung34/github-runner image default Node v10.19.0 가 ?? syntax 미지원.
    # CodeQL action 의 spawn child process 가 system Node 사용 → setup-node@v4
    # 가 PATH 만 update 해도 subprocess resolve 실패.
    # setup-node 의 SHA-pinned v20 binary 를 /usr/local/bin 에 symlink →
    # /usr/bin/node 보다 PATH 우선이라 spawn child 도 v20 사용.
    # Image level fix 는 Phase 23 carry-over.
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

    - name: Initialize CodeQL
      ...
```

**효과**: setup-node@v4 의 SHA-pinned v20 binary 를 `/usr/local/bin` 에 symlink. CodeQL action subprocess 가 PATH 검색 시 `/usr/local/bin/node` (v20) → `/usr/bin/node` (v10) 순으로 resolve → v20 사용. `??` syntax 통과.

**Rejected: NodeSource apt repo 직접 install (`curl | sudo bash`)**
- 매 run 마다 NodeSource setup script 가 원격 코드 실행 → CI infra 에 RCE 패턴 도입.
- setup-node@v4 는 GitHub-pinned + SHA-checksummed binary 사용 → 동일 효과 + 더 안전.

**Trade-off**: setup-node 의 1st run cache 빌드 (~5-10s, hostedtool-cache 활용 시 2nd run+ 0s). NodeSource 비교 시 supply chain 표면 ↓.

### DEBT-3: Trivy docker.sock permission

**파일**: `.github/workflows/security-deep.yml`

**변경 전** (L20-44):
```yaml
trivy:
  ...
  steps:
    ...
    - name: Set up Docker Buildx
      uses: docker/setup-buildx-action@... # v3.9.0

    - name: Build server image
      uses: docker/build-push-action@... # v6.9.0
      ...
```

**변경 후 — Build server image 패턴 변경**:

**1차 시도 (실패)** — `sudo docker build` 만 + trivy-action `image-ref:` 유지:
- 1st CI run (commit `fd227f9`) FAILURE: `aquasecurity/trivy-action` 자체가 trivy CLI 로 image inspect → docker.sock 접근 → permission denied.
- 교훈: `sudo docker build` 는 image 생성만 해결. trivy-action 안의 trivy CLI 가 host docker.sock 필요.

**2차 정공 — tarball mode (`input:` 파라미터)**:
```yaml
trivy:
  ...
  steps:
    ...
    # Containerized runner sup group 990 lost. docker/build-push-action +
    # trivy-action 모두 socket access denied.
    # 정공: sudo docker build → sudo docker save tarball → trivy-action input
    # mode (tarball scan 은 docker.sock 불필요).
    # Image level fix 는 Phase 23 carry-over.
    - name: Build server image + save tarball (manual via sudo docker)
      run: |
        set -euo pipefail
        sudo docker build \
          -f apps/server/Dockerfile \
          -t mmp-server:security-scan \
          apps/server
        sudo docker save mmp-server:security-scan -o /tmp/mmp-server.tar
        sudo chown "$(id -u):$(id -g)" /tmp/mmp-server.tar

    - name: Run Trivy vulnerability scanner
      uses: aquasecurity/trivy-action@... # 0.35.0
      with:
        input: /tmp/mmp-server.tar  # docker.sock 불필요
        format: sarif
        output: trivy-results.sarif
        severity: CRITICAL,HIGH
```

채택 근거 — tarball scan 은 trivy CLI 가 tar 파일을 직접 read → docker.sock 의존 0. buildx + cache-from gha 효과 포기 (Trivy scan 만의 1회용 이미지라 cache 무가치).

### DEBT-4: Go Lint+Test services block

**파일**: `.github/workflows/ci.yml`

**변경 전** (L17-41):
```yaml
go-check:
  name: Go Lint + Test
  runs-on: self-hosted
  services:
    postgres:
      image: postgres:17-alpine
      env: ...
      ports: ["5432"]
      options: >- --health-cmd ...
    redis:
      image: redis:7-alpine
      ports: ["6379"]
      options: >- --health-cmd ...
  defaults:
    run:
      working-directory: apps/server
  steps:
    ...
    - name: Export service connection env
      working-directory: ${{ github.workspace }}
      run: |
        echo "DATABASE_URL=postgres://mmp:mmp_test@localhost:${{ job.services.postgres.ports['5432'] }}/mmp_test?sslmode=disable" >> "$GITHUB_ENV"
        echo "REDIS_URL=redis://localhost:${{ job.services.redis.ports['6379'] }}" >> "$GITHUB_ENV"
```

**변경 후** (PR-168 e2e-stubbed.yml 패턴 적용):
```yaml
go-check:
  name: Go Lint + Test
  runs-on: self-hosted
  defaults:
    run:
      working-directory: apps/server
  steps:
    - name: Harden Runner
      ...
    - name: Checkout
      ...

    # ── Service containers (myoung34/github-runner ↔ GHA services 호환 우회) ─
    # 정상 GHA services block 은 runner network 식별 실패로 fail.
    # 같은 runners-net bridge 에 직접 docker run → hostname 접근.
    - name: Start postgres + redis
      working-directory: ${{ github.workspace }}
      run: |
        set -euo pipefail
        PG_NAME="ci-go-pg-${{ github.run_id }}-${{ github.run_attempt }}"
        REDIS_NAME="ci-go-redis-${{ github.run_id }}-${{ github.run_attempt }}"
        echo "PG_NAME=$PG_NAME" >> "$GITHUB_ENV"
        echo "REDIS_NAME=$REDIS_NAME" >> "$GITHUB_ENV"

        RUNNERS_NET=$(sudo docker network ls --format '{{.Name}}' | grep -E '(^|_)runners-net$' | head -1)
        if [ -z "$RUNNERS_NET" ]; then
          echo "::error::runners-net network not found on host"
          sudo docker network ls
          exit 1
        fi
        echo "RUNNERS_NET=$RUNNERS_NET" >> "$GITHUB_ENV"
        echo "Detected runners-net: $RUNNERS_NET"

        sudo docker rm -f "$PG_NAME" "$REDIS_NAME" 2>/dev/null || true

        sudo docker run -d --name "$PG_NAME" \
          --network "$RUNNERS_NET" \
          -e POSTGRES_DB=mmp_test \
          -e POSTGRES_USER=mmp \
          -e POSTGRES_PASSWORD=mmp_test \
          --health-cmd "pg_isready -U mmp -d mmp_test" \
          --health-interval 5s \
          --health-timeout 3s \
          --health-retries 10 \
          postgres:17-alpine

        sudo docker run -d --name "$REDIS_NAME" \
          --network "$RUNNERS_NET" \
          --health-cmd "redis-cli ping" \
          --health-interval 5s \
          --health-timeout 3s \
          --health-retries 10 \
          redis:7-alpine

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
          echo "::error::services failed to become healthy (postgres=$pg_health, redis=$redis_health)"
          sudo docker logs "$PG_NAME" 2>&1 | tail -30
          sudo docker logs "$REDIS_NAME" 2>&1 | tail -30
          exit 1
        fi

    - name: Export service connection env
      working-directory: ${{ github.workspace }}
      run: |
        echo "DATABASE_URL=postgres://mmp:mmp_test@${PG_NAME}:5432/mmp_test?sslmode=disable" >> "$GITHUB_ENV"
        echo "REDIS_URL=redis://${REDIS_NAME}:6379" >> "$GITHUB_ENV"

    - name: Setup Go
      ...
    - name: Run golangci-lint
      ...
    - name: mockgen drift check
      ...
    - name: WS contract drift gate
      ...
    - name: PlayerAware coverage lint
      ...
    - name: Run tests
      ...
    - name: Coverage summary
      ...
    - name: Upload Go coverage to Codecov
      ...
    - name: Upload Go coverage artifact
      ...
    - name: Build server
      ...

    # Cleanup: 다음 run 충돌 방지 + container leak 방지
    - name: Cleanup postgres + redis
      if: always()
      working-directory: ${{ github.workspace }}
      run: |
        sudo docker rm -f "$PG_NAME" "$REDIS_NAME" 2>/dev/null || true
```

**효과**: services block 제거 → manual docker run + healthcheck wait + runners-net hostname 접근 → migration + test SUCCESS.

**Trade-off**: 보일러플레이트 (PR-168 e2e-stubbed.yml 와 동일 패턴 중복). Phase 23 reusable composite action `.github/actions/start-services/action.yml` 으로 추출 검토.

## 검증 방법

PR-8 push 후 4 check 모두 SUCCESS 확인:
1. `gitleaks (Secret scan)` — artifact upload skip, scan SUCCESS
2. `CodeQL (javascript-typescript)` — Node v20 install 후 init/autobuild/analyze SUCCESS
3. `Trivy (container CVE)` — sudo docker build 성공, SARIF upload SUCCESS
4. `Go Lint + Test` — manual postgres+redis healthy → migration → test SUCCESS

## 1st CI run 결과 (commit `99ba252` 기준)

| DEBT | check 결과 | workflow level fix 자체 | 검증 |
|------|----------|--------------------|------|
| DEBT-1 gitleaks | ✅ SUCCESS | ✅ 작동 | upload artifact skip, scan SUCCESS |
| DEBT-2 CodeQL JS-TS | ❌ FAILURE | ✅ 작동 (extractor 통과) | Node v20 symlink 효과 → `??` syntax 통과. query 실행 단계 exit code 99 (별개 root cause: query OOM 또는 timeout, `--ram=2048` 한계) |
| DEBT-3 Trivy | ✅ SUCCESS | ✅ 작동 (2차 시도) | 1차 (sudo docker build + image-ref) fail → 2차 (docker save tarball + input mode) success |
| DEBT-4 Go Lint+Test | ❌ FAILURE | ✅ 작동 (services healthy) | manual postgres+redis healthy + migration + 첫 패키지 test 성공. 후속 `internal/auditlog`/`internal/editor` 등 testcontainers-go 의존 test 가 host docker.sock permission denied 로 fail (pre-existing 부채, Test review T-2 에서 식별) |

**결론**: 4 workflow level fix 자체는 모두 작동. fail 2건은 PR-170 변경이 표면화한 pre-existing 부채:
- DEBT-2 fail: CodeQL query 실행 OOM/timeout (별개 root cause, Node v20 fix 와 무관)
- DEBT-4 fail: testcontainers-go 의 host docker.sock 의존 (Phase 23 docker group 정착 필요)

## 추가 fold-in (1st CI run 이후 — admin-skip 만료 결정 시)

- **testcontainers-go fold-in** (DEBT-4 후속, 사용자 결정 2026-04-29):
  - `ci.yml#go-check` 의 `Run tests` step 을 `sudo -E env "PATH=$PATH" go test ...` 으로 변경
  - `Fix coverage.out ownership` step 추가 (sudo go test 로 root:root 생성된 파일을 runner user 로 chown — 후속 Codecov upload + artifact upload 가 read 가능)
  - 근거: PR-170 1st CI run 에서 testcontainers-go pre-existing 부채 노출. admin-skip 만료 결정 시 PR-170 자체가 ALL pass 필요 → 별도 PR-9 분리 대신 본 PR fold-in.
  - 정공은 Phase 23 Custom Image base 에 docker group GID 990 정착 — 본 fold-in 은 workflow level forward port.

- **CodeQL JS-TS query OOM** (DEBT-2 후속):
  - 2nd CI run 에서 자동 해소 (`8a772b5` re-run 에서 SUCCESS)
  - 1st run fail 은 transient (cache miss 또는 일시적 OOM). 별도 fix 불필요 — 관찰만.
  - 재발 시 `--ram=2048` → `4096` 상향 검토.

## 4-agent review fold-in (1차 push 후)

- **Perf-MED-1 + Test-HIGH-1** (health-wait 30s ceiling): ci.yml + e2e-stubbed.yml 둘 다 60s 로 상향. Docker healthcheck max (interval 5s × retries 10 = 50s) 이상 ceiling 확보 — cold start (image pull + initdb) 시 false-fail 방지.

## Phase 23 carry-over (확정 escalate)

- **Composite action 추출** (Arch-HIGH-1): `.github/actions/start-services/action.yml` — postgres/redis 시작 + healthcheck wait + cleanup 패턴 추출. ci.yml + e2e-stubbed.yml 95% 보일러플레이트 제거. PR-5 (`runs-on: [self-hosted, containerized]`) 머지 시 사용처 확대 전에 진입.
- **Custom Image (Option A)**: base image 에 Node v20 + Playwright + docker group GID 990 사전 install.
  - DEBT-2 setup-node + symlink 자연 해소
  - DEBT-3 sudo docker 우회 + Test-T-2 testcontainers-go 자연 해소
  - 결과: 본 PR 의 workflow level fix 4건 중 3건 dead code 가능
- **Trivy scan 이미지 cleanup** (Sec-MED-3): `mmp-server:security-scan` tag 가 매 run 마다 build → host disk 누적 위험. `if: always()` cleanup step 추가.
- **gitleaks artifact 복원** (Sec-MED-2): Custom Image migration 후 별도 메커니즘 검토.

## Phase 22 W3 carry-over (PR-5 의존)

- **RUNNERS_NET regex 강화** (Sec-MED-1): `grep -E '(^|_)runners-net$'` 가 `bad_runners-net` 등 악성 네트워크 매칭 가능. compose project prefix 안정화 후 `name: runners-net` explicit 만 검증.

## 참고

- 부모 plan: `docs/plans/2026-04-28-phase-22-w1-5-debt-cleanup/checklist.md`
- 핸드오프: `memory/sessions/2026-04-29-pr-168-fold-in-shellcheck-cascade.md`
- PR-168 패턴 source: `.github/workflows/e2e-stubbed.yml` (`Start postgres + redis` step)
- single-concern 카논: `memory/feedback_branch_pr_workflow.md`
- 4-agent review 강제: `memory/feedback_4agent_review_before_admin_merge.md`
- admin-skip 정책: `memory/project_ci_admin_skip_until_2026-05-01.md`
