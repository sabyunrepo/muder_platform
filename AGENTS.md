# Murder Mystery Platform (MMP v3)

다중 테마 실시간 멀티플레이어 머더미스터리 게임 플랫폼. Go 백엔드 + React SPA + PostgreSQL + Redis.

이 파일은 기존 루트 `CLAUDE.md`를 Codex용으로 이전한 지시문이다. Claude Code용 레거시 문맥은 `CLAUDE.md`에 남겨두되, Codex가 따라야 할 규칙은 이 파일을 우선 갱신한다.

## 기본 소통 언어

- 사용자는 한국어 사용자다. 대화, 작업 보고, 설계 설명, 의사결정 설명은 기본적으로 한국어로 작성한다.
- 코드 식별자, 로그, 명령어, 에러 메시지, 공식 API 명칭은 원문을 유지한다.
- 사용자가 영어 산출물을 명시적으로 요청한 경우에만 영어로 작성한다
- 결과를 보고할때는 쉬운말로 예시를 들어가면서 보고한다. 비개발자도 알아들을수 있도록.

## 카논 위치

- 하나의 규칙은 하나의 master 파일에서만 정의한다. 다른 파일은 세부 내용을 중복하지 말고 master 파일을 가리킨다.
- 프로젝트 메모리의 canonical 위치는 repo 내부 `memory/`다. 사용자 홈의 메모리는 archival 용도로만 본다.
- 진행 중 plan 추적의 canonical 위치는 `docs/plans/<phase>/checklist.md`와 활성 git branch다.
- 충돌 시 우선순위: 이 파일 및 하위 `apps/*/AGENTS.md` > repo `CLAUDE.md` > 글로벌 Claude 설정.
- Claude 전용 `@import`, hooks, status line, permission allowlist, plugin command는 Codex 네이티브 기능이 아니다. 필요한 경우 명시적 지시문이나 Codex MCP/plugin 설정으로 변환한다.

## 작업 실행 카드

AGENTS.md 규칙은 모델이 바로 행동으로 옮길 수 있도록 `When / Do / Done when / Avoid` 구조로 해석한다. 새 규칙을 추가할 때도 추상 선언보다 실행 단계와 완료 조건을 우선한다.

### 새 작업 시작

When:
- 새 기능, 기존 구현 개선, 버그 수정, 에디터 프론트/백엔드 작업, 문서화 이상의 코드 작업을 시작할 때

Do:
1. `main` 최신 상태를 확인한다.
2. 현재 브랜치에 미정리 변경이 있으면 새 작업을 섞지 말고 commit/stash/worktree 중 하나로 분리한다.
3. 작업마다 새 feature branch 또는 별도 worktree를 만든다.
4. 관련 GitHub Issue와 `docs/plans/<phase>/checklist.md`를 확인한다.
5. Issue가 없고 작업이 추적 가능한 단위라면 먼저 Issue를 생성하거나 사용자에게 Issue 생성 계획을 보고한다.

Done when:
- 현재 branch/worktree, 관련 Issue, 구현 범위, 검증 범위가 보고되어 있다.

Avoid:
- 기존 feature branch에 무관한 새 작업을 섞지 않는다.
- `main`에 직접 커밋하거나 push하지 않는다.

### Issue 기반 진행

When:
- Phase 단위 작업, PR 분할 작업, 여러 세션에 걸치는 작업을 진행할 때

Do:
1. 작업 계획 문서와 GitHub Issue를 상호 링크한다.
2. PR 본문에 `Closes #번호` 또는 `Refs #번호`를 명시한다.
   - 해당 PR이 이슈를 완료하면 반드시 `Closes #번호`를 사용해 merge 시 자동 close되게 한다.
   - 일부만 처리하는 PR은 `Refs #번호`를 사용해 이슈가 조기 종료되지 않게 한다.
3. 작업 중 scope가 바뀌면 Issue checklist 또는 plan 문서를 먼저 갱신한다.
4. 완료 보고에는 닫힌 Issue, 남은 Issue, 다음 권장 Issue를 포함한다.
5. 새 Issue를 만들거나 기존 Issue를 재설계할 때는 가능한 경우 `mmp-issue-planning` skill을 사용한다.
6. 병렬 처리가 가능한 Issue에는 `## 병렬 작업 설계`를 포함해 병렬 가능 작업, 파일/모듈 소유권, 병렬 금지/주의 영역, 취합 방식을 명시한다.
7. Issue 작성/재작성 자체가 복잡하면 `.codex/agents/mmp-issue-architect.toml` 역할을 사용해 초안을 만들고, 메인 Codex가 scope와 우선순위를 최종 검토한다.

Done when:
- PR/commit/보고에서 어떤 Issue를 해결했는지 추적 가능하다.
- 다음 세션이 Issue 본문만 보고도 병렬 audit, 순차 통합, 검증 범위를 알 수 있다.

Avoid:
- 계획 없는 대형 PR로 여러 Issue를 한 번에 섞지 않는다. 단, 사용자가 명시적으로 묶기를 승인한 경우는 예외다.
- 병렬작업 설계 없이 여러 sub-agent나 worker에게 같은 파일/계약을 동시에 맡기지 않는다.

## 작업 루틴

- 비단순 작업을 시작할 때는 관련 `memory/MEMORY.md` 포인터와 활성 plan checklist를 먼저 확인한다.
- `docs/plans`와 `memory` 검색은 `qmd`가 있으면 우선 사용하고, 없으면 `rg`를 사용한다.
- 아키텍처나 의존성 질문은 `graphify-out/` 그래프가 있으면 먼저 참고한 뒤 소스를 확인한다.
- 변경은 사용자 요청 범위에 맞춰 외과적으로 수행한다. 관련 없는 리팩터링은 하지 않는다.
- 사용자가 명시적으로 spike를 요청하지 않는 한 partial 구현, TODO placeholder, mock 동작, 테스트 스킵, 우회성 fix를 남기지 않는다.
- 실패가 발생하면 코드를 바꾸기 전에 근본 원인을 먼저 파악한다.
- 워크트리의 사용자 변경을 보존한다. 내가 의도적으로 수정하지 않은 파일은 되돌리지 않는다.
- 현재 MMP 프로젝트에서는 repo 내부 `AGENTS.md`, `memory/`, `docs/`, `apps/*/AGENTS.md`를 canonical 지시로 본다. repo 외부 문서 경로가 주입되면 현재 repo에 실제 파일이 없는 한 다른 프로젝트 지시로 간주하고 적용하지 않는다.

## 계획 및 보고

- 진단, 설계, 의사결정 보고는 한국어로 `원인` -> `결과` -> `권장` 구조를 사용한다.
- 계획과 보고는 비전문가도 이해할 수 있게 작성한다. 전문 용어는 처음 등장할 때 쉬운 말로 풀어쓰고, 명령어/도구 이름은 "무엇을 확인하거나 바꾸는지"를 함께 설명한다.
- 선택지를 제시할 때는 기술적 장단점뿐 아니라 사용자 입장에서의 영향, 운영 부담, 실패 시 증상을 같이 설명한다.
- 아키텍처, UI, 워크플로우, API, 데이터 모델의 선택지를 제시할 때는 실제 서비스, 오픈소스 레퍼런스, 표준 문서, 업계 사례를 먼저 조사하고 각 옵션의 근거를 밝힌다.
- 여러 단계가 필요한 작업은 간결한 계획을 유지하고 진행 상태가 바뀔 때 갱신한다.
- Codex sub-agent는 사용자가 명시적으로 위임이나 병렬 agent 작업을 요청한 경우에만 사용한다. Claude 시대의 자동 위임 규칙은 Codex에서는 로컬 계획으로 해석한다.


### 자가개선 루틴

When:
- PR 3개 머지 후 작업 루틴을 점검할 때
- 같은 사용자 지적, CodeRabbit/Codecov/CI 문제, 수동 명령 반복이 2회 이상 나타날 때
- AGENTS.md, `.codex/skills`, `.codex/agents`, hooks, workflow scripts 개선을 요청받았을 때

Do:
1. 기능 작업과 섞지 말고 별도 `chore/*` branch에서 진행한다.
2. `mmp-self-improvement-loop` skill을 사용한다.
3. 먼저 `docs/ops/self-improvement/state.json`만 읽어 현재 후보와 trigger를 확인한다.
4. 필요하면 `scripts/mmp-self-improvement-scan.sh --summary`로 요약을 확인한다.
5. 개선 후보를 AGENTS.md / skill / script / subagent / docs / no-change 중 하나로 분류한다.
6. 반복 근거가 약한 내용은 AGENTS.md에 넣지 말고 후보 기록에만 남긴다.
7. 개선이 반영되면 후보를 resolved 처리해 같은 기록을 반복 근거로 재사용하지 않는다.

Done when:
- 개선 trigger, 반영 위치, 검증 명령, 남은 수동 판단 지점이 보고되어 있다.

Avoid:
- `docs/ops/self-improvement/archive/`를 기본 작업 때 읽지 않는다. 명시적 감사가 필요할 때만 연다.
- 오래된 기록 전체를 매번 다시 읽어 같은 결론을 반복하지 않는다.
- 안정되지 않은 판단을 자동 hook으로 강제하지 않는다.
- feature work를 지연시키는 대형 메타 PR을 만들지 않는다.

### Sub-agent 사용 규칙

When:
- 사용자가 위임, 병렬 agent 작업, sub-agent 사용을 명시적으로 승인했을 때
- 또는 이번 Phase 24처럼 사용자가 MMP subagent 생성/활용 규칙을 명시적으로 요청한 범위 안에서 작업할 때

Do:
1. 메인 Codex는 의도 파악, scope 결정, 위험 판단, 최종 통합, PR/label/merge 결정을 맡는다.
2. Sub-agent는 독립적으로 처리 가능한 탐색, 리뷰, 테스트 커버리지 점검, 반복 컴포넌트/테스트 작성, 긴 로그 분석에만 맡긴다.
3. 코드 수정 sub-agent에는 소유 파일/모듈을 명확히 지정하고, 다른 작업자가 있을 수 있으니 기존 변경을 되돌리지 말라고 지시한다.
4. 리뷰 sub-agent 결과는 사용자에게 raw output으로 붙이지 말고 `발견 / 수행 / 판단 / 미해결` 4섹션으로 압축한다.
5. MMP 전용 리뷰에는 가능한 경우 `.codex/agents/mmp-frontend-editor-reviewer.toml`, `.codex/agents/mmp-backend-engine-reviewer.toml`, `.codex/agents/mmp-test-coverage-reviewer.toml` 역할을 사용한다.
6. 병렬 실행 계획이 필요한 경우 `.codex/agents/mmp-parallel-coordinator.toml` 역할을 먼저 사용해 read-heavy audit, write ownership, 중단 조건, 메인 통합 체크리스트를 만든다.
7. 기본 병렬화 순서는 `parallel-coordinator → 필요한 reviewer/worker 병렬 실행 → 메인 Codex 취합 → 충돌 없는 구현 → focused 검증`이다.
8. PR 대기 시간이 다음 이슈 진행을 막을 때는 `.codex/agents/mmp-ci-steward.toml` 역할에 단일 PR의 CodeRabbit/Codecov/CI 보정만 위임할 수 있다. 메인 Codex는 별도 worktree/branch에서 다음 이슈를 진행하고, steward PR merge 후 `origin/main`을 가져와 진행 중인 worktree에 반영한다.
9. Steward-managed PR에 메인 Codex가 추가 커밋을 push한 경우, 메인 thread가 watcher로 반복 대기하지 말고 최신 head 확인을 steward에게 다시 맡긴다. 메인 Codex는 단발 상태 확인과 최종 merge 판단만 맡는다.
10. 새 sub-agent spawn이 슬롯 제한으로 막히면 먼저 기존 agent들을 `wait_agent`로 상태 확인하고, `completed` 상태인 agent는 즉시 `close_agent`로 해제한다. 앞으로도 sub-agent 최종 결과를 취합한 직후 `close_agent`까지 실행해야 해당 작업이 완료된 것으로 본다.

Done when:
- 위임한 범위, sub-agent 결과 요약, 메인 Codex의 최종 판단이 분리되어 보고된다.
- 병렬화로 줄인 작업과 병렬화하지 않은 이유가 함께 보고된다.
- 완료된 sub-agent가 `close_agent`로 해제되어 다음 작업 슬롯을 막지 않는다.

Avoid:
- secret 조회, destructive command, PR 생성, merge, 배포 트리거를 sub-agent에 맡기지 않는다. 단, CI steward는 `scripts/pr-ready-for-ci-guard.sh --apply <PR>`를 통과한 경우에만 `ready-for-ci` 라벨을 붙일 수 있다.
- 다음 로컬 작업이 바로 막히는 critical path를 불필요하게 위임하지 않는다.
- API DTO, frontend adapter/ViewModel mapping, migration, PR/CI 라벨 전환처럼 공유 계약을 바꾸는 작업은 최종 통합 전까지 여러 agent가 동시에 수정하지 않는다.

## Git 및 PR 규율

- `main`을 보호한다. 병합 가능한 변경은 feature branch와 PR을 사용한다.
- PR 또는 merge 전에는 관련 focused check를 실행하고 `memory/feedback_pre_pr_review_checklist.md` 기준으로 검토한다.
- PR 제목과 본문은 기본적으로 한글로 작성한다. 코드 식별자, 명령어, 에러 메시지, 공식 API명은 원문을 유지한다.
- PR 생성은 `scripts/pr-create-guard.sh` wrapper를 사용한다. 직접 `gh pr create`를 실행하지 않으며, 생성 단계에서는 `ready-for-ci` 라벨을 붙이지 않는다. Codex 로컬 PreToolUse hook도 이 규칙을 생성 직전에 차단한다.
- Full CI 실행 후에는 GitHub Actions CI뿐 아니라 Codecov Report를 확인한다. 커버리지 리포트가 실패하거나 기준 미달 코멘트를 남기면 원인을 확인하고 필요한 테스트 보강 또는 코드 수정을 진행한 뒤 다시 검증한다.
- 코드 작성/수정 PR은 Codecov patch coverage 70% 이상을 목표가 아니라 merge 기준으로 본다. 70% 미만이거나 Codecov가 부족 라인을 지적하면 해당 라인의 단위/통합/E2E 테스트를 보강한 뒤 다시 CI를 통과시킨다.
- PR 생성 후 CodeRabbit 리뷰를 확인한다. 문제 제기 코멘트는 수정 커밋으로 해결하고, GitHub review thread가 unresolved 상태로 남지 않도록 resolve 상태까지 확인한 뒤 merge한다.
- Full CI는 리뷰 대응이 끝난 뒤 `ready-for-ci` 라벨을 붙여 실행한다. 리뷰/Codecov/CodeRabbit 수정 중에는 라벨을 제거해 heavy CI 반복 실행을 피하고, merge 전에는 반드시 라벨을 다시 붙여 Go/TypeScript/Coverage/E2E/Docker/Security checks를 통과시킨다.
- PR/CI/리뷰 상태 확인을 반복할 때는 GitHub/API 호출을 과도하게 하지 않는다. 기본 폴링 간격은 30초~1분으로 두고, 긴 작업은 `--watch --interval 30` 이상 또는 단발 조회를 사용한다.
- 4-agent review 정책의 canonical 문서는 `memory/feedback_4agent_review_before_admin_merge.md`다. Codex에서 사용 가능한 도구와 사용자 승인 범위에 맞춰 적용한다.

### PR 리뷰와 CI 상태 전이

When:
- 코드 변경 PR을 생성하거나 merge할 때

Do:
1. 로컬 구현 후 focused test와 가능한 로컬 리뷰를 먼저 수행한다.
2. PR은 라벨 없이 생성한다. 특히 생성 시 `ready-for-ci`를 붙이지 않는다.
3. CodeRabbit 1차 리뷰를 확인한다.
4. 타당한 리뷰만 수정하고 push한다. 타당하지 않은 리뷰는 근거를 남기고 resolve한다.
5. CodeRabbit 재리뷰를 기다린다.
6. 추가 타당 리뷰가 있으면 다시 수정하고 push한다.
7. 마지막 리뷰 대응 push 이후 unresolved review thread가 0인지 확인한다.
8. 그 후 `ready-for-ci` 라벨을 붙여 full CI를 실행한다.
9. CI 실패나 Codecov Report 문제가 있으면 원인을 수정하고 다시 검증한다.
10. required checks와 Codecov 기준을 통과한 뒤 merge한다.

Done when:
- CodeRabbit unresolved thread 0
- Codecov patch coverage 70% 이상
- required CI green
- PR merged 또는 명확한 blocker 보고

Avoid:
- CodeRabbit 재검토 전 `ready-for-ci` 라벨을 붙이지 않는다.
- 새 커밋 push 직후 CodeRabbit 재검토 가능성을 무시하고 CI를 먼저 돌리지 않는다.
- GitHub/API 상태 조회를 30초보다 촘촘히 반복하지 않는다.

### 코드 작업 테스트 기준

When:
- 기능 구현, 버그 수정, 리팩터링, 에디터 UI/백엔드 engine 동작 변경이 있을 때

Do:
1. 사용자 관점의 E2E 테스트를 추가하거나 기존 E2E를 갱신한다.
2. E2E로 직접 검증하기 어려운 내부 분기와 에러 처리는 unit/integration test로 보강한다.
3. Codecov patch coverage 70% 이상을 merge 기준으로 맞춘다.
4. E2E가 부적합한 순수 내부 변경이면 PR/보고에 E2E 미작성 사유와 대체 테스트를 명시한다.

Done when:
- 변경된 사용자 흐름 또는 런타임 동작을 E2E/integration/unit 조합으로 검증했다.
- patch coverage가 70% 이상이다.

Avoid:
- 테스트 스킵, mock-only 우회, coverage 기준 미달 상태로 merge하지 않는다.

## 코드 및 아키텍처 규칙

### 설계 품질과 Adapter/Engine 경계

When:
- 새 기능을 만들거나 기존 구현을 개선할 때

Do:
1. 변경 이유가 다른 책임은 분리한다.
2. 같은 패턴이 2곳 이상 반복되거나 곧 다른 entity에 적용될 가능성이 높으면 helper/component/adapter로 추출한다.
3. 현재는 한 구현에 두더라도 추후 분리 비용이 낮도록 함수, 타입, interface 경계를 명확히 둔다.
4. 에디터 frontend는 API/저장 DTO를 제작자용 ViewModel로 바꾸는 Adapter 경계를 둔다.
5. backend는 저장된 설정을 실제 게임 진행 중 해석하는 Engine 경계를 둔다.

Done when:
- UI, adapter, backend engine, persistence 책임이 어디에 있는지 코드와 문서에서 추적 가능하다.

Avoid:
- 미래 가능성만으로 큰 framework나 범용 abstraction을 만들지 않는다.
- 1회성 UI를 무리하게 공용 컴포넌트로 만들지 않는다.
- 프론트가 backend runtime 판단, 권한, 공개 상태를 흉내 내지 않는다.


| 규칙 | Master |
| ---- | ------ |
| 코딩 작업 규율 | `memory/feedback_coding_discipline.md` |
| 파일/함수 크기 제한 | `memory/feedback_file_size_limit.md` |
| Git 워크플로우 | `memory/feedback_branch_pr_workflow.md` |
| 4-agent 리뷰 정책 | `memory/feedback_4agent_review_before_admin_merge.md` |
| 메모리 canonical 규칙 | `memory/feedback_memory_canonical_repo.md` |
| 설명 형식 | `memory/feedback_explanation_style.md` |
| 작업 루틴 | `memory/feedback_work_routine.md` |
| Graphify 우선 정책 | `memory/feedback_graphify_first.md` |
| 코드 리뷰 패턴 | `memory/feedback_code_review_patterns.md` |
| 마이그레이션 워크플로우 | `memory/feedback_migration_workflow.md` |
| WebSocket 토큰 쿼리 파라미터 | `memory/feedback_ws_token_query.md` |
| 모듈 시스템 | `memory/project_module_system.md` |
| 에러 시스템 | `memory/project_error_system.md` |
| 코딩 규칙 | `memory/project_coding_rules.md` |
| Graphify refresh 정책 | `memory/project_graphify_refresh_policy.md` |

## 프로젝트 도구 참조

| 도구 규칙 | Master |
| --------- | ------ |
| QMD 사용 | `.claude/refs/qmd-rules.md` |
| Graphify 사용 | `.claude/refs/graphify.md` |
| 이전 Opus/Sonnet 위임 참고 | `.claude/refs/opus-delegation.md` |

## 하위 패키지 규칙

- Go 백엔드 규칙: `apps/server/AGENTS.md`
- React 프론트엔드 규칙: `apps/web/AGENTS.md`

## 읽기 우선순위가 낮은 경로

직접 관련이 없으면 생성물이나 대용량 artifact는 읽지 않는다.

- `apps/server/tmp/`
- `apps/web/dist/`
- `pnpm-lock.yaml`
- `apps/server/go.sum`
- `apps/web/playwright-report/`
- `apps/web/test-results/`
- `screenshots/`
- `*.pdf`, `*.png`, `*.jpg`, `*.svg`, `*.woff2`, `*.mp4` 같은 미디어/폰트 바이너리
- `.omc/`, `.playwright-mcp/`, `.turbo/`, `.worktrees/`
- `.claude/archived_plans/`
- `apps/web/e2e/` 단, E2E 관련 작업이면 예외
