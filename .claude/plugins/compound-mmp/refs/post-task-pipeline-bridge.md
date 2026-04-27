# Post-Task-Pipeline Bridge

`/compound-review`가 `.claude/post-task-pipeline.json` (repo root, 218줄)의 `after_pr` 항목을 읽어 4-agent 병렬 호출하는 카논 위치.

## 카논 위치
`/Users/sabyun/goinfre/muder_platform/.claude/post-task-pipeline.json`

## 4-agent 카논 매핑 (after_pr 안)

| name | type | agent (OMC) | model | parallel_group | 역할 |
|------|------|-------------|-------|----------------|------|
| `review-security` | subagent | `oh-my-claudecode:security-reviewer` | opus | review | auth/권한, injection, race, secret |
| `review-perf` | subagent | `oh-my-claudecode:code-reviewer` | sonnet | review | lock contention, hot path, goroutine leak |
| `review-arch` | subagent | `oh-my-claudecode:critic` | opus | review | SOLID, layering, design drift |
| `review-test` | subagent | `oh-my-claudecode:test-engineer` | sonnet | review | race, edge case, coverage |

> 정정 (이전 plan 초안): "architect"가 아닌 **`critic`** 이 카논. opus 모델로 ADVERSARIAL 모드 작동.

## 호출 패턴

`/compound-review`는 한 메시지에서 4개 Task tool 동시 spawn (한 message-block에 4 tool calls):

```
Task(subagent_type="oh-my-claudecode:security-reviewer", model="opus", prompt="<post-task-pipeline.json review-security.prompt 치환>")
Task(subagent_type="oh-my-claudecode:code-reviewer", model="sonnet", prompt="...")
Task(subagent_type="oh-my-claudecode:critic", model="opus", prompt="...")
Task(subagent_type="oh-my-claudecode:test-engineer", model="sonnet", prompt="...")
```

`{pr_id}`, `{pr_title}`, `{design}` 토큰은 `/compound-review` 인자와 활성 phase의 `design.md` 경로로 치환.

## P0–P3 라우팅 (Compound `ce-code-review` 어휘 차용)

| 심각도 | 라우팅 | 예시 |
|--------|--------|------|
| P0 (CRITICAL) | manual — 사용자 결정 대기 | RCE, SQLi, race deadlock |
| P1 (HIGH) | manual — 사용자 결정 대기 | auth bypass, hot-path lock contention |
| P2 (MEDIUM) | gated_auto — 다음 PR 이월 가능 | edge case 누락, coverage 미달 |
| P3 (LOW) | advisory — 정보성 | 네이밍, 문서 |

## 자동 fix-loop 금지

post-task-pipeline.json v2부터 `on_fail: "manual_review_required"` 정책. **PR-2c (#107) hotfix #108 사고** 이후 자동 fix-loop는 모두 제거. HIGH 발견 시:

1. 결과를 `docs/plans/<phase>/refs/reviews/<pr-id>.md`에 저장
2. 사용자에게 4 reviewer 결과 종합 표시
3. **사용자 결정 대기** (수정/이월/무시 중 선택)
4. 사용자가 "수정" 선택 시 `/compound-work [pr-id]`로 재진입 (별도 명시 호출)

## 토큰 sanitize 의무 (security HIGH-1 대응)

`{pr_id}`, `{pr_title}`, `{plan.id}`, `{design}`, `{stage_name}`, `{findings}`, `{wave.id}`, `{wave.name}` 토큰 치환 시 **shell injection 방지** 필수.

### 절대 금지 패턴
```bash
# BAD — 단순 sed 치환 후 bash -c
cmd=$(echo "$template" | sed "s/{pr_title}/$pr_title/g")
bash -c "$cmd"   # RCE: pr_title="; rm -rf /"
```

### 강제 패턴
1. **CLI 인자 분리** — git/gh 명령은 `-m "$msg"` 형태로 직접 인자 전달, shell escape 불필요:
   ```bash
   git commit -m "feat($plan_id): $pr_id $pr_title"   # 환경변수 인용
   ```
2. **정규식 화이트리스트** — 진입 시 검증:
   ```bash
   [[ "$pr_id" =~ ^PR-[0-9]+[a-z]?$ ]] || { echo "invalid pr_id"; exit 1; }
   [[ "$plan_id" =~ ^[a-zA-Z0-9_-]+$ ]] || abort
   ```
3. **subagent prompt 토큰** — Task tool은 prompt 문자열을 그대로 전달하므로 shell context 없음. 안전. 단 prompt 내용을 Bash로 다시 expand하는 wrapper는 금지.
4. **임시 파일** — `gh pr create --body-file`은 `mktemp`로 생성, 고정 파일명 `.pr-body.tmp` 금지.

이 규칙은 PR-3/4/5/7 디스패처·hook 구현 시 lint/테스트로 강제한다.

## 검증 (PR-2c 시뮬레이션)

## 검증 (PR-2c 시뮬레이션)

상세 절차: `refs/sim-case-a.md` (PR-10 진입 시 패치 파일 + 기대 출력 명세).

요약:
- handleCombine 의도적 lock-in-lock 패치 적용 (정확한 base SHA 확인은 PR-10 진입 시점)
- `/compound-review PR-2c-sim` 실행 → review-perf 또는 review-arch가 "lock contention" HIGH 분류
- Pass 기준: HIGH ≥1건. Fail 시 4-agent prompt 강화
