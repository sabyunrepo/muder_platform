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
