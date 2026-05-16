# MMP Workflow Synergy Migration Plan

작성일: 2026-05-16
기준 브랜치: `chore/workflow-synergy-migration-plan`
추적 이슈: #584
근거 세션: PR #583 player kill power-resolution 작업, 기존 MMP workflow state, repo-local skills/agents/scripts

## 목표

- 현재 프로젝트의 `AGENTS.md`, repo-local `.codex/skills`, `.codex/agents`, workflow scripts, Ouroboros `ooo` 흐름을 중복 없이 연결한다.
- “의도 파악 → 실행 브리프 → Issue/plan → branch/seed gate → 구현/검증 → PR/CodeRabbit → wrap/self-improvement”가 한 번만 기록되고 여러 도구가 같은 원본을 재사용하게 한다.
- 사용자에게는 `ooo interview`나 자연어 요청 하나로 시작해도 MMP의 Issue/PR 가드가 막히지 않는 흐름을 제공한다.

## 이번 작업에서 확인된 증거

- PR #583 작업은 `ooo interview`로 요구사항을 정리하고 GitHub Issue #582와 plan 문서를 만들었지만, PR 생성 시 `scripts/pr-create-guard.sh`가 `.git/mmp-workflow/seeds/issue-582.json`을 요구해 같은 요구사항을 다시 `scripts/mmp-workflow-seed.sh init`으로 입력해야 했다.
- `scripts/mmp-local-ci.sh quick`는 Docker local-ci 컨테이너에서 통과했지만, host macOS `node_modules`와 container Linux optional dependency가 충돌해 한 번 실패했고, 컨테이너 install 후에는 macOS 개발 환경 복구용 `pnpm install --frozen-lockfile`가 다시 필요했다.
- CodeRabbit pending 확인은 main thread에서 30초/60초 단발 조회로 처리했다. 규칙상 장기 대기는 `mmp-ci-steward`에게 넘기는 편이 더 맞지만, 현재는 handoff 기준과 “언제 멈추고 steward로 넘길지”가 실무적으로 덜 자동화되어 있다.
- `AGENTS.md`에는 durable policy와 절차 상세가 함께 들어 있고, `.codex/skills/mmp-pr-lifecycle`, `.codex/skills/mmp-issue-planning`, `.codex/skills/mmp-subagent-orchestration`에도 같은 정책의 상세 버전이 들어 있어 일부 중복이 있다.
- 현재 self-improvement state는 `active_candidates: []`이므로 즉시 규칙 수정 PR보다, 이번 세션 증거를 바탕으로 migration issue/plan을 먼저 만드는 것이 안전하다.

## 현재 자산 역할 지도

| 자산 | 현재 역할 | 유지할 책임 | 줄일 중복 |
| --- | --- | --- | --- |
| `AGENTS.md` | 항상 로드되는 durable policy | 안전/우선순위/카논/금지사항/최소 라우팅 | 긴 절차 상세, agent별 세부 명령 |
| `.codex/skills/deep-interview` | 모호한 요청을 실행 브리프로 정리 | 질문 규칙과 Execution Brief 형식 | Issue/PR 절차 상세 |
| `.codex/skills/mmp-issue-planning` | Issue body/병렬 설계/Coverage Plan | Issue 작성과 planning checklist | Seed 파일 생성 명령 중복 |
| `.codex/skills/mmp-pr-lifecycle` | PR 생성/CodeRabbit/local validation | PR gate sequence와 status interpretation | AGENTS와 같은 PR 세부 절차 |
| `.codex/skills/mmp-subagent-orchestration` | 사용자 승인 시 subagent ledger/위임 | task ledger, ownership, stop conditions | agent 목록 반복 |
| `.codex/skills/mmp-self-improvement-loop` | workflow 개선 후보 분류 | state-first, candidate classification, chore branch | wrap-up 후보 수집 절차 |
| `.codex/agents/*` | 구현/리뷰/검증/PR steward 역할 | 좁은 독립 작업 수행 | 정책 판단, PR/merge 권한 |
| `scripts/mmp-workflow-agent.sh` | seed/bootstrap/commit/PR wrapper | deterministic workflow bridge | skill에 적힌 수동 명령 반복 |
| `scripts/mmp-workflow-seed.sh` | MMP local seed gate | Issue별 local seed 상태 | Ouroboros Seed와 별도 입력 |
| `scripts/pr-create-guard.sh` | PR 전 local-ci/seed/label guard | hard gate | 요구사항 해석 |
| `scripts/mmp-local-ci.sh` | Docker local validation | final validation marker | host dependency mutation |
| Ouroboros `ooo` | session-internal skill prefix + Seed lifecycle | Interview/Seed/Evaluate-style upstream spec | MMP local seed와 분리된 별도 truth |

## 권장 목표 구조

### 1. 단일 요구사항 원본: `Execution Brief`

`ooo interview`, `deep-interview`, GitHub Issue body, plan doc, MMP local seed는 모두 같은 정보를 담는다. 앞으로는 다음 순서를 표준으로 둔다.

- [ ] `Execution Brief`를 1차 원본으로 둔다.
- [ ] `Execution Brief` 필드: 목표, 범위, 제외, 제약, 완료 기준, Coverage Plan, 열린 질문, source seed id.
- [ ] `mmp-issue-planning`은 이 브리프를 GitHub Issue body와 plan doc으로 변환한다.
- [ ] `mmp-workflow-seed.sh`는 같은 브리프에서 `.git/mmp-workflow/seeds/issue-*.json`을 생성한다.
- [ ] PR 생성 가드는 브리프/seed/status가 서로 맞는지만 확인한다.

결과적으로 사용자는 `ooo interview`로 정리한 내용을 다시 local seed command에 반복 입력하지 않는다.

### 2. 책임 분리 원칙

- `AGENTS.md`: “반드시 지켜야 하는 정책”만 남긴다.
- skills: 사람이 읽고 에이전트가 따라야 하는 절차를 소유한다.
- scripts: 실패하면 안 되는 deterministic gate를 소유한다.
- agents: 위임 받은 좁은 실행/리뷰/검증만 한다.
- docs/plans: 장기 맥락과 마이그레이션 계획을 소유한다.
- memory/self-improvement state: 반복 증거와 resolved 상태만 소유한다.

## 흡수/마이그레이션 작업 계획

### Phase 1. 브리프-Seed 브리지

- [ ] `scripts/mmp-workflow-seed.sh`에 `init-from-brief` 또는 `init --brief-file <path>` 모드를 추가한다.
- [ ] brief JSON/Markdown 최소 스키마를 `docs/ops/workflow/execution-brief.schema.md`에 문서화한다.
- [ ] `mmp-issue-planning` skill에 “Issue 생성 후 seed를 별도 재입력하지 말고 brief에서 생성” 규칙을 추가한다.
- [ ] `pr-create-guard.sh`가 막혔을 때 출력하는 복구 명령을 `mmp-workflow-agent bootstrap --issue ... --from-brief ...` 중심으로 바꾼다.
- [ ] PR #583 사례를 회귀 테스트로 삼아 `ooo interview 결과 → Issue/plan → local seed → PR guard` 흐름을 한 번에 통과시키는 smoke script를 추가한다.

검증:

- [ ] `scripts/mmp-workflow-seed.sh init --brief-file <fixture> --issue <test>`가 seed를 생성한다.
- [ ] `scripts/mmp-workflow-seed.sh validate --issue <test>` 통과
- [ ] `PR_CREATE_GUARD_DRY_RUN=1 MMP_ISSUE_NUMBER=<test> scripts/pr-create-guard.sh ...` 통과

### Phase 2. `AGENTS.md` 다이어트

- [ ] `AGENTS.md`의 PR lifecycle 상세 중 skill과 중복되는 긴 절차를 `mmp-pr-lifecycle` pointer로 줄인다.
- [ ] subagent 목록 반복은 `mmp-subagent-orchestration`과 `.codex/agents` inventory pointer로 줄인다.
- [ ] self-improvement 세부 절차는 `mmp-self-improvement-loop` pointer로 줄이고, `AGENTS.md`에는 “기능 작업과 분리”와 “state-first”만 남긴다.
- [ ] 단, 안전 금지사항, PR/merge 권한, ready-for-ci 금지, 사용자 변경 보존은 `AGENTS.md`에 유지한다.

검증:

- [ ] `AGENTS.md`에서 각 durable rule의 master가 하나인지 표로 점검한다.
- [ ] skills가 없는 새 세션에서도 최소 안전 규칙을 이해할 수 있는지 smoke review한다.

### Phase 3. PR 대기/CodeRabbit steward 경계 자동화

- [ ] `mmp-pr-lifecycle`에 “main thread 단발 조회 2회 또는 90초 이상 pending이면 steward handoff 후보” 기준을 명시한다.
- [ ] `scripts/mmp-pr-status.sh` 출력에 `recommended_next_action`을 추가한다.
  - 예: `poll_once`, `handoff_to_steward`, `merge_ready`, `fix_required`, `blocked`.
- [ ] `scripts/mmp-ci-steward-handoff.sh`가 local validation marker와 Coverage Plan 요약을 자동 포함하게 한다.
- [ ] `mmp-ci-steward` final report의 `MERGE_READY` / `MERGE_CANDIDATE` 판단을 `mmp-pr-status.sh` JSON output에 맞춘다.

검증:

- [ ] pending CodeRabbit fixture 또는 dry-run PR status fixture로 recommended action이 맞게 나온다.
- [ ] handoff 문서에 PR number, head SHA, CI scope, local validation marker, unresolved thread count가 포함된다.

### Phase 4. local-ci host/container dependency 격리

- [ ] `scripts/mmp-local-ci.sh quick`가 host `node_modules`를 Linux 컨테이너 기준으로 재설치하지 않도록 Docker volume 또는 container-local install path를 검토한다.
- [ ] 어려우면 최소한 `scripts/mmp-local-ci.sh quick` 종료 후 host platform 복구 안내를 marker 또는 출력에 남긴다.
- [ ] 장기 권장: local-ci compose에 별도 pnpm store/node_modules volume을 둔다.

검증:

- [ ] macOS host에서 `pnpm --filter @mmp/web typecheck` 통과
- [ ] local-ci 컨테이너에서 `scripts/mmp-local-ci.sh quick` 통과
- [ ] local-ci 이후 host에서 추가 `pnpm install` 없이 `pnpm --filter @mmp/web typecheck`가 다시 통과

### Phase 5. wrap-up과 self-improvement 후보 연결

- [ ] `mmp-docs-wrap-steward`는 canonical docs를 수정하지 않고 후보를 `발견 / 수행 / 판단 / 미해결`로 낸다.
- [ ] `mmp-self-improvement-loop`는 그 후보를 `docs/ops/self-improvement/state.json` 또는 candidates file에 반영할지 결정한다.
- [ ] 반복 근거가 약한 단발 실수는 `no-change`로 남긴다.
- [ ] 이번 PR #583 사례는 후보로 분류한다.
  - candidate: `ooo-seed-mmp-seed-bridge`
  - candidate: `local-ci-platform-node-modules-isolation`
  - candidate: `coderabbit-pending-steward-threshold`

검증:

- [ ] `scripts/mmp-self-improvement-scan.sh --summary`가 active candidate를 요약한다.
- [ ] resolved 처리된 candidate가 다시 active로 뜨지 않는다.

## 중복 제거 매트릭스

| 중복 흐름 | 현재 증상 | 흡수 방향 |
| --- | --- | --- |
| `ooo Seed` vs MMP local seed | PR guard에서 같은 요구사항 재입력 | Execution Brief bridge |
| `AGENTS.md` PR 상세 vs `mmp-pr-lifecycle` | 규칙이 길고 변경 시 두 곳 수정 | AGENTS는 policy, skill은 procedure |
| `mmp-issue-planning` vs `mmp-issue-architect` | 둘 다 issue body 구조를 설명 | skill은 workflow, agent는 위임 시 draft |
| `mmp-docs-wrap-steward` vs self-improvement | 둘 다 개선 후보를 다룸 | wrap은 read-only candidate, self-improvement는 적용 결정 |
| main thread PR polling vs `mmp-ci-steward` | pending 확인을 main이 반복 | threshold 후 steward handoff |
| local-ci install vs host pnpm install | platform optional dependency 충돌 | container-local dependency isolation |

## 권장 실행 순서

1. [ ] Phase 1 브리프-Seed 브리지를 먼저 구현한다.
   - 효과: 이번 PR #583에서 발생한 수동 재입력 문제가 바로 사라진다.
2. [ ] Phase 4 local-ci dependency 격리를 두 번째로 처리한다.
   - 효과: 검증 후 macOS 개발환경 복구 명령이 필요 없어져 작업 시간이 줄어든다.
3. [ ] Phase 3 PR steward threshold를 세 번째로 처리한다.
   - 효과: CodeRabbit pending 상태에서 main context를 오래 붙잡지 않는다.
4. [ ] Phase 2 AGENTS 다이어트는 마지막에 한다.
   - 이유: Phase 1~3의 실제 변경이 안정된 뒤 master/pointer 정리가 안전하다.
5. [ ] Phase 5 wrap/self-improvement 연결은 Phase 1~4에서 나온 반복 증거를 후보화하면서 같이 진행한다.

## PR 묶음 제안

- PR A: 브리프-Seed 브리지 + PR guard 메시지 정리
  - 변경: `scripts/mmp-workflow-seed.sh`, `scripts/mmp-workflow-agent.sh`, `scripts/pr-create-guard.sh`, `mmp-issue-planning`
  - 검증: seed/guard smoke
- PR B: local-ci dependency isolation
  - 변경: `scripts/mmp-local-ci.sh`, `docker-compose.local-ci.yml`
  - 검증: host + container typecheck/local-ci
- PR C: PR steward threshold/status recommendation
  - 변경: `scripts/mmp-pr-status.sh`, `scripts/mmp-ci-steward-handoff.sh`, `mmp-pr-lifecycle`, `mmp-ci-steward`
  - 검증: status fixture/dry-run + handoff output
- PR D: AGENTS.md diet and pointer cleanup
  - 변경: `AGENTS.md`, skill docs only
  - 검증: manual rule master review

## 이번 계획에서 바로 수정하지 않는 것

- 실제 `AGENTS.md`/skills/scripts 변경은 하지 않는다. 이 문서는 migration issue/PR을 만들기 위한 설계 기준이다.
- 기존 global Ouroboros 설치나 `~/.codex/skills`는 건드리지 않는다. MMP repo-local workflow가 흡수할 접점만 정의한다.
- subagent 자동 사용 정책은 바꾸지 않는다. Codex sub-agent는 여전히 사용자가 명시적으로 위임/병렬 작업을 승인한 경우에만 사용한다.
