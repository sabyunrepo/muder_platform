## MMP 작업 오퍼레이션 체크리스트 (v1)

### 목표
- Ouroboros 성향의 심층 인터뷰 기반 진행 규칙을 MMP 워크플로우에 흡수
- 브랜치 분기(`mmp-start-issue-work.sh`)와 PR 가드(`pr-create-guard.sh`)에서 인터뷰 Seed 통과 여부를 강제
- Deep-interview 산출물의 추적 기준을 체크리스트로 고정

### 진행 체크리스트

## 1) Seed 인프라
- [x] 워크플로우 상태 저장 위치를 `git common dir` 기반으로 표준화 (worktree 공유, 커밋 제외)
- [x] `scripts/mmp-workflow-seed.sh` 추가: seed 생성/상태 전환/검증
- [x] `scripts/mmp-workflow-gate.sh` 추가: issue/branch 기준 gate
- [x] `scripts/mmp-workflow-status.sh` 추가: issue/branch 상태 확인

## 2) 실행 가드 통합
- [x] `scripts/mmp-start-issue-work.sh`에 Seed gate 적용 (`approved` + acceptance + done criteria)
- [x] `scripts/pr-create-guard.sh`에 issue seed gate 적용 (`approved` + acceptance + done criteria)
- [x] gate 실패 시 가이드 메시지에 template/다음 액션 링크가 명확히 노출되는지 검증
- [x] 에이전트 최초 진입점 스크립트 추가: `scripts/mmp-workflow-agent.sh bootstrap/pr/status/complete`
- [x] `scripts/mmp-workflow-agent.sh commit` 추가: git add/commit/PR 즉시 통합 흐름 확보

## 5) 무명령 에이전트 경로
- [x] hook 기반 자동 차단(커밋/푸시) 통합(옵션) 구현
  - `scripts/mmp-workflow-install-hooks.sh`
  - `.githooks/pre-push`
- [x] issue 본문에서 acceptance/done 추출기 추가
- [x] `commit --auto-complete`로 완료 상태 자동 기록 옵션 반영

## 6) 훅 하드닝 (2026-05-11 추가)
- [x] `UserPromptSubmit` 훅 라우터에서 MMP 명령 매핑 강화(issue 추출 정밀화, 오탐 방지 경계 처리)
- [x] `SessionStart` 훅에 issue/seed 상태 기반 런타임 가이드 노출 추가
- [x] `PostToolUse` 훅에 seed 상태(무, draft, blocked, 완료기준 누락) 점검 및 경고 추가
- [x] 훅/경고 동작에 `MMP_WORKFLOW_HOOKS_ENABLED`, `MMP_WORKFLOW_HOOKS_SKIP`, `MMP_WORKFLOW_INTERVIEW_STRICT` 반영
- [x] 동일 메시지 스팸 방지를 위해 상태 파일 기반 최소 주기 적용

## 7) 외부 레퍼런스 흡수 분석
- [x] 외부 레퍼런스(우로보스) 대비 스크립트/훅/skill 존재 여부 분석 스크립트 추가: `scripts/mmp-reference-audit.sh`
- [x] 해당 분석을 실행해 채택/보류/유지 항목 산출: `bash scripts/mmp-reference-audit.sh --target https://github.com/Q00/ouroboros.git --name ouroboros`
- [x] 분석 기반 추천 2개(버전 체크, 드리프트 안내)와 보류 항목(MCP 도구 등록 검사) 문서화
- [x] 신규 분석 스킬 등록: `.codex/skills/mmp-reference-audit/SKILL.md`

## 3) 계획 문서
- [x] 실행 계획 문서 작성 (`design.md`)
- [x] Seed 템플릿 문서 작성 (`seed-template.md`)
- [x] 완료 조건 체크리스트 정리 (현재 문서)

## 4) 운영 검증
- [x] 새 스크립트 실행권한 부여
- [x] shell 문법 체크 (`bash -n`)
- [x] gate 실패/통과 시나리오 수동 dry-run 검증
- [x] PR/브랜치 생성 경로에서 seed 미입력 상태 차단이 실제 동작하는지 드라이런 재확인
- [x] 훅 라우터/세션/포스트툴 동작 회귀 스모크 테스트 실행 (`.codex/scripts/mmp-workflow-hook-smoke-test.sh`)

## 완료 조건 (체크 기준)
- [x] `MMP_WORKFLOW_INTERVIEW_STRICT=1`에서 issue 번호가 없는 브랜치 PR은 우회 메시지를 남기고 진행되지 않거나, 명시적 우회 플래그를 요구한다.
- [x] 모든 코드 변경 PR은 로컬 CI 가드 + Seed gate를 모두 통과한 상태에서만 진행된다.
- [x] Seed 상태가 `approved`로 기록되면, 인터뷰 기반 실행 계획(요구사항, 범위, 완료조건)이 최소 항목 기준을 충족한다.
- [x] 에이전트가 seed-bootstrp → worktree 생성 → PR 가드까지 1회 호출로 진행할 수 있는 경로가 문서화/실행됨.

## 운영 시 증상 체크
- branch 시작 실패: `"issue #N는 인터뷰/Seed 상태가 승인 기준에 도달하지 않았습니다."`
- PR 시작 실패: `"PR 생성 블록: issue #N 의 deep-interview seed가 승인되지 않았습니다."`
- gate 통과: `"✅ MMP workflow gate pass"` 메시지 노출
