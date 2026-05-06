# Codex Workflow Optimization

## 목적

이 문서는 MMP Codex 운영 표면을 어디에 기록할지 정리한다. 목표는 같은 실수를 여러 파일에 중복해서 고치지 않고, CI 비용을 늘리는 초소형 PR을 줄이며, PR steward가 CodeRabbit만 보고 완료로 착각하지 않게 만드는 것이다.

## 책임 경계

- `AGENTS.md`: 항상 알아야 하는 durable project rule만 둔다.
- `.codex/skills/*/SKILL.md`: 반복 workflow, 판단 순서, PR/Issue 작성 절차를 둔다.
- `.codex/agents/*.toml`: 특정 sub-agent 역할의 허용/금지 행동과 최종 보고 조건을 둔다.
- `scripts/*.sh`: 사람이 직접 해석하기 쉬운 규칙보다 deterministic gate를 둔다.
- `.codex/hooks.json`: repo-local hook만 둔다. user-home `~/.codex/hooks.json` 직접 변경은 이 repo PR이 아니라 별도 사용자 승인 작업으로 다룬다.

## PR 묶음 원칙

PR은 무조건 작게 쪼개는 것이 아니라 CI와 리뷰 비용까지 고려한다.

- 같은 이슈, 같은 CI scope, 같은 운영/문서/스크립트 원인의 저충돌 변경은 하나의 PR로 묶는다.
- shared contract, migration, runtime behavior, 큰 UI route, 데이터 저장 계약은 실패 영향이 크므로 별도 PR로 분리한다.
- 병렬 agent가 여러 lane으로 일해도 merge PR은 필요 이상으로 쪼개지 않는다. 병렬화는 작업 속도를 위한 것이고, PR 분할은 검증 가능성을 위한 것이다.

## Coverage와 Deferred 추적

- 코드 변경 이슈/PR은 구현 전에 `Coverage Plan`을 둔다.
- 새 handler, service, adapter, hook, 사용자 흐름은 focused test 후보를 먼저 적고 구현한다.
- Codecov patch coverage 70% 미만은 실제 blocker다. `scripts/mmp-pr-status.sh --fail-on-blocker`가 이를 non-zero로 만들도록 유지한다.
- “이번에는 최소화”한 범위는 채팅에만 남기지 않는다. 현재 issue checklist, issue comment, 또는 follow-up GitHub Issue로 추적한다.

## Hook 감사 메모

repo-local `.codex/hooks.json`은 현재 graphify stale marker만 다룬다. 반면 user-home `~/.codex/hooks.json`에는 legacy `.claude/scripts/*` 경로가 남아 있다. 이 파일은 repo PR에 포함되지 않는 전역 런타임 설정이므로, 직접 수정은 별도 승인과 별도 검증 루틴으로 처리한다.
