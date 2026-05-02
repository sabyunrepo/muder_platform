# MMP v3 Recurring Mistakes Registry


learning-extractor의 3-question quality gate(`refs/learning-quality-gate.md` Q1·Q2·Q3) 모두 PASS + duplicate-checker가 NEW로 분류한 항목만 등재. 해소 시 entry 삭제 또는 `~~strikethrough~~` + 해소 PR/commit 링크.

---

## 2026-05-01 — backlog 항목 PR 분기 전 게이트 대상 코드 존재 확인 grep 누락

**패턴**: backlog에 등록된 "v2 / feature flag / gate / wire-up" 항목을 immediate PR로 잡으려 분기했으나, **게이트 대상 코드가 실제로 존재하는지** 사전에 grep 검증하지 않았다. 분기 후 코드 grep 0 hit 발견 → defer로 종료 → PR scope 결정 ~ 브랜치 청소까지 왕복 비용 발생.

**근본 원인**: backlog 항목이 등록될 때 "v2 코드가 있다"는 암묵 가정이 있었으나, 항목 등록 시점과 PR 진입 시점 사이에 (a) v2 구현이 합쳐졌는지, (b) 다른 phase에 흡수되었는지, (c) 그저 미구현 상태인지 검증 단계가 없음. PR 분기 = 작업 시작 신호인데 "작업할 대상이 코드에 존재하는가"는 가장 기본 사전 체크.

**재발 방지 강제점**:
1. **`feedback_coding_discipline.md` § "Think Before Coding"에 grep 게이트 추가** — backlog 항목이 "v2", "feature flag", "gate", "wire-up", "쓰임처" 같은 *기존 구현체 의존* 키워드를 포함하면 PR 분기 *직전* `grep -rn <식별자>` 또는 의미 검색으로 게이트 대상 존재 확인 의무화.
2. **0 hit 발견 시 즉시 사용자에게 옵션 제시** — (a) brainstorm 분기, (b) placeholder flag (카논 위반 risk 명시), (c) backlog defer. 메인 모델이 default 결정 X.
3. **backlog 항목 등록 시점에 "검증 필요" 마킹** — 향후 backlog 등록 시 "v2 게이트가 *현재 코드에 존재한다*고 가정함"을 명시하거나, 가정이 검증 안 됐다면 "spec/grep 사전 검증 필요" 태그.

**관련 카논**: `memory/feedback_coding_discipline.md` § 1, `memory/project_phase21_backlog.md` E-5 brainstorm 필수 사유 섹션.
**발견**: PR #190 wrap (2026-05-01). E-5 location_clue_assignment_v2 immediate PR 시도 → grep 0 hit 발견 → 사용자 결정 (c) defer.
**해소 commit**: `feedback_coding_discipline.md` 본 wrap PR.

---

## 2026-05-01 — 컴포넌트 분리 시 원본 JSX render 순서를 검증 안 한 채 논리 종속만으로 sub-component 묶기

**패턴**: 큰 React 컴포넌트를 여러 sub-component로 분리할 때, 추출 단위를 *논리적 관련성*(예: "warning timer는 autoAdvance에 종속") 기준으로만 정하면 *원본 DOM render 순서*가 깨질 수 있다. 분리 후 컨트롤이 시각적으로 다른 위치에 렌더되어 인과 관계가 역전되거나 visual jitter 발생.

**근본 원인**: 분리 단계에서 메인 모델이 부모 컴포넌트의 JSX를 line range로 잘라 sub-component prop으로 변환하면서, 원본 render 순서(Label → Type → Duration → Rounds → Auto-advance toggle → Warning timer)와 분리 후 순서(... → Warning timer는 TimerSettings 안에 흡수 → toggle은 외부에서 마지막)가 다르다는 사실을 검증하지 않았다. 4-agent arch reviewer가 round-1에서 HIGH로 검출.

**재발 방지 강제점**:
1. **분리 PR의 self-check** — sub-component 작성 후, 부모 JSX에서 sub-component 호출이 원본 element들과 같은 순서로 자리잡는지 line-by-line 비교. 부모 JSX 본문 diff에서 element 추가/삭제/순서 변화를 손으로 확인.
2. **`feedback_code_review_patterns.md` React 섹션에 "DOM 순서 보존 검증" 항목 추가** — arch reviewer 프롬프트에 "원본 vs 분리 후 JSX render 순서 1:1 비교 명시" 강제. 논리적 종속 기준만으로는 부족.
3. **테스트가 ordering을 검증하지 않으므로 4-agent 의존** — vitest는 query-by-text/role 기준이라 element 순서를 잡지 못함. arch reviewer가 사실상 유일한 게이트. 분리 PR은 4-agent carve-out 우회 금지 (사용자 명시 필요).

**관련 카논**: `memory/feedback_code_review_patterns.md` React 섹션, `memory/project_phase21_backlog.md` E-7 해소 근거.
**발견**: PR #191 4-agent carve-out review (2026-05-01). PhaseNodePanel → PhasePanelAdvanceToggle 추출 시 warning timer가 toggle 아래에서 위로 회귀 → in-PR fix (warning timer를 PhasePanelAdvanceToggle 안으로 흡수해 원본 순서 복원).
**해소 commit**: PR #191 commit `cc16aae` + `feedback_code_review_patterns.md` 본 wrap PR.

---

## 2026-05-01 — useDebouncedMutation: schedule-time cache write + flush-time applyOptimistic 이중 layer → pendingSnapshot 이중 오염

**패턴**: debounce + optimistic update 합성 훅 설계 시, schedule 시점에 직접 cache mirror write를 하고 flush 시점에도 `applyOptimistic` 안에서 `getQueryData(cacheKey)`로 previous를 다시 캡처하면, flush 시점의 `previous`는 이미 schedule-time이 쓴 상태를 읽는다. mutation 실패 시 rollback closure가 schedule-time-applied 상태로만 복원하고 진짜 pre-edit snapshot은 유실 — silent data divergence.

**근본 원인**: 두 layer가 서로의 cache 변경을 인지하지 못한 채 각자 `getQueryData`를 호출. flush-time previous는 "schedule 후" 시점이라 정의상 pre-edit이 아님. PR #184 round-2까지 미발견 → round-2 4-agent + CodeRabbit 동시 지적.

**재발 방지 강제점**:
1. `useDebouncedMutation` 또는 유사한 "debounce + optimistic" 합성 훅 설계 시 — **schedule 시점에는 어떤 cache write도 하지 말 것**. timer callback body (`schedulePending`) 안에서 `setQueryData`/`applyOptimistic` 호출 금지. flush 진입 직전 단 한 번 snapshot 캡처.
2. **schedule 시점 즉시 UI 반영이 필요한 경우** (예: 토글 UX) — 호출자가 saveConfig에서 직접 `setQueryData` mirror + 별도 `pendingSnapshotRef`로 진짜 pre-edit snapshot 캡처 (debounce 윈도우 내 1회). hook의 `applyOptimistic`은 그 ref의 snapshot으로 rollback closure 작성. mutation settle (success/error) 후 ref clear → 다음 윈도우 fresh.
3. PR review 체크리스트에 "React Query optimistic + debounce 합성: rollback 캡처 시점은 진짜 pre-edit snapshot이어야 한다 — flush 시점 `getQueryData`는 NG" 항목 추가 (`feedback_code_review_patterns.md`).

**해소 PR**: PR #184 round-3 (commit 7aacc3e). `apps/web/src/hooks/useDebouncedMutation.ts:37-48` JSDoc + `apps/web/src/features/editor/components/design/CharacterAssignPanel.tsx:46-55` `pendingSnapshotRef` 패턴.

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

**발견**: PR #163 4-round self-review (round-2 security HIGH-S2, round-3 security HIGH-S3, 2026-04-28)

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


---

## 2026-04-29 — 점진 fix PR vs 정공 phase 진입 결정 없이 착수 → retract 낭비 (phase-vs-patchwork)

**증상**: Phase 22 W1.5 PR-12 (`chore/w1-5-go-cache-narrow`) 작성 — 9 workflow의 setup-go cache 좁힘 + 9 actions/cache + 9 go mod verify + 9 cleanup hotfix step 추가. spec ref 작성 + 4-agent 병렬 review (sec/perf/arch/test) + 1차 push + 2차 hotfix push (commit `e7cd387`). 그 직후 사용자 통찰 "Custom Image로 진행하면 다음 phase도 다 필요없을 것 같은데" → PR-12 retract (PR #173 close, branch 삭제, worktree 제거). 9 workflow × 4 step (cache:false + actions/cache + go mod verify + cleanup) = ~36 step 작업이 dead code.

**근본 원인**: compound-plan brainstorm 단계에서 "이 부채를 점진(patchwork) fix로 처리할 것인가 vs 정공 phase 진입으로 근본 제거할 것인가" ROI 비교 강제 질문 부재. PR-12 시작 시 점진 fix를 default로 선택했으나, 4-agent review 진행 중 (Performance HIGH-1: build cache 제외로 +90~120s/run trade-off, Architecture HIGH-A1: composite action 추출 carry-over) 점진 fix의 비용이 누적되며 정공 fix (Custom Image) 의 ROI가 명백해짐. 사용자가 phase 진입 결정 후에야 PR-12의 dead code 가능성 인식.

**재발 방지**:
1. **compound-plan brainstorm Q에 "점진 vs 정공" 강제 질문 추가** — `superpowers:brainstorming` 진입 시 6번째 질문으로 "이 부채는 점진(patchwork) fix로 충분한가, 정공 phase 진입이 필요한가? phase 전환으로 dead code 될 확률 > 50%면 phase 진입 우선" 명시.
2. **부채 진단 시 "phase 신호" 사전 검토** — 9+ 곳 동일 패턴 fold-in / 4-agent review 모두 carry-over 다수 / Custom Image / Composite action 같은 Phase N entry가 carry-over에 명시 → phase 진입 신호. 점진 fix 작성 전 사전 ROI 비교 필수.
3. **사례 누적 후 카논화** — 본 사례 + 향후 동일 패턴 누적 시 `feedback_phase_vs_patchwork.md` 신규 등재.

**관련 카논**: `memory/sessions/2026-04-29-phase-23-custom-image-pivot.md` (PR-12 retract 진단 데이터), `docs/plans/2026-04-28-phase-22-w1-5-debt-cleanup/checklist.md` § "Phase 23 carry-over (확정 escalate)" (점진 fix 시점에 carry-over 다수가 phase 신호였음).

---

## 2026-04-29 — chicken-egg self-bootstrap (Custom Runner Image CI가 self-hosted runner에 의존)

**증상**: Phase 23 PR #174 머지 (`build-runner-image.yml` 신규, `runs-on: [self-hosted, containerized]`) 직후 사용자가 docker compose down 후 docker compose up 시도 → `ghcr.io/sabyunrepo/mmp-runner:latest: not found`. main의 build-runner-image.yml workflow가 4 runner 다운으로 picking up 불능 → image build 진행 X → GHCR push X → 사용자 host pull 불능. 옛 myoung34 image 잔존이 자동 fallback이 되어 4 runner 가동 (3 online + 1 offline)으로 mitigation됐으나, image 삭제 시 영구 lock-out 가능.

**근본 원인**: `build-runner-image.yml`이 자기 자신이 빌드하는 image의 runner pool을 사용. design level의 self-bootstrap chicken-egg. spec § 9 Risks에 "사용자 host 재배포 시점 active CI 충돌"만 명시되었고 self-bootstrap risk는 미명시. superpowers:code-review에서도 "Self-bootstrap (chicken-egg) is benign by design"으로 판정 — 옛 image fallback 가정 (실 운영에서 검증 안 된 가정).

**재발 방지 강제점**:
1. **`build-runner-image.yml`의 `runs-on`은 항상 `ubuntu-latest`** (또는 GitHub-hosted runner). self-hosted runner는 user CI workflow (ci.yml/security/E2E)에만 사용.
2. **신규 image build CI 작성 시 ubuntu-latest 강제** — Dockerfile + workflow 작성 시 PR review가 `runs-on: self-hosted` 검출 시 CRITICAL flag.
3. **`memory/feedback_runner_bootstrap.md` 카논 ref** — Phase 23 wrap-up에서 신규 등재, build-runner-image.yml 패턴 master.
4. **`anti-patterns.md` 항목 추가 후보** — "image build CI는 self-hosted runner 사용 금지" 카논화.

**Mitigation (현 운영)**: 옛 myoung34 image가 host에 잔존 → 사용자가 image 삭제 안 하는 한 fallback 가능. P0-1 follow-up Hotfix PR로 영구 fix 권장.

**관련 카논**: `memory/sessions/2026-04-29-phase-23-custom-runner-image-merge.md`, `docs/superpowers/specs/2026-04-29-phase-23-custom-runner-image-design.md` § 9 Risks, `memory/feedback_runner_bootstrap.md` (Phase 23 wrap-up 신규 카논), P0-1 follow-up.

---

## 2026-05-01 — paths-filter 횡적 의존 누락 → required check fire 0 (paths-filter-lateral-dep)

**증상**: PR #194에서 main branch protection을 15→4 required check로 축소하며 `security-fast.yml`에 paths-filter 추가. 본 PR이 `.github/workflows/*.yml`만 변경 → ci.yml + e2e-stubbed.yml의 paths가 본인 workflow 파일만 포함 (`.github/workflows/ci.yml`, `.github/workflows/e2e-stubbed.yml`)이라 다른 workflow 변경 PR에선 fire 0. 결과: 4 required check 중 어느 것도 등록 안 됨 → branch protection 영구 차단. `enforce_admins=false` + admin 권한으로만 우회 가능. PR #195 hotfix로 양 workflow paths에 `.github/workflows/**` (전체) 추가하여 해소.

**근본 원인**: paths-filter 설계 시 "내 변경 파일 → 내 fire" 종적 패턴만 고려하고, "다른 workflow 파일 변경 시 본 workflow도 fire 해야 한다"는 횡적 의존 패턴 누락. workflow 간 cross-trigger 사전 시뮬레이션 부재. 코드 PR 기준의 paths-filter 검증 절차가 workflow-only PR 시나리오를 cover 하지 못함.

**재발 방지**:
1. **paths-filter 추가 전 체크리스트** — (a) 이 job이 branch protection required check에 등록돼 있는가? (b) `.github/workflows/**` 를 paths에 포함하지 않으면 다른 workflow-only PR에서 required check 누락이 발생하는가? 두 질문 모두 YES면 `.github/workflows/**` 강제.
2. **`feedback_ci_infra_debt.md` 보강** — "paths-filter 추가 시 required-check 교차 검증" 항목 추가 (별도 PR).
3. **자동화 후보 (다음 세션)**: PostToolUse Edit/Write hook — `.github/workflows/*.yml` 편집 시 `paths:` 블록이 있는 workflow 가 `.github/workflows/**` 항목 포함 여부 grep 검사 (warn-only).

**관련 카논**: `memory/sessions/2026-05-01-ci-slim-paths-filter-trap.md` (본 세션 핸드오프), `feedback_ci_infra_debt.md` (보강 후보 위치).

---

## 2026-05-01 — gitleaks paths-filter scope: 보안 잡을 paths-filter workflow에 묶지 말 것 (gitleaks-workflow-scope)

**증상**: PR #194에서 `security-fast.yml`에 paths-filter 추가 시 gitleaks도 같은 workflow에 묶여 있어 함께 게이트됨. paths-filter가 `apps/**`, `packages/**`, `go.mod/sum`, `pnpm-lock.yaml`, `.gitleaks.toml`, 본 workflow만 → `infra/`, `scripts/`, `docs/`, root config (`*.env*`, `terraform/*.tfvars` 등) 변경 시 secret scan fire 0. `security-deep.yml` nightly 에도 gitleaks 없어 secret scan 사실상 코드 PR 한정. PR #195 hotfix로 gitleaks를 별도 `.github/workflows/gitleaks.yml`로 분리, paths-filter 없음 (모든 PR/push fire).

**근본 원인**: GitHub Actions paths-filter는 workflow trigger 레벨 — 같은 workflow에 묶인 모든 job이 동시에 skip 됨. "성능 최적화용 filter (govulncheck cost ↓)"와 "항상 실행해야 하는 보안 잡 (gitleaks 모든 경로 검출)"을 같은 workflow에 두면 filter 의 skip이 보안 잡도 적용. Job 단위 paths-filter는 GitHub Actions 가 직접 지원 안 함 (`if:` 조건 우회 가능하나 직관성 ↓).

**재발 방지**:
1. **secret-scan / SAST / 보안 sentinel 종류 잡은 독립 workflow 파일로 분리** — paths-filter 없이 운영. 성능 최적화 잡 (govulncheck / 의존성 SCA / vuln scan) 만 paths-filter workflow에 묶음.
2. **`feedback_ci_infra_debt.md` 보강 또는 신규 `feedback_security_workflow_isolation.md`** — "paths-filter 도입 workflow 에 보안 sentinel 잡 두지 말 것" 카논화.
3. **사례 누적 후 카논 master 결정** — 본 사례 + 향후 동일 패턴 누적 시 별도 카논 vs `feedback_ci_infra_debt.md` 흡수.

**관련 카논**: `memory/sessions/2026-05-01-ci-slim-paths-filter-trap.md` (본 세션 핸드오프), `.github/workflows/gitleaks.yml` (분리 결과 master 패턴), `feedback_ci_infra_debt.md` (보강 후보 위치).

---

## 2026-05-02 — wsgen Go map iteration 비결정성 → main drift 잠재 + sort 미추가 first-fix 재발 (wsgen-nondeterminism)

**증상**: PR #212 `feat/phase-24-pr-1-backend-foundation` CI에서 `mockgen 산출물 drift` 에러 — `cd apps/server && go generate ./...` 실행 후 `git diff` 비공백. 첫 fix `a468206`은 `go generate` 결과를 그대로 commit (정렬 안 된 새 출력 = 우연히 main의 stable 출력과 다른 순서). 두 번째 CI run에서 같은 비결정성으로 다시 drift. 진짜 fix `6568719`에서 `apps/server/cmd/wsgen/payload.go extractPayloads`에 `sort.Slice(out, func(i,j int) bool { return out[i].Name < out[j].Name })` 추가하여 deterministic 출력 보장 + `types.generated.ts` 정렬 결과 commit.

**근본 원인**: `parser.ParseDir`가 반환하는 `pkgs map[string]*ast.Package`와 `pkg.Files map[string]*ast.File` 모두 Go map → iteration order randomized. PR-9 (#203, commit `bcdb7df`)이 `ErrorPayload`/`ConnectedPayload` struct 추가 시 `go generate` 결과가 우연히 stable 한 순서로 commit됨. 이후 누가 generate하면 매번 다른 순서 출력 → drift. PR-1이 첫 인지자.

**재발 방지**:
1. **codegen tool에 deterministic ordering canon** — Go map iteration 사용 시 collect → `sort.Slice/SortFunc` 강제. wsgen `payload.go` + `catalog.go` 모두 적용 필요 (catalog는 `render.go:25` 정렬됨, payload는 PR-1에서 추가).
2. **codegen drift detection 강화** — `go generate ./...` 실행 후 같은 입력으로 다시 실행 시 `git diff --exit-code` 통과해야 함. CI에 `for i in 1 2 3; do go generate ./...; done && git diff --exit-code` 추가 후보.
3. **첫 fix가 우연 통과 시 root cause 의심** — codegen output drift는 sort 추가가 정답. "wsgen 결과를 commit하면 되겠지" 패턴 거부.

**관련 카논**: `memory/feedback_wsgen_deterministic.md` (신규 카논 파일), `apps/server/cmd/wsgen/payload.go` (sort fix 적용 commit `6568719`).

---

## 2026-05-02 — round-1 critic이 지적한 premature PlayerAwareModule을 같은 fix-loop에서 처리 안 함 → CI playeraware-lint 강제 fail (premature-playeraware-skeleton)

**증상**: PR-1 4-agent round-1 review에서 critic이 `engine.PlayerAwareModule = (*Module)(nil)` interface assertion에 대해 "skeleton 단계에서 premature — 진짜 per-player redaction 없음" 지적. round-1 fix는 다른 항목 우선 처리하고 이 finding은 "TDD 신호 (PR-5에서 BuildStateFor 진짜 redaction 추가될 때 break)"로 분류. 이후 CI `scripts/check-playeraware-coverage.sh` lint가 `BuildStateFor` delegate 패턴 즉시 차단 → fix `f6624e2`에서 `engine.PublicStateMarker` embed로 전환 + `BuildStateFor` 메서드 제거.

**근본 원인**: F-sec-2 카논 (`scripts/check-playeraware-coverage.sh`)은 "BuildStateFor가 BuildState/snapshot에 delegate" 패턴을 즉시 lint fail로 차단. 이는 per-player trust boundary 차단 — TDD 신호 X, 강제 카논. Skeleton이 PlayerAwareModule 인터페이스를 implement하면 BuildStateFor가 진짜 redaction을 해야 함. PR-1 시점에는 per-player data 없으므로 PublicStateMarker가 정답.

**재발 방지**:
1. **Skeleton = PublicStateMarker로 시작 카논** (`memory/project_module_skeleton_publicstate.md`): PR-N skeleton 단계 (Schema only, 게임 로직 미구현)는 `PlayerAwareModule` 대신 `engine.PublicStateMarker` embed. 진짜 per-player data 추가될 PR에서 marker drop + `BuildStateFor` 추가.
2. **4-agent critic의 "premature interface" 지적은 즉시 fix** — TDD 신호 분류 X, CI canon이 결국 강제할 것이므로 round-1에서 처리.
3. **모듈 신설 PR 진입 시 sibling 비교** (voting/accusation/hidden_mission) — 어느 패턴 사용하는지 확인 후 일관 적용.

**관련 카논**: `memory/project_module_skeleton_publicstate.md` (신규 카논 파일), `apps/server/scripts/check-playeraware-coverage.sh` (lint canon master), `apps/server/internal/engine/types.go` `PublicStateMarker` definition.
