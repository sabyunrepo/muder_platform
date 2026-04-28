# Wave 4 — Decommission (운영 노트, 코드 변경 없음)

> Parent: [`../checklist.md`](../checklist.md) | Spec §6 W4

**Goal:** W3 PR-3 머지 후 7일 stable 관측 완료 → 기존 host runner를 안전하게 deregister + archive. 코드 변경 0, 운영 액션만.

**Depends:** W3 (PR-3) 머지 + 7일 fail rate stable + W3 Task 6 검증 완료.

---

## Task 1 — GH UI에서 host runner deregister

> **사용자 명시 작업** — Claude는 안내만.

- [ ] **Step 1**: 사용자가 GitHub UI 진입
  - https://github.com/sabyunrepo/muder_platform/settings/actions/runners

- [ ] **Step 2**: 기존 host runner 식별 (예: `sabyun-mbp` 등 호스트 이름)
  - 라벨이 `self-hosted` 단독 (containerized 라벨 없음)인 row.

- [ ] **Step 3**: 각 host runner row → 우측 `...` → `Remove runner` 클릭.
  - 확인 prompt에서 `Remove this runner` 클릭.
  - 또는 macOS shell command 옵션 제공됨 (사용 안 함, UI에서 직접 remove).

- [ ] **Step 4**: 검증
  - 페이지 새로고침 → containerized-runner-1~4만 남음 (4 row, 모두 `Idle` 또는 `Active`).
  - host runner 0 row.

---

## Task 2 — host에서 actions-runner 디렉토리 archive

> **사용자 명시 작업** — Claude는 안내 + 명령 제공.

- [ ] **Step 1**: 호스트 macOS에서 actions-runner 위치 확인

```bash
ls -la ~/actions-runner 2>&1 || find ~ -maxdepth 3 -name "actions-runner*" -type d 2>/dev/null
```

Expected: 경로 출력 (보통 `~/actions-runner`).

- [ ] **Step 2**: 실행 중 process 종료 확인

```bash
pgrep -f Runner.Listener
```

Expected: empty (Task 1에서 deregister 후 process도 자동 종료).

- empty 아니면:
  ```bash
  cd ~/actions-runner
  ./svc.sh stop          # macOS launchd 등록 시
  # 또는
  pkill -f Runner.Listener
  ```

- [ ] **Step 3**: archive (이름 변경, 삭제 X)

```bash
TODAY=$(date +%Y-%m-%d)
mv ~/actions-runner ~/actions-runner.archive-${TODAY}
ls -la ~/actions-runner.archive-${TODAY}
```

> 이름 변경만. rm은 1주일 후 별도 alarm.

- [ ] **Step 4**: launchd unload (있을 때)

```bash
launchctl list | grep actions.runner && \
  launchctl unload ~/Library/LaunchAgents/actions.runner.*.plist
```

- [ ] **Step 5**: 검증

```bash
pgrep -f Runner.Listener   # empty
ls -la ~/actions-runner    # No such file
ls -la ~/actions-runner.archive-*   # archive 존재
```

---

## Task 3 — `infra/runners/README.md` 운영 절차 업데이트

> 코드 변경. branch 만들고 commit + PR.

- [ ] **Step 1**: branch

```bash
git checkout -b chore/phase-22-w4-decommission-note
```

- [ ] **Step 2**: README 업데이트

`infra/runners/README.md` 끝의 `## 운영 기록` 섹션에 항목 추가:

```markdown
- 2026-XX-XX: W4 host runner deregister 완료 — 기존 호스트 runner (예: sabyun-mbp) GH UI remove + ~/actions-runner → ~/actions-runner.archive-YYYY-MM-DD 이름 변경. 1주 후 별도 alarm으로 rm 예정.
```

- [ ] **Step 3**: stage + commit

```bash
git add infra/runners/README.md
git commit -m "$(cat <<'EOF'
chore(phase-22): W4 decommission 운영 기록 (W4-Task 3)

기존 host runner deregister + ~/actions-runner archive 완료 기록.
1주 후 rm 예정 (별도 alarm).

Plan: docs/plans/2026-04-28-phase-22-runner-containerization/checklist.md

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 4**: push + PR + admin-merge

```bash
git push -u origin chore/phase-22-w4-decommission-note
gh pr create --title "chore(phase-22): W4 decommission 운영 기록" --body "Phase 22 W4 host runner archive 운영 기록. 코드 변경 X, README append만."
gh pr merge --admin --squash
```

---

## Task 4 — 1주 후 archive 삭제

> **사용자 명시 작업** — 별도 alarm으로 1주 후 실행. 본 plan은 절차만 카논화.

- [ ] **Step 1**: 1주 후 W4 archive 디렉토리 식별

```bash
ls -la ~/actions-runner.archive-*
```

- [ ] **Step 2**: 그동안 회귀 없음 재확인

```bash
gh run list --branch main --limit 100 --json conclusion --jq '[.[] | select(.conclusion=="failure")] | length'
```

variation 정상 범위 확인.

- [ ] **Step 3**: archive 삭제

```bash
rm -rf ~/actions-runner.archive-*
```

> ⚠️ 회귀 발견 시 archive에서 복원 가능 — `mv ~/actions-runner.archive-XXXX ~/actions-runner && cd ~/actions-runner && ./run.sh`. 삭제 전 회귀 0 재확인 필수.

- [ ] **Step 4**: README 운영 기록에 archive 삭제 시점 추가 (별도 chore PR).

---

## Wave 4 검증 (전체)

- [ ] Task 1 GH UI host runner 0 row 확인
- [ ] Task 2 호스트 `~/actions-runner` 부재 + archive 존재
- [ ] Task 2 `pgrep -f Runner.Listener` empty
- [ ] Task 3 README 운영 기록 PR 머지
- [ ] Task 4는 별도 alarm (1주 후)
- [ ] checklist.md W4 task 4건 + TaskList #1 (P5) `completed` 마킹
- [ ] Phase 22 전체 종료 → `/compound-wrap` 진입 준비

---

## 회귀 시 fallback

W4 Task 2 까지 진행한 시점에서 회귀 발견 → archive에서 복원:

```bash
mv ~/actions-runner.archive-YYYY-MM-DD ~/actions-runner
cd ~/actions-runner
./svc.sh start             # 또는 ./run.sh
```

GH UI에서 자동 재등록 확인 → 라벨 `self-hosted` 단독으로 fallback 흡수.

containerized runner pool은 그대로 유지 (이중 가동) — 안정화 후 재차 deregister 시도.

Task 4 (rm) 이후 회귀는 fallback 불가 — Task 4 진행 전 1주 stable 재확인이 마지막 안전 장치.
