# Wave 2 — Compose + README

> 부모: [checklist.md](../checklist.md) | 이전: [Wave 1](wave-1-image-build.md) | 다음: [Wave 3](wave-3-workflow-cleanup.md)

## Task 4: docker-compose.yml 수정

**Files:**
- Modify: `infra/runners/docker-compose.yml`

- [ ] **Step 1: image + pull_policy 변경**

`x-runner-base` 블록의 image/pull_policy 2줄 patch:
```diff
-  image: myoung34/github-runner@sha256:85a7a6a73abd0c0e679ea315b0e773c4a118315e21f47c864041ae6d73d21ea3
-  pull_policy: never
+  image: ghcr.io/sabyunrepo/mmp-runner:latest
+  pull_policy: always
```

`docker-compose.yml`의 anchor `*runner-base` 1곳만 변경 (4 service 모두 자동 적용).

- [ ] **Step 2: docker compose config 검증**

```bash
cd infra/runners
docker compose config | head -30
# Expected: image: ghcr.io/sabyunrepo/mmp-runner:latest 표시
cd -
```

- [ ] **Step 3: commit**

```bash
git add infra/runners/docker-compose.yml
git commit -m "chore(phase-23): switch compose to GHCR Custom Image"
```

---

## Task 5: README.md 갱신

**Files:**
- Modify: `infra/runners/README.md`

- [ ] **Step 1: Custom Image 섹션 추가** (`Bootstrap` 섹션 위)

```markdown
## Custom Image (Phase 23+)

이 pool은 **`ghcr.io/sabyunrepo/mmp-runner` Custom Image**로 가동합니다 (myoung34 base 직접 사용 X). 정공:

- 사전 install: jq, govulncheck, Go 1.25, Node 20, Playwright deps
- docker GID 990 정착 (testcontainers-go + Trivy 자연 권한)
- `ACTIONS_RUNNER_HOOK_JOB_STARTED` cleanup script (EPHEMERAL fs 잔존 정공)

이미지 빌드는 `.github/workflows/build-runner-image.yml`이 main 머지 시 자동 push. visibility = Public (사용자 host pull 인증 0건).

### GHCR 첫 push 후 1회 운영 절차

1. https://github.com/sabyunrepo/packages/container/mmp-runner/settings → "Manage Actions access" → `muder_platform` add
2. visibility → Public (image에 secret 없음)

### 사용자 host 재배포 (main 머지 후)

```bash
ssh sabyun@100.90.38.7
cd ~/muder_platform/infra/runners
git pull
docker compose pull
docker compose up -d
docker compose ps  # 4 service Started
```

### Rollback (재배포 후 광범위 fail 시)

```bash
git revert <Phase 23 commit>  # compose.yml만 되돌림
docker compose pull
docker compose up -d
# ~5분 내 myoung34 base 또는 직전 GHCR sha tag로 복귀
```

### Verification (재배포 후)

```bash
# 컨테이너 부팅
docker logs containerized-runner-1 2>&1 | head -50 | grep -i "Listening for Jobs"

# 사전 install 검증
docker exec containerized-runner-1 bash -c '
  jq --version
  govulncheck -version
  /opt/hostedtoolcache/go/1.25.0/x64/bin/go version
  /opt/hostedtoolcache/node/20.18.0/x64/bin/node --version
  echo "ACTIONS_RUNNER_HOOK_JOB_STARTED=$ACTIONS_RUNNER_HOOK_JOB_STARTED"
'

# GitHub Settings → Actions → Runners → 4 idle 확인
```
```

- [ ] **Step 2: 기존 Bootstrap 섹션의 image pull 절차 갱신** (Step 5 영역)

기존:
```bash
# 5. **Image pull (최초 1회 필수)** — `pull_policy: never` + digest pinning ...
IMAGE=$(grep -E 'image:' docker-compose.yml | head -1 | awk '{print $2}')
docker pull "$IMAGE"
```

→ 갱신:
```bash
# 5. **Image pull (Phase 23+ Custom Image)** — `pull_policy: always` 라 compose up이 자동 pull.
#    그러나 첫 부팅 또는 GHCR 권한 검증을 위해 manual pull 권장:
docker compose pull
```

- [ ] **Step 3: commit**

```bash
git add infra/runners/README.md
git commit -m "docs(phase-23): README Custom Image 섹션 + GHCR 운영 절차"
```
