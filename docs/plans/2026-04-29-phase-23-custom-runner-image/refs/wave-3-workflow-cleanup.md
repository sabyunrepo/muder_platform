# Wave 3 — 9 workflow Dead Code 정리 (Fold-In)

> 부모: [checklist.md](../checklist.md) | 이전: [Wave 2](wave-2-compose-readme.md) | 다음: [Wave 4](wave-4-pr.md)

## Task 6: ci.yml 정리

**Files:**
- Modify: `.github/workflows/ci.yml`

대상 변경 (line 번호는 변경 시점 git blame으로 재확인):

| 변경 | line 영역 (현 main 기준) | 이유 |
|------|----------|------|
| `sudo docker network ls` → `docker network ls` (등 docker 명령들 in Start postgres+redis 영역) | 44, 47, 54, 56, 67, 79, 80, 89, 90, 198 | docker GID 990 정착 |
| `sudo -E env "PATH=$PATH" go test` → `go test` | 164 | testcontainers-go 자연 권한 |
| `Fix coverage.out ownership` step 제거 | 168-169 | RUN_AS_ROOT=false + group_add docker-host로 자동 |
| `Ensure jq installed` step 제거 (`if ! command -v jq...`) | 315-325 | base에 jq 사전 install |
| `Build Docker image (manual via sudo docker)` step → 일반 `docker build` (또는 `docker/build-push-action@v5` 마이그) | 380-400 | docker GID 990 정착 |

- [ ] **Step 1: Edit tool 다중 patch**

각 영역별 sudo 제거 + step 삭제. 각 patch는 작은 단위로 (대규모 search/replace는 의도치 않은 매칭 위험).

- [ ] **Step 2: yaml syntax + actionlint 검증**

```bash
actionlint .github/workflows/ci.yml || true
# 또는 PR CI의 자동 actionlint에 의존
```

- [ ] **Step 3: commit**

```bash
git add .github/workflows/ci.yml
git commit -m "chore(phase-23): ci.yml — sudo docker/go test 제거 + jq install 제거"
```

---

## Task 7: security-deep.yml CodeQL 정리

**Files:**
- Modify: `.github/workflows/security-deep.yml` (CodeQL javascript-typescript matrix 영역, 현 main 기준 line 143-162)

- [ ] **Step 1: setup-node@v4 + symlink override step 제거**

제거 대상 (현 main 인용):
```yaml
- uses: actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020 # v4.4.0
  with:
    node-version: 20

- name: Override system node with setup-node v20 binary
  run: |
    NODE_BIN=$(which node)
    NPM_BIN=$(which npm)
    echo "setup-node node: $NODE_BIN ($(node --version))"
    sudo ln -sf "$NODE_BIN" /usr/local/bin/node
    sudo ln -sf "$NPM_BIN" /usr/local/bin/npm
```

base image에 Node v20 사전 install되어 system PATH에 노출되므로 setup-node 자체 불필요. CodeQL action의 spawn child process가 `which node`로 자연 resolve.

- [ ] **Step 2: commit**

```bash
git add .github/workflows/security-deep.yml
git commit -m "chore(phase-23): security-deep CodeQL setup-node + symlink override 제거"
```

---

## Task 8: security-deep.yml Trivy 정리 + #2 fold-in

**Files:**
- Modify: `.github/workflows/security-deep.yml` (Trivy job, 현 main 기준 line 36-52)

- [ ] **Step 1: sudo docker build/save/chown → 일반 docker**

```yaml
# 변경 전 (line 42-52):
- name: Build server image + save tarball (manual via sudo docker)
  run: |
    sudo docker build \
      -t mmp-server:security-scan \
      -f apps/server/Dockerfile \
      apps/server
    sudo docker save mmp-server:security-scan -o /tmp/mmp-server.tar
    sudo chown "$(id -u):$(id -g)" /tmp/mmp-server.tar

# 변경 후 (sudo 제거 + chown 제거):
- name: Build server image + save tarball
  run: |
    docker build \
      -t mmp-server:security-scan \
      -f apps/server/Dockerfile \
      apps/server
    docker save mmp-server:security-scan -o /tmp/mmp-server.tar
```

docker GID 990 정착으로 `runner` user가 docker.sock 직접 접근 가능 → sudo 불필요. tarball 소유권도 자연 정상.

- [ ] **Step 2: image cleanup step 추가 (#2 fold-in, Sec-MED-3)**

Trivy job 마지막 step (현 마지막 step 또는 trivy scan step 직후)에:
```yaml
- name: Cleanup security-scan image
  if: always()
  run: docker rmi mmp-server:security-scan 2>/dev/null || true
```

`if: always()`로 scan 성공/실패 무관 cleanup.

- [ ] **Step 3: commit**

```bash
git add .github/workflows/security-deep.yml
git commit -m "chore(phase-23): Trivy sudo docker 제거 + image cleanup 1줄 (Sec-MED-3 #2)"
```

---

## Task 9: security-fast.yml gitleaks #3 fold-in

**Files:**
- Modify: `.github/workflows/security-fast.yml` (현 main 기준 line 76)

- [ ] **Step 1: GITLEAKS_ENABLE_UPLOAD_ARTIFACT env 제거**

```yaml
# 변경 전 (env 블록 내):
GITLEAKS_CONFIG: .gitleaks.toml
GITLEAKS_ENABLE_COMMENTS: false
GITLEAKS_ENABLE_UPLOAD_ARTIFACT: false  # ← 이 줄 삭제
GITLEAKS_ENABLE_SUMMARY: true

# 변경 후 (gitleaks default = artifact upload 활성):
GITLEAKS_CONFIG: .gitleaks.toml
GITLEAKS_ENABLE_COMMENTS: false
GITLEAKS_ENABLE_SUMMARY: true
```

> **Verify**: 본 PR 머지 + 사용자 host 재배포 후 첫 CI run에서 artifact upload 실 동작 확인. fail 시 즉시 hotfix (`GITLEAKS_ENABLE_UPLOAD_ARTIFACT: false` 복원) + #3 follow-up PR (SARIF/upload 메커니즘 재설계).

- [ ] **Step 2: commit**

```bash
git add .github/workflows/security-fast.yml
git commit -m "chore(phase-23): gitleaks artifact upload 복원 (Sec-MED-2 #3 verify)"
```
