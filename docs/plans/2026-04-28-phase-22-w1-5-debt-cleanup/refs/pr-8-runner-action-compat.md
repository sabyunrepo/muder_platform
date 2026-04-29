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

옵션 A — `sudo docker` step 으로 manual build (action 우회, PR-168 e2e-stubbed.yml 패턴):
```yaml
trivy:
  ...
  steps:
    ...
    # Containerized runner sup group 990 (host docker.sock) lost in workflow.
    # docker/build-push-action 이 socket access denied → sudo prefix 로 우회.
    # Image level fix (runner user 의 docker group 정착) 은 Phase 23 carry-over.
    - name: Build server image (manual via sudo docker)
      run: |
        set -euo pipefail
        sudo docker build \
          -f apps/server/Dockerfile \
          -t mmp-server:security-scan \
          apps/server

    - name: Run Trivy vulnerability scanner
      ...
```

옵션 A 채택 — buildx + cache-from gha 효과 포기되지만 Trivy scan 만의 1회용 이미지라 cache 무가치.

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

## Phase 23 carry-over

- **Custom Image (Option A)**: base image 에 Node v20 + Playwright + docker group GID 990 사전 install. CodeQL JS-TS Node install step + Trivy sudo docker 우회 모두 자연 해소.
- **Reusable composite action**: `.github/actions/start-services/action.yml` — postgres/redis 시작 + healthcheck wait 패턴 추출. ci.yml + e2e-stubbed.yml 보일러플레이트 제거.
- **gitleaks artifact 복원**: real LEAK 발견 시 forensic 위해 별도 메커니즘 (e.g. SARIF upload 패턴 재사용).

## 참고

- 부모 plan: `docs/plans/2026-04-28-phase-22-w1-5-debt-cleanup/checklist.md`
- 핸드오프: `memory/sessions/2026-04-29-pr-168-fold-in-shellcheck-cascade.md`
- PR-168 패턴 source: `.github/workflows/e2e-stubbed.yml` (`Start postgres + redis` step)
- single-concern 카논: `memory/feedback_branch_pr_workflow.md`
- 4-agent review 강제: `memory/feedback_4agent_review_before_admin_merge.md`
- admin-skip 정책: `memory/project_ci_admin_skip_until_2026-05-01.md`
