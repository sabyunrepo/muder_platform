# MMP v3 Recurring Mistakes Registry

재발 가능성이 있는 실수·낭비 패턴 적층. compound-mmp `/compound-wrap` Step 6-1 결과로 **사용자 승인 후** append (자동 append 금지, anti-patterns.md #9).

learning-extractor의 3-question quality gate(`refs/learning-quality-gate.md` Q1·Q2·Q3) 모두 PASS + duplicate-checker가 NEW로 분류한 항목만 등재. 해소 시 entry 삭제 또는 `~~strikethrough~~` + 해소 PR/commit 링크.

---

## 2026-04-28 — dispatch-router "audit this" 본문 제거 vs router 보강

**패턴**: 슬래시 본문에 trigger keyword를 적었는데 `dispatch-router.sh` 정규식이 매칭 안 할 때, **본문에서 keyword를 제거하는 것이 router를 보강하는 것보다 안전**.

**근본 원인**: `dispatch-router.sh`는 `additionalContext` 추천 전용 (anti-patterns.md #11, `permissionDecision: deny` 미사용). 본문 keyword가 router 비매칭이어도 단순 통과 — 사용자 의도 손실 없음. router 보강은 false positive 위험을 동반 (예: "audit log 추가해" 발화가 review로 오라우팅).

**재발 방지 강제점**:
- 슬래시 본문 변경 시 `test-dispatch.sh`에 본문 phrase fixture 추가하여 doc-vs-behavior align
- 본문에 적었지만 router에 추가하기 부담스러운 keyword는 **본문에서 제거**가 기본 옵션
- 제거 시 본문에 사유 1줄 명시 ("false positive 위험으로 의도적으로 제외" 등)

**관련 카논**: `refs/anti-patterns.md` #11 (dispatch는 추천 전용)
**발견**: PR #158 4-agent self-review (arch HIGH-A3, 2026-04-28)
**해소 commit**: `8717dce` (compound-review.md L127 본문 제거 + test-dispatch.sh +6 fixture)

---

## Round-N fix → Round-N+1 vuln 도입 사이클 (4-round 종결)

**증상**: 보안 fix가 새 vuln을 도입하는 패턴은 round-N→N+1 사이클로 무한 반복 risk. 단일 layer fix는 우회 표면을 좁힐 뿐 종결 X.

**사례** (PR-10 #163 `/compound-cycle` 4-round 검증, 2026-04-28):
- **Round-1** HIGH-A1: cross-phase handoff pollution (`ls -t memory/sessions/*.md`가 다른 phase 매칭 → false `next_gate=done`)
- **Round-1 fix**: phase-scoped grep — `grep -l "$PHASE_NAME" memory/sessions/*.md`
- **Round-2 신규 HIGH-S2**: regex injection — `PHASE_NAME='2026-04-28-.*'` 잠입 시 BRE metachar 해석으로 다른 phase 매칭 (PoC 실증)
- **Round-2 fix**: `grep -lF` (fixed-string) + PHASE_NAME 화이트리스트 `^[a-z0-9_.-]+$`
- **Round-3 신규 HIGH-S3**: leading-hyphen option injection — `PHASE_NAME=-eversion` 화이트리스트 통과 → `grep -lF -eversion`이 `-e version` 패턴 검색으로 fixed-string 우회 (PoC 실증)
- **Round-3 fix**: 양 layer 강화 — 화이트리스트 `^[a-z0-9][a-z0-9_.-]*$` (첫 글자 alpha/num 강제) + `grep -lF -- "$VAR"` (separator)
- **Round-4**: 패턴 종결 확인 (전수 우회 시도 차단 실측, glob 확장 결과는 leading-`-` 불가능)

**근본 원인**: shell 명령어에 user input 직접 전달 시 (a) 정규식 해석, (b) 옵션 흡수 두 진입점 동시 존재. 단일 layer fix는 다른 진입점 노출.

**재발 방지 강제점**:
- helper에 user input → shell 명령어 (grep/ls/find/sed) 인자 전달 시 **첫 시도부터** 양 layer 동시 적용:
  1. 입력 화이트리스트 정규식 — **첫 글자 alpha/num 강제** (`^[a-z0-9][a-z0-9_.-]*$`), leading `-`/`.`/`_` 차단
  2. 명령어 호출 시 **`--` separator** 사용 (`grep -lF -- "$VAR"`, `find -- ...`)
- 정규식과 fixed-string 검증 둘 다 `<<canon>>` 권장 — defense-in-depth 양 layer
- round-N fix가 신규 vuln 도입 시 **같은 PR 마감** 카논 (carry-over 부적합 — round 무한 반복 차단)
- helper 외 sister command (예: PR-9 PROJECT_SLUG)도 동일 패턴 sweep 필수

**관련 카논**: `commands/compound-{cycle,work}.md` § Anti-pattern + `refs/post-task-pipeline-bridge.md` § "토큰 sanitize 의무"
**발견**: PR #163 4-round self-review (round-2 security HIGH-S2, round-3 security HIGH-S3, 2026-04-28)
**해소 commit**: `f9daca8` (양 layer 강화) + 4-round 검증 트레일 `docs/plans/2026-04-28-compound-mmp-wave3/refs/reviews/PR-10.md`

---

## 2026-04-28 — spec에 호스트 환경 의존 포트를 사전 조사 없이 표준 포트 기술

**증상**: PR-164 spec(`docs/superpowers/specs/2026-04-28-ci-infra-recovery-design.md`)에 dev compose `5432:5432` 그대로 기술. 사용자가 직접 dev rebuild 시도 시 runner 호스트의 langfuse-postgres가 영구 5432 점유 중인 것 발견 → 사후 `25432:5432`로 시프트 + plan refs/task-1-2-dev-compose.md에 drift acknowledgment 추가.

**근본 원인**: spec 작성 시 runner 호스트 환경 사전 조사(`ss -tlnp`, `docker ps`) 없이 일반 dev 환경 가정으로 표준 포트 사용. *dev-and-CI 동거 환경*에서만 발생하는 MMP 한정 함정 — 일반 컨벤션으로는 적발 불가.

**재발 방지**:
1. compound-plan brainstorming Q 단계에 "호스트 환경 사전 조사" 항목 추가 — 호스트 의존 spec(포트, 디스크 path, 권한, GPU 등) 전체 적용. 1회성이 아니라 카논 후보.
2. Phase 22 Runner 컨테이너화에서 *runner = dev 동거* 함정 자체 제거 — 격리된 컨테이너 worker로 전환하면 향후 재발 가능성 영구 차단.
3. 단기: 본 사례 1건만으로는 `feedback_plan_autopilot_gotchas.md` 정식 항목 등재 보류, 유사 사례 1~2건 누적 시 등재.

**관련 카논**: `feedback_explanation_style.md` (원인/결과/권장 사용자 보고), `docs/plans/2026-04-28-ci-infra-recovery/refs/reviews/PR-164.md` Architecture I-1 finding (drift acknowledgment 누락 지적).

---

## 2026-04-28 — actionlint dead zone: ci.yml job-context 회귀 1주 방치

**증상**: PR-164(`dbe6a65`) 머지 후 main의 ci.yml/e2e-stubbed.yml이 모든 push에서 0s에 fail로 마킹됨 ("workflow file issue"). PR pull_request trigger도 작동 안 함. admin-skip 정책이 red 신호를 가려 1주(2026-04-21 ~ 04-28) 동안 main이 사실상 broken state. Phase 22 W1 PR-1 진행 중 wrap-up 전 actionlint 진단으로 발견:
```
ci.yml:46:59  context "job" is not allowed here
ci.yml:47:40  context "job" is not allowed here
e2e-stubbed.yml:66:58 context "job" is not allowed here
e2e-stubbed.yml:67:40 context "job" is not allowed here
```

**근본 원인**: PR-164에서 도입한 `${{ job.services.X.ports['Y'] }}`가 GitHub Actions context availability 규칙상 **step-level에서만 평가 가능**, job-level `env:` 블록 사용 불가. silent fail mode = 0s + "workflow file issue" — 명확한 에러 메시지 없음. PR-164 머지 시 actionlint 미실행 + admin-skip 정책으로 13 required check가 모두 cumulative failure로 누적되어도 머지 진행. fix는 첫 step에서 `GITHUB_ENV`로 export로 4 line 변경(PR #166).

**재발 방지**:
1. **actionlint를 CI pre-check job 추가** — `.github/workflows/ci.yml`에 별도 actionlint job, 모든 workflow yaml 변경 시 PR-gate. (AUTO-2 카논화)
2. **admin-skip + ci.yml 변경 dead zone 차단** — admin-skip 정책 활성 기간 중 ci.yml/e2e-stubbed.yml 등 workflow 파일 변경 PR은 actionlint 결과 명시적 별도 검토 의무화. `feedback_4agent_review_before_admin_merge.md` carve-out 추가 후보.
3. **review 체크리스트 항목** — compound-review 4-agent에 "workflow yaml 변경 포함 PR은 actionlint 로컬 실행 명시" 추가.

**관련 카논**: `memory/project_ci_admin_skip_until_2026-05-01.md` (정책 reverse 결정 근거), `memory/feedback_4agent_review_before_admin_merge.md` (4-agent 강제 정책), PR #166 commit `cc43688` (fix evidence).

---

## 2026-04-28 — spec/env 가정: git remote/uname 미확인 후 macOS host 가정

**증상**: Phase 22 spec 초안 작성 시 호스트 환경을 macOS (Apple Silicon 32GB)로 가정. 실제 self-hosted runner는 Linux Ubuntu 6.8 (sabyun@100.90.38.7, 31GB). 환경 차이로 다음 회귀 발생:
1. **stat 명령 분기 누락** — `stat -f '%g'` (macOS BSD) vs `stat -c '%g'` (Linux GNU coreutils). README 보강(`d19abf7`)으로 macOS/Linux 양쪽 명시.
2. **DOCKER_GID 값 차이** — macOS Docker Desktop 보통 0, Linux Ubuntu 990. README에 두 환경 모두 명시.
3. **repo owner 5 location hotfix** — spec/plan/.env.example에 `sanghoon-pyun/muder_platform`로 추정 작성. 실제는 `sabyunrepo/muder_platform`. `40fa7f8` hotfix.

**근본 원인**: spec 작성 단계에서 `git remote -v`, `uname -s`, `id -g`, `stat -c '%g' /var/run/docker.sock` 같은 환경 확인 명령을 실행하지 않고 일반적 가정 사용. macOS는 사용자 dev 환경, Linux는 별도 runner 호스트라는 분리 인지가 spec 작성 시점에 부재.

**재발 방지**:
1. **compound-plan brainstorm 단계에 "환경 확인 체크리스트" 추가** — spec 작성 전 호스트 OS, repo owner, runner 환경, secret manager 등 사실 확인 명령 실행. AUTO-1 git remote owner validation hook (PreToolUse Bash)도 일부 카운터.
2. **runner 호스트 정보 명시** — Linux runner 100.90.38.7 사실을 `apps/server/CLAUDE.md` 또는 `infra/runners/README.md`에 위치 카논화 (다음 세션 후보).
3. **유사 사례 누적 시 `feedback_plan_autopilot_gotchas.md` 정식 항목 등재** — 본 사례 + Q-spec-host-survey(QUESTIONS) 추적.

**관련 카논**: `memory/QUESTIONS.md#Q-spec-host-survey`, `infra/runners/README.md` (Linux stat -c 분기 명시), commit `40fa7f8` + `d19abf7` (fix evidence).

---

## 2026-04-28 — compound-work worktree 분기 vs ci-infra single-branch carve-out 부재

**증상**: Phase 22 W1 PR-1 진행 시 compound-work helper가 권장한 worktree 분기(`feat/2026-04-28-phase-22-runner-containerization/PR-1-go`)와 sister 카논(ci-infra-recovery 패턴 = `feat/phase-22-runner-containerization` 단일 branch + 누적 commit) 사이 충돌. 메인 컨텍스트가 sister 카논 정합 결정으로 worktree skip 진행. 그러나 명시 결정 카논 부재로 다음 phase 진입 시 동일 결정 재수행 위험.

**근본 원인**: compound-work SKILL.md가 worktree 분기를 default 권장하지만 "인프라 긴급 복구 / 단일 PR로 spec+plan+task 묶음" 시나리오 carve-out 부재. ci-infra-recovery (PR-164)에서 단일 branch 누적 패턴 사용했고 본 Phase 22도 동일 패턴 적용했지만 SKILL 카논에 미반영.

**재발 방지**:
1. **compound-work SKILL.md에 carve-out 조항 추가** — `ci/*`, `hotfix/*`, 또는 "spec+plan+W1 task 단일 PR 묶음" 시나리오는 worktree 분기 생략 + 단일 branch + squash merge 패턴 명시.
2. **결정 흐름 명시화** — helper output `worktree.skill` 호출 시 메인 컨텍스트가 active phase의 카논(checklist에 명시된 `Branch:` 필드)을 우선 검토하도록 sequence 보강.
3. **사례 누적 후 카논화** — Phase 22 + PR-164 두 사례 모두 단일 branch 패턴. 다음 1~2 phase 진입 시 동일 패턴이면 SKILL.md carve-out PR 진행.

**관련 카논**: `.claude/plugins/compound-mmp/skills/compound-work/SKILL.md` (carve-out 추가 후보), `docs/plans/2026-04-28-ci-infra-recovery/checklist.md` (sister 카논 evidence), `docs/plans/2026-04-28-phase-22-runner-containerization/checklist.md` § "Branch:" 필드.
