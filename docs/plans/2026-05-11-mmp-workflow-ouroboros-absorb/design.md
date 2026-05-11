# MMP 심층 인터뷰 워크플로우 설계 (Ouroboros 흡수안 v1)

## 한 줄 목표
Ouroboros 스타일의 “흐름 시작 전 심층 인터뷰 → 완성 기준 고정 → 미완성 상태에서 실행 못함” 규칙을
MMP 스크립트로 강제해, 이슈/브랜치/PR 단계에서 규칙이 깨지는 일을 원천 차단한다.

## 대상 및 범위
- 실행 진입점
  - `scripts/mmp-start-issue-work.sh`
  - `scripts/pr-create-guard.sh`
- 공용 상태
  - `$(git rev-parse --git-common-dir)/mmp-workflow/`
- 상태 형식
  - `seeds/issue-<번호>.json`
  - `events.jsonl`

## 핵심 원리(심층 인터뷰 대응)
- **심층 인터뷰 결과를 데이터로 남김**
  - `objective`, `scope_in`, `scope_out`, `constraints`, `acceptance_criteria`, `done_criteria`
- **진행 조건을 분리**
  - `draft`: 생성 직후 (작업 시작 불가)
  - `approved`: 시작/PR 가능
  - `completed`: 종료 처리
  - `blocked`: 블로킹 처리 + block_reason 필수
- **강제 게이트**
  - issue 분기, PR 생성 모두에서 기본적으로 seed 존재 + 최소 상태 + 필수 항목 충족 검사

## 무명령 에이전트 모드(Agent-first)

사용자가 CLI 명령을 직접 실행하지 않아도, 에이전트가 한 번의 스크립트 실행으로
시작/커밋/PR 준비까지 끝내도록 `scripts/mmp-workflow-agent.sh`를 확장한다.

- `bootstrap`
  - issue 번호 기반으로 seed가 없으면 생성
  - draft/미승인 상태면 `--auto-approve`로 승인 전환(선택)
  - 조건이 맞으면 `scripts/mmp-start-issue-work.sh` 실행
- `pr`
  - 현재 브랜치 or `--issue`로 issue context를 보정하고 `scripts/pr-create-guard.sh` 실행
- `commit`
  - 현재 작업 트리 변경분을 `git add -A` + `git commit`까지 자동 수행
  - 기본적으로 `seed` 가드 + PR용 브랜치명 규칙(`feat/issue-<번호>-...`)을 보장
  - `--create-pr` 옵션으로 commit 완료 후 PR 생성까지 즉시 수행
- `status`
  - 현재 issue context 기준 seed status를 바로 조회
- `complete`
  - 세션 종료 시 `completed` 반영
- `scripts/mmp-workflow-install-hooks.sh`
  - `pre-push` 훅 설치/해제
  - pre-push에서 issue 브랜치 가드 + seed gate 통과를 강제하여 `git push/gh pr create` 단계도 자동 차단

완료 상태:
- issue 본문 템플릿에서 acceptance/done criteria 자동 추출기 동작 반영됨

## 구현 구조
- `scripts/mmp-workflow-seed.sh`
  - seed 생성/상태 변경/검증 엔진
- `scripts/mmp-workflow-gate.sh`
  - `issue` / `branch` 단위 gate 실행
  - 기본: `approved` 미만 차단
- `scripts/mmp-workflow-status.sh`
  - issue/branch 상태와 최근 이벤트 확인

## 운영 변수
- `MMP_WORKFLOW_INTERVIEW_STRICT` (기본 `1`)
  - `1`: start/pr 가드 적용
  - `0`: 임시 우회
- `MMP_ISSUE_NUMBER`
  - 브랜치에서 issue 추출이 어려울 때 수동으로 issue를 지정

## 실행 규칙(정상 경로)
1. 이슈 생성/수정 계획 수립 시 `mmp-workflow-seed.sh init ...` 실행
2. deep-interview 결과를 acceptance/done 기준까지 채움
3. `mmp-workflow-seed.sh set-status --status approved`로 승인
4. issue 작업 시작: `mmp-start-issue-work.sh`
5. 변경 후 PR 생성: `scripts/pr-create-guard.sh` (기존 local-ci 가드 + seed gate)
6. 종료/후속: `mmp-workflow-seed.sh set-status --status completed`

### 사용자 커맨드가 줄어든 자동 실행 예시
- 작업 시작/준비:
  - `scripts/mmp-workflow-agent.sh bootstrap --issue <번호> --auto-approve`
- 변경 정리:
  - `scripts/mmp-workflow-agent.sh commit --issue <번호> --message "..." --create-pr -- --title "..."`
- 훅 적용:
  - `scripts/mmp-workflow-install-hooks.sh install --force`

## 왜 Git common dir에 넣었는가
- worktree가 여러 개여도 `issue` 기준 상태 공유가 필요
- repo 루트 상태 파일 노이즈(미반영 파일) 방지

## 위험 대응
- branch명에 issue가 없으면 기본적으로 블록 대신 경고 + 수동 issue 지정 안내
- blocked 상태는 별도 사유(`block_reason`)가 없으면 실패로 간주
- acceptance/done criteria를 텍스트가 아닌 배열 기준으로 저장해 추적 가능하게 함

## 완료 기준 (추가)
- gate 실패 문구와 복구 명령이 즉시 가시화됨
- seed 템플릿 준수 여부가 `scripts/mmp-workflow-seed.sh validate`로 확인 가능
- 필요 시 `scripts/mmp-workflow-status.sh`로 증거 스냅샷(현재 상태 + 최근 이벤트) 추적
