# Wave 1 — Image Build Infrastructure

> 부모: [checklist.md](../checklist.md) | 이전: [Wave 0](wave-0-setup.md) | 다음: [Wave 2](wave-2-compose-readme.md)

## Task 1: cleanup hook script + bash unit test (TDD)

**Files:**
- Create: `infra/runners/hooks/job-started.sh`
- Create: `infra/runners/hooks/job-started.test.sh`

- [ ] **Step 1: 실패 test 먼저 작성 (`job-started.test.sh`)**

```bash
#!/usr/bin/env bash
# bash unit test for job-started.sh — verifies cleanup hook behavior.
set -euo pipefail

THIS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
HOOK="${THIS_DIR}/job-started.sh"

# 임시 HOME 픽스처
TMP_HOME="$(mktemp -d)"
trap 'rm -rf "$TMP_HOME"' EXIT
mkdir -p "$TMP_HOME/go/pkg/mod/dummy" "$TMP_HOME/.cache/go-build/dummy"
touch "$TMP_HOME/go/pkg/mod/dummy/file" "$TMP_HOME/.cache/go-build/dummy/file"

HOME="$TMP_HOME" bash "$HOOK"

# Assert: 두 디렉토리 비었음
[ -z "$(ls -A "$TMP_HOME/go/pkg/mod" 2>/dev/null)" ] || { echo "FAIL: go/pkg/mod not cleaned"; exit 1; }
[ -z "$(ls -A "$TMP_HOME/.cache/go-build" 2>/dev/null)" ] || { echo "FAIL: .cache/go-build not cleaned"; exit 1; }

# Assert: 빈 디렉토리 재생성됨 (setup-go가 기대)
[ -d "$TMP_HOME/go/pkg/mod" ] || { echo "FAIL: go/pkg/mod not recreated"; exit 1; }
[ -d "$TMP_HOME/.cache/go-build" ] || { echo "FAIL: .cache/go-build not recreated"; exit 1; }

echo "PASS: job-started.sh cleanup correct"
```

- [ ] **Step 2: test 실행 → 실패 확인**

```bash
chmod +x infra/runners/hooks/job-started.test.sh
bash infra/runners/hooks/job-started.test.sh
# Expected: bash: infra/runners/hooks/job-started.sh: No such file or directory
```

- [ ] **Step 3: hook script 작성 (`job-started.sh`)**

```bash
#!/usr/bin/env bash
# ACTIONS_RUNNER_HOOK_JOB_STARTED — 매 job 시작 직전 fire.
# myoung34 EPHEMERAL=true가 file system reset 안 함에 대한 정공.
set -euo pipefail
rm -rf "${HOME}/go/pkg/mod" "${HOME}/.cache/go-build" 2>/dev/null || true
mkdir -p "${HOME}/go/pkg/mod" "${HOME}/.cache/go-build"
```

- [ ] **Step 4: chmod + test 재실행 → 통과 확인**

```bash
chmod +x infra/runners/hooks/job-started.sh
bash infra/runners/hooks/job-started.test.sh
# Expected: PASS: job-started.sh cleanup correct
```

- [ ] **Step 5: commit**

```bash
git add infra/runners/hooks/job-started.sh infra/runners/hooks/job-started.test.sh
git commit -m "feat(phase-23): cleanup hook script + bash unit test"
```

---

## Task 2: Dockerfile multi-stage

**Files:**
- Create: `infra/runners/Dockerfile`

코드 카논: Spec 4.1 (`docs/superpowers/specs/2026-04-29-phase-23-custom-runner-image-design.md` Section 4.1)에 multi-stage 전체 정의. plan에서는 핵심 구조만 inline 인용. drift 시 spec 우선.

- [ ] **Step 1: Dockerfile 작성** (Spec 4.1 카논 그대로)

```dockerfile
# syntax=docker/dockerfile:1.7
FROM ubuntu:22.04 AS builder
ARG GO_VERSION=1.25.0
ARG NODE_VERSION=20.18.0
RUN apt-get update && apt-get install -y --no-install-recommends \
      curl ca-certificates xz-utils \
    && rm -rf /var/lib/apt/lists/*
RUN mkdir -p /opt/hostedtoolcache/go/${GO_VERSION}/x64 \
    && curl -fsSL "https://go.dev/dl/go${GO_VERSION}.linux-amd64.tar.gz" \
       | tar -xzf - -C /opt/hostedtoolcache/go/${GO_VERSION}/x64 --strip-components=1 \
    && touch /opt/hostedtoolcache/go/${GO_VERSION}/x64.complete
RUN mkdir -p /opt/hostedtoolcache/node/${NODE_VERSION}/x64 \
    && curl -fsSL "https://nodejs.org/dist/v${NODE_VERSION}/node-v${NODE_VERSION}-linux-x64.tar.xz" \
       | tar -xJf - -C /opt/hostedtoolcache/node/${NODE_VERSION}/x64 --strip-components=1 \
    && touch /opt/hostedtoolcache/node/${NODE_VERSION}/x64.complete
RUN /opt/hostedtoolcache/go/${GO_VERSION}/x64/bin/go install \
      golang.org/x/vuln/cmd/govulncheck@latest \
    && cp /root/go/bin/govulncheck /usr/local/bin/

FROM myoung34/github-runner@sha256:85a7a6a73abd0c0e679ea315b0e773c4a118315e21f47c864041ae6d73d21ea3
USER root
RUN apt-get update && apt-get install -y --no-install-recommends \
      jq libnss3 libnspr4 libatk1.0-0 libatk-bridge2.0-0 libcups2 \
      libdrm2 libxkbcommon0 libxcomposite1 libxdamage1 libxfixes3 \
      libxrandr2 libgbm1 libpango-1.0-0 libcairo2 libasound2 \
    && rm -rf /var/lib/apt/lists/*
COPY --from=builder /opt/hostedtoolcache /opt/hostedtoolcache
COPY --from=builder /usr/local/bin/govulncheck /usr/local/bin/govulncheck
RUN groupadd -g 990 docker-host 2>/dev/null || true \
    && usermod -aG docker-host runner
COPY infra/runners/hooks/job-started.sh /opt/runner-hooks/job-started.sh
RUN chmod +x /opt/runner-hooks/job-started.sh
ENV ACTIONS_RUNNER_HOOK_JOB_STARTED=/opt/runner-hooks/job-started.sh
USER runner
```

- [ ] **Step 2: 로컬 docker build syntax check**

```bash
docker buildx build --no-cache --load \
  --platform linux/amd64 \
  -f infra/runners/Dockerfile \
  -t mmp-runner:local-test \
  .
# Expected: build complete, image local 등재
```

> 사용자 dev (Apple Silicon)에서 amd64 emulation으로 느릴 수 있음. 본 step skip하고 PR CI에 위임 가능 (옵션 C carry).

- [ ] **Step 3: ad-hoc 컨테이너 검증** (로컬 빌드한 경우만)

```bash
docker run --rm --entrypoint /bin/bash mmp-runner:local-test \
  -c 'jq --version && govulncheck -version && ls /opt/hostedtoolcache/go/1.25.0/x64/bin/go && ls /opt/hostedtoolcache/node/20.18.0/x64/bin/node && [ -f /opt/runner-hooks/job-started.sh ]'
# Expected: 각 binary 정상 + hook script 존재
```

- [ ] **Step 4: cleanup hook fire 검증** (Spec 7.1 카논)

```bash
docker run --rm --entrypoint /bin/bash mmp-runner:local-test -c '
  set -euo pipefail
  mkdir -p ~/go/pkg/mod/dummy
  touch ~/go/pkg/mod/dummy/file
  bash /opt/runner-hooks/job-started.sh
  [ -z "$(ls -A ~/go/pkg/mod 2>/dev/null)" ] || (echo "FAIL: go pkg mod not cleaned" && exit 1)
  echo PASS
'
# Expected: PASS
```

- [ ] **Step 5: commit**

```bash
git add infra/runners/Dockerfile
git commit -m "feat(phase-23): multi-stage Dockerfile (Go 1.25 + Node 20 + cleanup hook)"
```

---

## Task 3: build-runner-image.yml

**Files:**
- Create: `.github/workflows/build-runner-image.yml`

- [ ] **Step 1: workflow 작성** (Spec 4.3 카논 그대로)

```yaml
name: Build Runner Image
on:
  push:
    branches: [main]
    paths:
      - 'infra/runners/Dockerfile'
      - 'infra/runners/hooks/**'
      - '.github/workflows/build-runner-image.yml'
  pull_request:
    paths:
      - 'infra/runners/Dockerfile'
      - 'infra/runners/hooks/**'
      - '.github/workflows/build-runner-image.yml'

permissions:
  contents: read
  packages: write

jobs:
  build:
    runs-on: [self-hosted, containerized]
    steps:
      - uses: actions/checkout@v4
      - uses: docker/setup-buildx-action@v3
      - name: Login to GHCR
        if: github.event_name == 'push'
        uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}
      - name: Build image
        uses: docker/build-push-action@v5
        with:
          context: .
          file: infra/runners/Dockerfile
          push: ${{ github.event_name == 'push' }}
          tags: |
            ghcr.io/sabyunrepo/mmp-runner:latest
            ghcr.io/sabyunrepo/mmp-runner:${{ github.sha }}
          cache-from: type=gha
          cache-to: type=gha,mode=max
          load: ${{ github.event_name == 'pull_request' }}
      - name: Verify cleanup hook fires
        if: github.event_name == 'pull_request'
        run: |
          docker run --rm --entrypoint /bin/bash \
            ghcr.io/sabyunrepo/mmp-runner:${{ github.sha }} \
            -c '
              set -euo pipefail
              jq --version
              govulncheck -version
              ls /opt/hostedtoolcache/go/1.25.0/x64/bin/go
              ls /opt/hostedtoolcache/node/20.18.0/x64/bin/node
              mkdir -p ~/go/pkg/mod/dummy
              touch ~/go/pkg/mod/dummy/file
              bash /opt/runner-hooks/job-started.sh
              [ -z "$(ls -A ~/go/pkg/mod 2>/dev/null)" ] || (echo "FAIL: go pkg mod not cleaned" && exit 1)
              echo "PASS: cleanup hook works"
            '
```

- [ ] **Step 2: yaml syntax check**

```bash
# 로컬 yamllint 또는 actionlint
yamllint .github/workflows/build-runner-image.yml || true
actionlint .github/workflows/build-runner-image.yml || true
# 도구 부재 시 PR CI의 자동 actionlint에 의존
```

- [ ] **Step 3: commit**

```bash
git add .github/workflows/build-runner-image.yml
git commit -m "feat(phase-23): GHCR build CI workflow (PR verify + main push)"
```
