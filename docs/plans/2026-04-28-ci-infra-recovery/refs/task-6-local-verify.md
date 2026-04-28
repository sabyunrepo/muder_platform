# Task 6 — 로컬 dev compose 회귀 검증

**Files:** (검증 only — 새 commit 없음)

**근거:** Task 1+2 변경 후 dev compose가 정상 시작 + air hot-reload 동작 + 호스트 측 파일 권한 정상인지 확인. CI 머지 후 개발자 onboarding 부담 0 보장.

- [ ] **Step 6.1: clean state로 시작**

Run:
```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml down -v 2>&1 || true
rm -rf apps/server/tmp/* 2>&1 || true
docker image rm mmp-server-dev:test 2>&1 || true
```

- [ ] **Step 6.2: dev 컨테이너 띄우기**

Run:
```bash
HOST_UID=$(id -u) HOST_GID=$(id -g) \
  docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d --build server
```
Expected: 에러 없이 컨테이너 3개(server, postgres, redis) 시작.

- [ ] **Step 6.3: air hot-reload 검증**

Run:
```bash
sleep 10
docker compose -f docker-compose.yml -f docker-compose.dev.yml logs server | tail -20
ls -la apps/server/tmp/
```
Expected:
- log에 `building...`, `running...` 메시지
- `apps/server/tmp/main` 파일 존재 + owner = 호스트 사용자 (`sabyun` 등)
- `apps/server/tmp/build-errors.log` 존재 (빈 파일도 OK) + owner = 호스트 사용자

- [ ] **Step 6.4: server health check**

Run:
```bash
curl -sf http://localhost:8080/health
```
Expected: 200 OK (예: `{"status":"ok"}`).

- [ ] **Step 6.5: cleanup**

Run:
```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml down -v
rm -rf apps/server/tmp/*
```

- [ ] **Step 6.6: prod compose 회귀 보장 (옵션, ~30s)**

Run:
```bash
docker compose -f docker-compose.yml up -d 2>&1 | head -5
docker compose -f docker-compose.yml ps
docker compose -f docker-compose.yml down
```
Expected: 에러 없이 prod compose 시작. `Dockerfile`(non-dev) 그대로라 영향 없음 확인.
