# syntax=docker/dockerfile:1.7

FROM mcr.microsoft.com/playwright:v1.59.1-noble

ARG GO_VERSION=1.25.0
ARG NODE_VERSION=20.18.0
ARG GOLANGCI_LINT_VERSION=2.11.4
ARG GOOSE_VERSION=3.27.0
ARG TARGETARCH

SHELL ["/bin/bash", "-o", "pipefail", "-c"]

USER root

RUN apt-get update && apt-get install -y --no-install-recommends \
      ca-certificates curl git jq postgresql-client redis-tools \
      build-essential docker.io \
    && rm -rf /var/lib/apt/lists/*

RUN case "${TARGETARCH}" in \
      amd64) go_arch=amd64 ;; \
      arm64) go_arch=arm64 ;; \
      *) echo "unsupported TARGETARCH=${TARGETARCH}" >&2; exit 1 ;; \
    esac \
    && curl -fsSL "https://go.dev/dl/go${GO_VERSION}.linux-${go_arch}.tar.gz" \
      | tar -xzf - -C /usr/local \
    && ln -sf /usr/local/go/bin/go /usr/local/bin/go \
    && ln -sf /usr/local/go/bin/gofmt /usr/local/bin/gofmt

RUN mkdir -p /opt/node \
    && case "${TARGETARCH}" in \
      amd64) node_arch=x64 ;; \
      arm64) node_arch=arm64 ;; \
      *) echo "unsupported TARGETARCH=${TARGETARCH}" >&2; exit 1 ;; \
    esac \
    && curl -fsSL "https://nodejs.org/dist/v${NODE_VERSION}/node-v${NODE_VERSION}-linux-${node_arch}.tar.xz" \
      | tar -xJf - -C /opt/node --strip-components=1

ENV GOTOOLCHAIN=local
ENV GOPATH=/go
ENV GOMODCACHE=/go/pkg/mod
ENV GOCACHE=/go-build-cache
ENV PNPM_HOME=/pnpm
ENV PNPM_STORE_PATH=/pnpm-store
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright
ENV PATH=/usr/local/go/bin:/go/bin:/opt/node/bin:/pnpm:${PATH}

RUN mkdir -p /go/pkg/mod /go-build-cache /pnpm /pnpm-store /workspace \
    && npm install -g pnpm@9.15.4 \
    && go install github.com/pressly/goose/v3/cmd/goose@v${GOOSE_VERSION} \
    && curl -fsSL \
      "https://raw.githubusercontent.com/golangci/golangci-lint/master/install.sh" \
      | sh -s -- -b /usr/local/bin "v${GOLANGCI_LINT_VERSION}"

WORKDIR /workspace

CMD ["bash"]
