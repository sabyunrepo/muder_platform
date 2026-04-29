# Wave 5 — Operational Verify (사용자 host 작업)

> 부모: [checklist.md](../checklist.md) | 이전: [Wave 4](wave-4-pr.md)

## Task 14: GHCR push 성공 확인

- [ ] **Step 1: main의 build-runner-image.yml run 결과**

```bash
gh run list --workflow=build-runner-image.yml --limit=1
gh run view <run-id> --log | grep -i "pushed"
# Expected: pushed: ghcr.io/sabyunrepo/mmp-runner:latest, :<sha>
```

- [ ] **Step 2: GHCR public visibility 확인**

```bash
curl -s https://ghcr.io/v2/sabyunrepo/mmp-runner/tags/list | jq .
# Expected: tags JSON (latest + sha tag) — 인증 없이 응답
```

- [ ] **Step 3: 첫 push 후 repo connection 설정 (1회)**

수동 절차 (브라우저):
1. https://github.com/sabyunrepo/packages/container/mmp-runner/settings
2. "Manage Actions access" → `muder_platform` add (이렇게 해야 향후 본 repo의 GITHUB_TOKEN이 push 가능)
3. visibility → Public 확인 (image에 secret 없으니 OK)

> 본 1회 설정 후 향후 자동 push.

---

## Task 15: 사용자 host SSH 재배포

- [ ] **Step 1: SSH 접속 + git pull**

```bash
ssh sabyun@100.90.38.7
cd ~/muder_platform/infra/runners
git pull
# Expected: docker-compose.yml + README.md 변경 가져옴
```

- [ ] **Step 2: image pull + 재시작**

```bash
docker compose pull
# Expected: 4 service Pulled (ghcr.io/sabyunrepo/mmp-runner:latest)

docker compose up -d
# Expected: 4 service Started

docker compose ps
# Expected: 4 service Up, image=ghcr.io/sabyunrepo/mmp-runner:latest
```

- [ ] **Step 3: 컨테이너 부팅 + GitHub idle 확인**

```bash
docker logs containerized-runner-1 2>&1 | head -50 | grep -i "Listening for Jobs"
# Expected: "Listening for Jobs" 메시지

# 또는 GitHub UI:
# Settings → Actions → Runners → 4 runner idle 확인
```

- [ ] **Step 4: 사전 install + hook env 확인**

```bash
docker exec containerized-runner-1 bash -c '
  jq --version
  govulncheck -version
  /opt/hostedtoolcache/go/1.25.0/x64/bin/go version
  /opt/hostedtoolcache/node/20.18.0/x64/bin/node --version
  echo "ACTIONS_RUNNER_HOOK_JOB_STARTED=$ACTIONS_RUNNER_HOOK_JOB_STARTED"
  ls /opt/runner-hooks/job-started.sh
'
# Expected: 모든 binary version 정상 출력 + hook env=/opt/runner-hooks/job-started.sh + 파일 존재
```

---

## Task 16: 첫 실 CI run verify

- [ ] **Step 1: 트리거 (사용자 PR 또는 작은 noise PR로 자연 트리거)**

또는 PR-5 (#172)의 main rebase + push로 자연 트리거 (Task 17과 묶어서 진행 가능).

- [ ] **Step 2: cleanup hook 실 fire 확인**

```bash
gh run view <run-id> --log | grep -i "Run /opt/runner-hooks/job-started.sh\|ACTIONS_RUNNER_HOOK_JOB_STARTED"
# Expected: hook 실행 라인 존재
```

> **fail 시**: spike (Wave 1 PR CI verify) 통과 + 실 runner fail = `ACTIONS_RUNNER_HOOK_JOB_STARTED` fire 누락. **plan 자체 재검토** (entrypoint override 패턴 전환). myoung34 base의 entrypoint chain이 `ACTIONS_RUNNER_HOOK_*` env를 무시할 가능성. follow-up 별 PR로 entrypoint override.

- [ ] **Step 3: tar 충돌 0건 확인**

```bash
gh run view <run-id> --log | grep -i "tar.*Cannot open.*File exists"
# Expected: 매칭 0건
```

- [ ] **Step 4: GHA cache size 확인**

```bash
gh cache list | awk '{sum+=$3} END {print sum/1024/1024 " MB"}'
# Expected: 1GB 이하 (369MB ~ 800MB 범위)
```

> 폭증 시: 본 PR scope에서 cache narrow는 미포함 (PR-12 retract). 필요 시 별 PR (PR-12 재진입 후보) 또는 hostedtool-cache volume이 setup-go cache 기능을 대체하는지 검토.

- [ ] **Step 5: gitleaks artifact upload (#3 verify)**

```bash
gh run view <run-id> | grep -i "gitleaks"
# 또는 GitHub UI: PR Run → Artifacts 섹션에 gitleaks-report 링크 존재
```

→ **fail 시**:
1. **즉시 hotfix**: `.github/workflows/security-fast.yml`에 `GITLEAKS_ENABLE_UPLOAD_ARTIFACT: false` 복원 PR
2. **#3 follow-up PR**: SARIF/upload-artifact 메커니즘 재설계 (PR-168 H-ARCH-2 lesson + Custom Image GID 정착 못 잡는 actions/upload-artifact 호환 issue)

- [ ] **Step 6: 9 workflow 정리 step 통과 확인**

```bash
# ci.yml: go-check / ts-check / coverage-guard
gh run view <run-id> | grep -E "(go-check|ts-check|coverage-guard|codeql|trivy|gitleaks)"
# Expected: 모든 job SUCCESS
```

→ 특정 job fail 시 진단 + hotfix.

---

## Task 17: PR-5 (#172) main rebase + 머지 (자동 unblock)

- [ ] **Step 1: PR-5 (#172) base에 main rebase**

```bash
gh pr checkout 172
git fetch origin main
git rebase origin/main
git push --force-with-lease
```

- [ ] **Step 2: CI 재실행 확인**

```bash
gh pr checks 172
# Expected: 모든 status check SUCCESS (osv/govulncheck 자연 통과 — Custom Image의 govulncheck 사전 install 효과)
```

- [ ] **Step 3: PR-5 머지**

```bash
gh pr merge 172 --admin --squash --delete-branch
# Expected: PR closed + branch deleted
```

→ ci.yml의 4 job (`go-check`, `ts-check`, `coverage-guard`, `docker-build`)이 `[self-hosted, containerized]` runs-on으로 전환됨. 향후 모든 PR이 containerized runner로 routing.

---

## Task 18: Phase 23 종료 조건 verify + close-out

- [ ] **Step 1: Spec 7.5 종료 조건 8건 체크**

- [ ] PR 머지 + GHCR push 성공 (Task 14)
- [ ] host 4 runner 재배포 + idle (Task 15)
- [ ] 첫 실 CI run cleanup hook fire + tar 충돌 0건 (Task 16 step 2-3)
- [ ] 9 workflow 정리 step 통과 (Task 16 step 6)
- [ ] gitleaks artifact upload 동작 (또는 #3 follow-up 등록) (Task 16 step 5)
- [ ] GHA cache 1GB 이하 1주 stable (Task 16 step 4 + 1주 모니터링)
- [ ] PR-5 (#172) main rebase + 머지 (Task 17)
- [ ] follow-up #1 (Composite action 추출) Phase 23.1 또는 Phase 24 plan 등재

> 1주 stable 모니터링은 **Phase 23 close-out 미루기 정당화 근거** — 즉시 close 안 하고 1주 관찰 후 final close.

- [ ] **Step 2: `/compound-wrap` 호출**

세션 wrap-up:
- handoff 노트 작성: `memory/sessions/<date>-phase-23-close.md`
- MEMORY.md entry 갱신 (Phase 23 완료 또는 W1 stable 관찰 stash)
- MISTAKES.md / QUESTIONS.md append (만약 Q-myoung34-ephemeral-fs 결과)
- 4 carry-over (Composite action / 9 workflow 정리 잔여 / gitleaks 메커니즘 / GHA cache narrow) 별 phase 등재

- [ ] **Step 3: status 업데이트**

```bash
# checklist.md frontmatter
status: "completed (1주 stable 관찰 후 close)"  # 또는
status: "closed"
```

---

## 부수 follow-up 등재 (Phase 23 close-out 시)

### Confirmed follow-up

- **Phase 23.1 또는 24**: Composite action 추출 (Arch-HIGH-1) — `.github/actions/start-services/action.yml` 신규
- **Phase 23.x or W1.5 잔여**: orphan-gate fixture (PR-1), gitleaks Secret scan 분석 (PR-2), govulncheck CRITICAL/HIGH (PR-3), host git clone 절차 (PR-7)

### Conditional follow-up

- **gitleaks SARIF/upload 메커니즘 재설계** (#3 follow-up) — Task 16 step 5에서 fail 시만 trigger
- **GHA cache narrow** (PR-12 재진입 후보) — Task 16 step 4에서 폭증 발견 시만 trigger
- **EPHEMERAL fs entrypoint override 패턴** — Task 16 step 2에서 hook fire 누락 발견 시만 trigger (가설 부정 시 plan 재검토)
