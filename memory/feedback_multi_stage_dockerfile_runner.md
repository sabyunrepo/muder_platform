# self-hosted runner용 multi-stage Dockerfile 패턴

> Phase 23 (`memory/sessions/2026-04-29-phase-23-custom-runner-image-merge.md`)에서 정착된 카논. 본 패턴은 보안 표면 축소 + GHA cache 효율 + base image 호환성을 동시 만족.

## 정공 패턴

```dockerfile
# syntax=docker/dockerfile:1.7
FROM ubuntu:22.04 AS builder
SHELL ["/bin/bash", "-o", "pipefail", "-c"]
ARG GO_VERSION=1.25.0
ARG NODE_VERSION=20.18.0
RUN apt-get update && apt-get install -y --no-install-recommends \
      curl ca-certificates xz-utils \
    && rm -rf /var/lib/apt/lists/*
# Go/Node tarball download → /opt/hostedtoolcache 호환 위치
RUN mkdir -p /opt/hostedtoolcache/go/${GO_VERSION}/x64 \
    && curl -fsSL "https://go.dev/dl/go${GO_VERSION}.linux-amd64.tar.gz" \
       | tar -xzf - -C /opt/hostedtoolcache/go/${GO_VERSION}/x64 --strip-components=1 \
    && touch /opt/hostedtoolcache/go/${GO_VERSION}/x64.complete
# 추가 install 도구는 builder stage에 한정 (curl/xz 등 final image에 미crossing)

FROM <base>@sha256:<digest>   # 예: myoung34/github-runner@sha256:85a7a6a...
USER root
RUN apt-get update && apt-get install -y --no-install-recommends \
      <runtime-only-deps> \
    && rm -rf /var/lib/apt/lists/*
COPY --from=builder /opt/hostedtoolcache /opt/hostedtoolcache
COPY --chmod=0755 <hooks-or-scripts> <dest>
ENV <runtime-vars>
USER <runtime-user>   # base image 표준 (myoung34 = runner)
```

## 카논 항목

1. **builder stage = ubuntu:22.04** — apt-get + curl + tarball download + install. final image 미crossing.
2. **final stage = base@sha256 pin** — Renovate가 추적 (Phase 18.7 카논). myoung34 runner 등 special-purpose base.
3. **`SHELL pipefail` 추가** — `curl ... | tar -xzf -` 패턴의 silent failure 방어 (DL4006).
4. **`COPY --chmod=0755`** — script permission 명시. RUN chmod 별 layer 절감.
5. **`COPY --from=builder /opt/hostedtoolcache`** — `actions/setup-go/setup-node`의 `RUNNER_TOOL_CACHE` 호환 위치. `.complete` 마커 필수.
6. **govulncheck/jq 등 사전 install** — workflow의 우회 step (apt-get install jq, govulncheck@latest install 등)이 dead code됨.
7. **docker GID 990 정착** — `groupadd -g 990 docker-host` + `usermod -aG docker-host runner`. user CI workflow의 `sudo docker` prefix가 dead code됨.
8. **cleanup hook** — `ACTIONS_RUNNER_HOOK_JOB_STARTED` ENV로 EPHEMERAL fs 잔존 정공.

## Anti-pattern

- ❌ `apt-get install` + `rm -rf /var/lib/apt/lists/*` 분리된 RUN — 같은 layer 묶음 (DL3009 + 크기 효율).
- ❌ `--no-install-recommends` 누락 (DL3015) — 불필요한 deps 누적.
- ❌ `RUN chmod +x` 별 layer (`COPY --chmod=0755`로 collapse).
- ❌ govulncheck@latest 또는 ubuntu:22.04 floating tag (Renovate 추적 X) — version pin 권장. 본 카논의 P1 follow-up.

## 카논 ref

- `infra/runners/Dockerfile` (Phase 23 정착)
- `docs/superpowers/specs/2026-04-29-phase-23-custom-runner-image-design.md` § 4.1
- `memory/feedback_runner_bootstrap.md` (chicken-egg sister 카논)
- `memory/feedback_ghcr_self_hosted_bootstrap.md` (GHCR push sister 카논)
- Phase 18.7 SHA pinning 카논
