# mmp-pilot — Hook 보강 + A/B 러너 + 자기개선 루프

## 11. Hook 보강 목록

| 이벤트 | 훅 | 동작 |
|--------|-----|------|
| PreToolUse(Edit/Write) | scope-guard | active-plan.scope 외 파일 편집 BLOCK. **팀 서브세션에도 적용** 확인(subagent 실행 시 환경 상속 검증) |
| PreToolUse(Grep/Read) | qmd-enforcer | docs/plans, memory, docs/superpowers 경로 Grep 차단·Read 경고 |
| PreToolUse(Edit/Write) | line-200-guard | 저장 전 라인 수 체크, 200 초과 시 경고(명시 승인 시 허용) |
| PostToolUse(Edit/Write) | runs-log | 변경 파일·라인 델타를 `runs/{id}/…/logs/hooks.jsonl` append |
| PostToolUse(Task 종료) | summary-require | task 완료 시 SUMMARY.md 존재 검증, 없으면 재실행 요청 |
| PostToolUse(Bash) | build-filter | 테스트·빌드 출력 30줄+ → 에러만 요약 (기존 유지) |
| SessionStart/UserPromptSubmit | status-inject | 신규 스키마 필드 반영(run_id, heartbeat 경과 분) |
| PreCompact | state-freeze | plan 상태 + 최근 run manifest 보존 |
| Periodic (orchestrator tick) | heartbeat | run-lock.json `last_heartbeat` 갱신 |
| PostToolUse(plan-finish) | metrics-flush | runs/{id}/FINAL_SUMMARY → `memory/mmp-pilot-metrics.jsonl` append |
| **신규** ab-gate | `--ab` 모드에서 실제 repo(`apps/**`) 직접 Edit BLOCK, `runs/{id}/ab/{exp}/{A|B}/` 샌드박스 내부만 허용 |

## 12. A/B 테스트 러너 설계

### 실험 카테고리 × 변형 축

| 카테고리 | 변형 A (baseline) | 변형 B (후보) | 목적 |
|---------|-------------------|---------------|------|
| agent-prompt | 현행 agent .md | diff 적용본 | 에이전트 역할 문구 개선 검증 |
| team-strategy | 파이프라인 3인 | 팀 5인(TeamCreate) | 편성 전략 효과 측정 |
| team-size | 팀 3인 | 팀 5인 | 팀 크기-품질 상관 |
| skill-pushy | description 중간 | description 강화(pushy) | 트리거 정확도 |
| skill-body | 간결 본문 | 예시 추가 본문 | 가이드 효과 |
| shared-ref | 공용 스킬 미참조 | 참조 강제 | 200줄/QMD 위반률 |
| reviewer-count | reviewer 2인 | reviewer 4인 | 리뷰 ROI |

### 메트릭 매트릭스

| 카테고리 | 지표 | 수집 방법 | 가중치 |
|---------|------|----------|-------|
| 정확도 | scope violations | hooks.jsonl 카운트 | **5** |
| 정확도 | 200-line violations | hooks.jsonl 카운트 | **4** |
| 품질 | tests.failed | SUMMARY frontmatter | **5** |
| 품질 | lint pass ratio | SUMMARY files_changed[].lint | **3** |
| 품질 | coverage_delta | SUMMARY frontmatter | **3** |
| 보안 | security.blockers | SUMMARY frontmatter | **5** |
| 보안 | findings_high | SUMMARY frontmatter | **3** |
| 효율 | duration_sec | SUMMARY frontmatter | 2 |
| 효율 | tokens_used | 세션 메타 | 2 |
| 가독성 | max_file_lines | SUMMARY frontmatter | 1 |
| 인간 | user_rating (1-5) | 수동 입력(옵션) | **4** |

### 판정 규칙

```
score(variant) = Σ (metric_value_normalized × weight × direction)
  ※ direction: lower-is-better(violations, failed, duration…) = -1,
               higher-is-better(coverage, rating, lint pass) = +1

상대 이득 = (score_B - score_A) / |score_A|
채택 조건: 상대 이득 >= +3% AND 보안 가중지표(scope/blockers/failed) 회귀 0건
동률/불확실(<3%): "추가 샘플 N=3회" 옵션 노출, 평균으로 재판정
결과: runs/{id}/ab/{exp}/VERDICT.md (winner, delta, samples, blockers, proposal_link)
```

### 예산·안전

- 실험당 토큰 상한 `AB_TOKEN_MAX=150k`, 시간 상한 `AB_TIME_MAX=30min`
- 동시 실험 수 기본 1 (`AB_CONCURRENCY=1`)
- ab-gate hook으로 실제 repo 경로 쓰기 차단 → `runs/{id}/ab/{exp}/{A|B}/` 샌드박스만 허용
- 실험 실패도 METRICS에 기록(편향 방지)

## 13. 자기개선 루프 시퀀스

```
          ┌──────────────┐
          │   실행 run    │  (wave/task/ab)
          └──────┬───────┘
                 │ SUMMARY + hooks.jsonl + METRICS.jsonl
                 ▼
          ┌──────────────┐
  수집 →  │ metrics 집계 │  memory/mmp-pilot-metrics.jsonl append
          └──────┬───────┘
                 ▼
          ┌──────────────┐
  분석 →  │  pattern     │  최근 N=20 run 슬라이딩 윈도우
          │  extractor   │  상습 약점(top-k)
          └──────┬───────┘
                 ▼
          ┌──────────────┐
  제안 →  │  proposal    │  .claude/proposals/{date}-{topic}.md 자동 생성
          │  generator   │  (before/after diff + 가설 + 제안 실험)
          └──────┬───────┘
                 ▼ 사용자 승인
          ┌──────────────┐
  검증 →  │  A/B 러너     │  variant A=현행 vs B=proposal diff 적용본
          └──────┬───────┘
                 ▼ VERDICT winner=B
          ┌──────────────┐
  적용 →  │  applier     │  실제 파일 편집 + CLAUDE.md 변경 이력 + proposal archive
          └──────┬───────┘
                 ▼
          ┌──────────────┐
 회귀감시→│  monitor     │  다음 N=10 run 메트릭 회귀 감지 → rollback 제안
          └──────────────┘
```

## 14. 메트릭 스키마 (jsonl 레코드)

`memory/mmp-pilot-metrics.jsonl` 라인 단위:

```json
{
  "ts": "2026-04-15T09:28:44Z",
  "run_id": "r-20260415-091230-ab3",
  "mode": "wave|single|ab",
  "wave": "W0", "pr": "PR-0", "task": "Task 1 — M-7",
  "agents": ["docs-navigator","go-backend","test","security"],
  "duration_sec": 974,
  "tokens_used": 42180,
  "files_changed": 2,
  "max_file_lines": 178,
  "violations": {"scope": 0, "line_200": 0, "qmd_block": 0},
  "tests": {"run": 18, "passed": 18, "failed": 0, "coverage_delta": 2.4},
  "security": {"blockers": 0, "findings_high": 0, "findings_medium": 1},
  "user_rating": null,
  "ab": {"experiment": null, "variant": null, "verdict": null}
}
```

## 15. Proposal 문서 템플릿

`.claude/proposals/{YYYY-MM-DD}-{topic}.md`:

```markdown
---
id: prop-20260415-react-200line
created_at: 2026-04-15
pattern_source: "최근 20 run 중 react-frontend-engineer 200-line 위반 5건"
target_files:
  - .claude/agents/react-frontend-engineer.md
  - .claude/skills/mmp-200-line-rule/SKILL.md
hypothesis: "react 에이전트 정의에 분할 패턴 예시를 추가하면 위반률이 50% 감소한다"
experiment_plan:
  category: agent-prompt
  A: baseline
  B: diff 첨부
samples_required: 5
status: pending | running | accepted | rejected | rolled-back
---

## 변경 diff
```diff
- 기존 라인
+ 개선 라인
```

## 기대 효과
- violations.line_200 감소
- coverage_delta 유지

## 리스크
- description pushy 강화로 false-trigger 증가 가능 → 트리거 검증 포함
```

## 16. 검증 시나리오

| # | 시나리오 | 기대 결과 |
|---|---------|----------|
| V1 | `/plan-go` 전체 wave (Phase 18.3 W0) | W0 두 PR 병렬, worktree 머지, checklist 체크, FINAL_SUMMARY 생성 |
| V2 | `/plan-go --task "M-7"` 단일 | worktree 없이 in-place, task 1건 SUMMARY 생성, lock acquire/release |
| V3 | `/plan-go` 실행 중 `/plan-stop` → `/plan-go --resume` | partial SUMMARY 보존, 재개 시 중복 실행 없음 |
| V4 (A/B self-test) | synthetic task × `--ab team-size=2vs4` | 두 variant 샌드박스 격리, METRICS.jsonl 2 line, VERDICT.md 생성, 실제 repo 변경 0 |
| V5 (회귀 방어) | stale lock(heartbeat 70분 전) → `/plan-go --force-unlock` | 강제 해제 + 감사 로그 기록 + 신규 run 시작 |

## 17. 리스크 레지스터

| 항목 | 영향 | 완화책 |
|------|------|-------|
| 팀 서브세션에 scope hook 미상속 | Critical (scope 이탈) | ab-gate 및 PreToolUse hook을 subagent 환경에도 전파 검증, 실패 시 차단 |
| worktree 정리 실패 누수 | High (디스크/머지 충돌) | plan-finish 시 orphan worktree 스캔 + 자동 prune |
| 락 leak (크래시) | High | heartbeat + 60min stale 판정, force-unlock |
| A/B 샌드박스 탈출 | Critical | ab-gate hook으로 경로 강제, unit test로 hook 자체 회귀 감지 |
| 메트릭 편향(실패 미기록) | Medium | 실패도 반드시 append, user_rating 선택적 |
| Proposal 자동 적용 오류 | High | 승인 게이트 유지(자동 apply 금지), rollback 즉시 가능 |
| deprecated 경로로 기존 plan 중단 | Medium | M1-M2에서 dual read(schema v1/v2) |
| QMD hit miss로 docs 직접 Read | Low | docs-navigator 에이전트만 Read 허용, 팀원은 QMD 경유 강제 |

## 18. Open Questions

1. `/plan-go --ab` variant B의 diff 적용을 **실행 시점 동적 주입**할지, 사전 branch/commit으로 고정할지?
2. A/B에서 LLM 비결정성(temperature) 관리 — variant별 N회 평균을 기본화할까, N=1을 허용할까?
3. `user_rating` 수집 UX — 각 run 종료 시 prompt 띄울지, 주간 batch 설문으로 모을지?
4. worktree를 `runs/{id}` 안으로 옮겨 run-scoped 격리까지 할지(현 설계는 `.claude/worktrees/` 유지)?
5. mmp-harness SKILL은 완전 제거 vs 내부 전용 문서로 강등?
6. 6 에이전트 중 `module-architect`는 호출 빈도가 낮을 수 있음 — opportunistic 편성 기준 정교화 필요.
7. proposal-generator는 LLM 추론 기반인가, rule-based 패턴 매칭인가? 초기엔 rule+LLM 하이브리드 가정.

## 가정 (assumption 태그)
- **가정**: Claude Code의 TeamCreate는 PreToolUse hook을 팀 서브세션에 상속한다 (V1 검증 필요).
- **가정**: .claude/worktrees/ 생성·삭제는 main repo 권한으로 가능하다.
- **가정**: memory/*.jsonl append는 QMD enforcer Hook에서 제외된다(쓰기 전용 로그이므로).
- **가정**: user_rating은 선택 입력이며 누락 시 메트릭 집계에서 제외한다.
- **가정**: Phase 18.3은 현재 autopilot으로 진행 중이므로 마이그레이션 M3는 해당 Phase 종료 후에 적용.
