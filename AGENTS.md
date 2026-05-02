# Murder Mystery Platform (MMP v3)

다중 테마 실시간 멀티플레이어 머더미스터리 게임 플랫폼. Go 백엔드 + React SPA + PostgreSQL + Redis.

이 파일은 기존 루트 `CLAUDE.md`를 Codex용으로 이전한 지시문이다. Claude Code용 레거시 문맥은 `CLAUDE.md`에 남겨두되, Codex가 따라야 할 규칙은 이 파일을 우선 갱신한다.

## 기본 소통 언어

- 사용자는 한국어 사용자다. 대화, 작업 보고, 설계 설명, 의사결정 설명은 기본적으로 한국어로 작성한다.
- 코드 식별자, 로그, 명령어, 에러 메시지, 공식 API 명칭은 원문을 유지한다.
- 사용자가 영어 산출물을 명시적으로 요청한 경우에만 영어로 작성한다.

## 카논 위치

- 하나의 규칙은 하나의 master 파일에서만 정의한다. 다른 파일은 세부 내용을 중복하지 말고 master 파일을 가리킨다.
- 프로젝트 메모리의 canonical 위치는 repo 내부 `memory/`다. 사용자 홈의 메모리는 archival 용도로만 본다.
- 진행 중 plan 추적의 canonical 위치는 `docs/plans/<phase>/checklist.md`와 활성 git branch다.
- 충돌 시 우선순위: 이 파일 및 하위 `apps/*/AGENTS.md` > repo `CLAUDE.md` > 글로벌 Claude 설정.
- Claude 전용 `@import`, hooks, status line, permission allowlist, plugin command는 Codex 네이티브 기능이 아니다. 필요한 경우 명시적 지시문이나 Codex MCP/plugin 설정으로 변환한다.

## 작업 루틴

- 비단순 작업을 시작할 때는 관련 `memory/MEMORY.md` 포인터와 활성 plan checklist를 먼저 확인한다.
- `docs/plans`와 `memory` 검색은 `qmd`가 있으면 우선 사용하고, 없으면 `rg`를 사용한다.
- 아키텍처나 의존성 질문은 `graphify-out/` 그래프가 있으면 먼저 참고한 뒤 소스를 확인한다.
- 변경은 사용자 요청 범위에 맞춰 외과적으로 수행한다. 관련 없는 리팩터링은 하지 않는다.
- 사용자가 명시적으로 spike를 요청하지 않는 한 partial 구현, TODO placeholder, mock 동작, 테스트 스킵, 우회성 fix를 남기지 않는다.
- 실패가 발생하면 코드를 바꾸기 전에 근본 원인을 먼저 파악한다.
- 워크트리의 사용자 변경을 보존한다. 내가 의도적으로 수정하지 않은 파일은 되돌리지 않는다.

## 계획 및 보고

- 진단, 설계, 의사결정 보고는 한국어로 `원인` -> `결과` -> `권장` 구조를 사용한다.
- 계획과 보고는 비전문가도 이해할 수 있게 작성한다. 전문 용어는 처음 등장할 때 쉬운 말로 풀어쓰고, 명령어/도구 이름은 "무엇을 확인하거나 바꾸는지"를 함께 설명한다.
- 선택지를 제시할 때는 기술적 장단점뿐 아니라 사용자 입장에서의 영향, 운영 부담, 실패 시 증상을 같이 설명한다.
- 아키텍처, UI, 워크플로우, API, 데이터 모델의 선택지를 제시할 때는 실제 서비스, 오픈소스 레퍼런스, 표준 문서, 업계 사례를 먼저 조사하고 각 옵션의 근거를 밝힌다.
- 여러 단계가 필요한 작업은 간결한 계획을 유지하고 진행 상태가 바뀔 때 갱신한다.
- Codex sub-agent는 사용자가 명시적으로 위임이나 병렬 agent 작업을 요청한 경우에만 사용한다. Claude 시대의 자동 위임 규칙은 Codex에서는 로컬 계획으로 해석한다.

## Git 및 PR 규율

- `main`을 보호한다. 병합 가능한 변경은 feature branch와 PR을 사용한다.
- PR 또는 merge 전에는 관련 focused check를 실행하고 `memory/feedback_pre_pr_review_checklist.md` 기준으로 검토한다.
- PR 제목과 본문은 기본적으로 한글로 작성한다. 코드 식별자, 명령어, 에러 메시지, 공식 API명은 원문을 유지한다.
- Full CI 실행 후에는 GitHub Actions CI뿐 아니라 Codecov Report를 확인한다. 커버리지 리포트가 실패하거나 기준 미달 코멘트를 남기면 원인을 확인하고 필요한 테스트 보강 또는 코드 수정을 진행한 뒤 다시 검증한다.
- PR 생성 후 CodeRabbit 리뷰를 확인한다. 문제 제기 코멘트는 수정 커밋으로 해결하고, GitHub review thread가 unresolved 상태로 남지 않도록 resolve 상태까지 확인한 뒤 merge한다.
- Full CI는 리뷰 대응이 끝난 뒤 `ready-for-ci` 라벨을 붙여 실행한다. 리뷰/Codecov/CodeRabbit 수정 중에는 라벨을 제거해 heavy CI 반복 실행을 피하고, merge 전에는 반드시 라벨을 다시 붙여 Go/TypeScript/Coverage/E2E/Docker/Security checks를 통과시킨다.
- PR/CI/리뷰 상태 확인을 반복할 때는 GitHub/API 호출을 과도하게 하지 않는다. 기본 폴링 간격은 30초~1분으로 두고, 긴 작업은 `--watch --interval 30` 이상 또는 단발 조회를 사용한다.
- 4-agent review 정책의 canonical 문서는 `memory/feedback_4agent_review_before_admin_merge.md`다. Codex에서 사용 가능한 도구와 사용자 승인 범위에 맞춰 적용한다.

## 코드 및 아키텍처 규칙

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
