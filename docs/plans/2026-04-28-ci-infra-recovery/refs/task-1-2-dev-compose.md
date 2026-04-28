# Task 1+2 — Dev Compose UID/GID 매칭

## Task 1: Dockerfile.dev — 호스트 UID/GID 매칭 user 도입

**Files:**
- Modify: `apps/server/Dockerfile.dev` (전체 9줄 → ~16줄)

**근거:** Dockerfile.dev는 air hot-reload용 dev 전용. air가 만드는 `tmp/main` + `tmp/build-errors.log` 파일이 호스트 bindmount에 root 소유로 남아 다음 CI checkout이 unlink 실패. ARG로 호스트 UID 받아 매칭 user 생성하면 같은 owner로 파일 생성 → 호스트 자유롭게 정리 가능.

- [ ] **Step 1.1: 변경 내용 작성**

`apps/server/Dockerfile.dev`:
```dockerfile
# Development Dockerfile with air hot-reload
FROM golang:1.25-alpine

# Host UID/GID alignment — prevents root-owned files in bindmounted apps/server/.
# Defaults match common Linux dev environments; override via build args.
ARG USER_UID=1000
ARG USER_GID=1000

RUN addgroup -g ${USER_GID} -S appuser \
 && adduser -u ${USER_UID} -G appuser -S -h /home/appuser -s /bin/sh appuser

RUN go install github.com/air-verse/air@latest
WORKDIR /build

COPY go.mod go.sum ./
RUN go mod download
COPY . .

# air는 /build 안 tmp/ 에 binary + log 작성 — 그 디렉토리도 appuser 소유 필요
RUN mkdir -p /build/tmp && chown -R ${USER_UID}:${USER_GID} /build /go /home/appuser

USER appuser
EXPOSE 8080 9090
CMD ["air", "-c", ".air.toml"]
```

**주의:**
- `golang:1.25-alpine`은 `addgroup`/`adduser` (busybox) — `useradd`/`groupadd`(Debian) 아님
- `chown -R /go`로 `go install ~/go/bin/air` 보존
- bindmount로 덮히는 `/build` 자체는 호스트 권한 따라감

- [ ] **Step 1.2: 로컬 빌드 검증**

Run:
```bash
HOST_UID=$(id -u) HOST_GID=$(id -g) \
docker build --build-arg USER_UID=$HOST_UID --build-arg USER_GID=$HOST_GID \
  -t mmp-server-dev:test apps/server -f apps/server/Dockerfile.dev
docker image inspect mmp-server-dev:test --format '{{.Config.User}}'
```
Expected: `Successfully built` + `appuser`.

- [ ] **Step 1.3: 컨테이너 실행 + 파일 권한 검증**

Run:
```bash
docker run --rm -v "$(pwd)/apps/server:/build" mmp-server-dev:test \
  sh -c 'mkdir -p /build/tmp && touch /build/tmp/.permtest && id -u && id -g && stat -c "%u:%g" /build/tmp/.permtest'
ls -la apps/server/tmp/.permtest
rm apps/server/tmp/.permtest
```
Expected: `id -u`/`id -g`/`stat`이 호스트 사용자 UID와 일치. `ls -la`에서 owner = 사용자명.

- [ ] **Step 1.4: commit**

```bash
git add apps/server/Dockerfile.dev
git commit -m "$(cat <<'EOF'
fix(ci-infra): Dockerfile.dev — non-root user matching host UID

ARG USER_UID/USER_GID로 호스트 UID/GID 매칭 non-root appuser 생성. air가
/build/tmp/에 만드는 file이 호스트 bindmount에서 같은 owner로 보임 → CI
checkout cleanup EACCES 차단.

기본값 1000:1000은 일반 Linux dev 환경 default와 일치.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: docker-compose.dev.yml — HOST_UID/HOST_GID 주입

**Files:**
- Modify: `docker-compose.dev.yml` (root, 28줄 → ~35줄)

**근거:** Task 1의 ARG는 build-time. compose에서 `build.args` 전달 + runtime `user:`로 컨테이너 프로세스 UID 강제. 두 단계 모두 적용해야 hot-reload가 *추가로 만드는* 파일까지 같은 owner 보장.

- [ ] **Step 2.1: 변경 내용 작성**

`docker-compose.dev.yml`:
```yaml
# Development override — use with: docker compose -f docker-compose.yml -f docker-compose.dev.yml up
# Dev mode: DB/Redis/Server만 실행, 프론트는 Vite dev server 사용
#
# IMPORTANT: HOST_UID/HOST_GID env vars must be set BEFORE running compose,
# otherwise files created in apps/server/tmp/ will be root-owned and break
# CI checkout cleanup. See apps/server/CLAUDE.md for the canonical command.
services:
  server:
    build:
      context: ./apps/server
      dockerfile: Dockerfile.dev
      args:
        USER_UID: "${HOST_UID:-1000}"
        USER_GID: "${HOST_GID:-1000}"
    user: "${HOST_UID:-1000}:${HOST_GID:-1000}"
    ports:
      - "8080:8080"
      - "9090:9090"
    volumes:
      - ./apps/server:/build
    environment:
      APP_ENV: development

  postgres:
    ports:
      - "5432:5432"

  redis:
    ports:
      - "6379:6379"

  # 개발 시 프론트는 Vite dev server 사용하므로 web 서비스 비활성화
  web:
    profiles:
      - disabled
```

- [ ] **Step 2.2: dev 컨테이너 띄우기 검증**

Run:
```bash
HOST_UID=$(id -u) HOST_GID=$(id -g) \
  docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d --build server
sleep 5
docker compose -f docker-compose.yml -f docker-compose.dev.yml exec server id -u
docker compose -f docker-compose.yml -f docker-compose.dev.yml down
```
Expected: `id -u` 출력 = 호스트 사용자 UID (Linux 1000, Mac 501 등).

- [ ] **Step 2.3: 호스트 측 air 산출물 권한 확인**

dev 띄운 후 air 사이클 1회 후 `apps/server/tmp/main` + `apps/server/tmp/build-errors.log` 생성.
Run:
```bash
ls -la apps/server/tmp/
```
Expected: owner 컬럼이 호스트 사용자명 (`sabyun` 등) — root 아님.

- [ ] **Step 2.4: cleanup + commit**

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml down -v
rm -rf apps/server/tmp/*
git add docker-compose.dev.yml
git commit -m "$(cat <<'EOF'
fix(ci-infra): docker-compose.dev.yml — pass HOST_UID/HOST_GID

build.args + runtime user 두 단계로 호스트 UID/GID 주입. apps/server/tmp/에
air가 만드는 파일이 host user 소유로 생성되어 CI runner의 checkout cleanup
에서 unlink 가능 (root 소유 차단).

미설정 fallback 1000:1000 — 대부분 Linux dev 환경 기본값. 명시 사용법은
apps/server/CLAUDE.md에 추가 (Task 5).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```
