# Seed 템플릿 (심층 인터뷰 결과 기록용)

아래 JSON은 `scripts/mmp-workflow-seed.sh`로 저장되는 최소 구조입니다.  
deep-interview가 끝난 뒤 status는 **approved**로 올려야 분기/PR 가드를 통과합니다.

```json
{
  "issue": 248,
  "title": "issue 제목 또는 실행 목표",
  "status": "draft",
  "source": "deep-interview",
  "objective": "왜 이 작업을 하는지 한 문장",
  "scope_in": "이슈/모듈 포함 범위",
  "scope_out": "명시적으로 제외할 항목",
  "constraints": "시간, 리스크, 의존성 제약",
  "acceptance_criteria": [
    "요건이 누락되지 않음을 증명할 기준 1",
    "검증/테스트 기준 2"
  ],
  "done_criteria": [
    "모든 코드 변경이 완료된 시점 기준",
    "회귀 및 smoke 기준 완료"
  ],
  "risks": [
    "잠재 리스크 1",
    "잠재 리스크 2"
  ],
  "created_at": "2026-05-11T00:00:00Z",
  "updated_at": "2026-05-11T00:00:00Z",
  "owner": "작성자",
  "branch_hint": "feat/issue-248-... (선택)",
  "follow_up": []
}
```

## 생성/상태 전환 명령
- 생성:
  - `scripts/mmp-workflow-seed.sh init --issue <번호> --title "<제목>" --objective "<목표>" --scope-in "<범위>" --scope-out "<제외범위>" --acceptance "<항목>" --done-criteria "<항목>" --risk "<위험>"`
- 승인:
  - `scripts/mmp-workflow-seed.sh set-status --issue <번호> --status approved`
- 완료:
  - `scripts/mmp-workflow-seed.sh set-status --issue <번호> --status completed`
- 에이전트 자동 마감:
  - `scripts/mmp-workflow-agent.sh commit --issue <번호> --create-pr --message "feat: issue-<번호> 작업" -- --title "feat: issue-<번호> 작업"`
- 블록:
  - `scripts/mmp-workflow-seed.sh set-status --issue <번호> --status blocked --reason "<차단사유>"`

## 운영 체크 포인트
- `status`는 `draft/approved/completed/blocked` 중 하나여야 함
- `approved` 진입 시 최소 acceptance/done 기준이 채워져 있어야 함
- PR/branch gate는 기본적으로 `approved` 이상을 요구
- blocked 이면 block_reason이 필수
