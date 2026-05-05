# syntax=docker/dockerfile:1.7

# Phase 24 — base: ghcr.io/actions/actions-runner (ARC chart 호환).
# Phase 23의 myoung34/github-runner 는 standalone runner 패턴 (auto-register
# entrypoint at /actions-runner/) — ARC gha-runner-scale-set@0.14.1 의
# listener pattern 과 비호환. 공식 image 는 /home/runner/run.sh + externals/
# + ENTRYPOINT 가 chart 가정과 일치.

FROM ubuntu:22.04 AS builder
SHELL ["/bin/bash", "-o", "pipefail", "-c"]
ARG GO_VERSION=1.25.0
ARG NODE_VERSION=20.18.0
ARG GOVULNCHECK_VERSION=1.3.0
ARG GOOSE_VERSION=3.27.0
ARG OSV_SCANNER_VERSION=2.3.5
ARG OSV_SCANNER_LINUX_AMD64_SHA256=bb30c580afe5e757d3e959f4afd08a4795ea505ef84c46962b9a738aa573b41b
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
      golang.org/x/vuln/cmd/govulncheck@v${GOVULNCHECK_VERSION} \
    && cp /root/go/bin/govulncheck /usr/local/bin/
RUN /opt/hostedtoolcache/go/${GO_VERSION}/x64/bin/go install \
      github.com/pressly/goose/v3/cmd/goose@v${GOOSE_VERSION} \
    && cp /root/go/bin/goose /usr/local/bin/
RUN curl -fsSL --retry 3 --retry-all-errors --connect-timeout 10 --max-time 120 \
      "https://github.com/google/osv-scanner/releases/download/v${OSV_SCANNER_VERSION}/osv-scanner_linux_amd64" \
      -o /usr/local/bin/osv-scanner \
    && echo "${OSV_SCANNER_LINUX_AMD64_SHA256}  /usr/local/bin/osv-scanner" | sha256sum -c - \
    && chmod 0755 /usr/local/bin/osv-scanner

FROM ghcr.io/actions/actions-runner:latest
ARG GO_VERSION=1.25.0
ARG NODE_VERSION=20.18.0
USER root

# Phase 23 OS deps (jq + Playwright runtime libs) + docker CLI (DinD 사이드카 통신)
RUN rm -f /etc/apt/sources.list.d/git-core-ubuntu-ppa*.list /etc/apt/sources.list.d/git-core-ubuntu-ppa*.sources \
    && apt-get update && apt-get install -y --no-install-recommends \
      jq libnss3 libnspr4 libatk1.0-0 libatk-bridge2.0-0 libatspi2.0-0 \
      libcups2 libdbus-1-3 libdrm2 libx11-6 libx11-xcb1 libxcb1 \
      libxcomposite1 libxdamage1 libxext6 libxfixes3 libxkbcommon0 \
      libxrandr2 libxrender1 libxshmfence1 libxtst6 libgbm1 \
      libgtk-3-0 libpango-1.0-0 libcairo2 libasound2t64 \
      fonts-liberation fonts-noto-color-emoji fonts-unifont xdg-utils \
      build-essential \
      ca-certificates curl gnupg git \
    && install -m 0755 -d /etc/apt/keyrings \
    && curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg \
    && chmod a+r /etc/apt/keyrings/docker.gpg \
    && echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo $VERSION_CODENAME) stable" \
       > /etc/apt/sources.list.d/docker.list \
    && apt-get update \
    && apt-get install -y --no-install-recommends docker-ce-cli docker-buildx-plugin \
    && mkdir -p /opt/mmp-runner \
    && printf '%s\n' "chromium-webkit-system-deps" > /opt/mmp-runner/playwright-deps-ready \
    && rm -rf /var/lib/apt/lists/*

# Phase 23 hostedtoolcache (Go 1.25 + Node 20.18) + image-resident CLIs.
COPY --from=builder /opt/hostedtoolcache /opt/hostedtoolcache
COPY --from=builder /usr/local/bin/govulncheck /usr/local/bin/govulncheck
COPY --from=builder /usr/local/bin/goose /usr/local/bin/goose
COPY --from=builder /usr/local/bin/osv-scanner /usr/local/bin/osv-scanner

# Phase 23 cleanup hook (EPHEMERAL fs 잔존 정리 — myoung34 잔재이지만 ARC도 호환)
COPY --chmod=0755 infra/runners/hooks/job-started.sh /opt/runner-hooks/job-started.sh
ENV ACTIONS_RUNNER_HOOK_JOB_STARTED=/opt/runner-hooks/job-started.sh

# PR #176 image-resident toolchain — setup-go/setup-node 의 GHA cache 다운로드 차단.
# named volume mount (compose) 와 결합해 매 run 의 GOMODCACHE/GOCACHE/PNPM_STORE 다운로드 0.
ENV PATH=/opt/hostedtoolcache/go/${GO_VERSION}/x64/bin:/opt/hostedtoolcache/node/${NODE_VERSION}/x64/bin:${PATH}
ENV GOTOOLCHAIN=local
ENV GOPATH=/home/runner/go
ENV GOMODCACHE=/home/runner/go/pkg/mod
ENV GOCACHE=/home/runner/.cache/go-build
ENV PNPM_STORE_PATH=/home/runner/.pnpm-store
RUN mkdir -p /home/runner/go/pkg/mod /home/runner/.cache/go-build /home/runner/.pnpm-store \
    && chown -R runner:runner /home/runner/go /home/runner/.cache /home/runner/.pnpm-store

# Pre-bake apps/server Go module deps — go.sum 변경 시 image rebuild (paths filter trigger).
# Node monorepo deps 는 named volume only (image 비대 회피).
USER runner
COPY --chown=runner:runner apps/server/go.mod apps/server/go.sum /tmp/prebake/
RUN cd /tmp/prebake && go mod download
USER root
RUN rm -rf /tmp/prebake

USER runner
