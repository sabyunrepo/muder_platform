# ab-runner — A/B 테스트 + 자기개선 루프 (M4 레퍼런스)

> **현재 상태**: 설계만 완료, 스크립트 미구현. M4 진입 시 `.claude/designs/mmp-pilot/m4-plan.md` 참조하여 활성화.
> mmp-pilot SKILL.md Phase 1의 `--ab` 모드에서 호출됨. M3까지는 스텁("M4 이후 지원") 응답.

## 목적

동일 task를 variant A(baseline) vs variant B(후보) 로 병렬 실행해 메트릭으로 판정한 뒤, 검증된 개선안만 실제 파일에 적용한다. 자동 적용 금지(승인 게이트).

## 실행 흐름

```
/plan-go --ab <experiment-id>
  1. ab-runner.sh init <exp-id>
     → runs/{run-id}/ab/{exp-id}/{A,B}/ 샌드박스 생성
     → manifest.json에 variant 구성(A=현재 파일, B=proposal diff 적용본)
  2. ab-gate hook 활성화 (PreToolUse Edit/Write)
     → 샌드박스 밖 경로 쓰기 차단
  3. 각 variant 실행(Layer 2 팀)
     → variant A: 현행 에이전트/스킬로 task 수행
     → variant B: proposal 반영본으로 수행
     → 각자의 SUMMARY.md + logs/ 생성
  4. ab-runner.sh collect
     → A, B 각각의 지표를 METRICS.jsonl에 append
  5. ab-runner.sh verdict
     → 가중치 합 score_A, score_B 계산
     → 상대 이득 ≥ +3% AND 보안 회귀 0건 → winner=B
     → VERDICT.md 작성
  6. 사용자 승인(AskUserQuestion)
     → 승인 시 proposal-apply.sh 실행 → 실제 파일 반영
     → 거부 시 proposal archive
  7. ab-gate hook 비활성화 + 락 해제
```

## 샌드박스 경계

| 경로 | A/B 모드 허용 여부 |
|------|------------------|
| `.claude/runs/{run-id}/ab/{exp-id}/**` | ✓ (variant 작업 공간) |
| `.claude/proposals/**` | 읽기만 |
| `memory/mmp-pilot-metrics.jsonl` | append only (jsonl 전용 훅) |
| `apps/**`, `docs/**`, 기타 repo 코드 | ✗ (ab-gate가 차단) |

## 변형 축(실험 카테고리)

| 카테고리 | A (baseline) | B (후보) 소스 |
|---------|--------------|---------------|
| agent-prompt | `.claude/agents/{name}.md` 현행 | proposal의 diff 적용본 |
| team-strategy | 파이프라인 3인 | 팀 5인(TeamCreate) |
| team-size | N명 | M명 (proposal 지정) |
| skill-pushy | description 현행 | 강화된 description |
| skill-body | 간결 본문 | 예시 추가 본문 |
| shared-ref | 미참조 | 공용 스킬 참조 강제 |
| reviewer-count | 2인 | 4인 |

variant B 소스는 `.claude/proposals/{id}.md`의 frontmatter `target_files` + 본문 diff 블록에서 추출.

## 메트릭 수집

variant별 SUMMARY.md 파싱 + hooks.jsonl 카운트 + 세션 메타(토큰·시간):

```jsonl
{"ts":"…","run_id":"…","ab":{"exp":"team-size","variant":"A"},"duration_sec":612,"tokens_used":38400,"violations":{"scope":0,"line_200":0},"tests":{"failed":0,"coverage_delta":1.8},"security":{"blockers":0}}
{"ts":"…","run_id":"…","ab":{"exp":"team-size","variant":"B"},"duration_sec":840,"tokens_used":52100,"violations":{"scope":0,"line_200":0},"tests":{"failed":0,"coverage_delta":2.4},"security":{"blockers":0}}
```

## 판정 알고리즘

```
score(v) = Σ normalize(metric_v) × weight × direction
  direction: -1(lower is better) | +1(higher is better)
  normalize: z-score 또는 baseline 대비 비율

relative_gain = (score_B - score_A) / |score_A|

accept = (relative_gain ≥ 0.03) AND (no regression in [scope, blockers, failed])

if !accept and |relative_gain| < 0.03:
    추가 샘플 N=3 제안 → 평균 재계산
```

### VERDICT.md 예
```markdown
---
exp: team-size-3vs5
run_id: r-...-xyz
winner: B
relative_gain: 0.047
samples: 3
score_A: 84.2
score_B: 88.1
regressions: []
---
## 결과
- duration: +37% (B 더 느림)
- coverage_delta: +0.6%p (B 우세)
- 보안·scope·failed 모두 회귀 0
## 추천
- Apply proposal {id}? [y/N]
```

## Proposal 적용 (proposal-apply.sh)

- `target_files`의 각 파일에 diff 적용 (patch 명령)
- 원본은 `.claude/proposals/.backups/{id}/` 에 보관
- CLAUDE.md 변경 이력 append
- proposal frontmatter `status: accepted` + `applied_at`
- 적용 후 10 run 지표 회귀 모니터 트리거

## 회귀 모니터

`pattern-extractor.sh`가 proposal 적용 후 다음 10 run의 메트릭을 추적.
회귀 감지 기준:
- 적용 전 대비 scope/blockers/failed 평균 증가
- 또는 유사 가중 score 하락 ≥ 3%

회귀 시:
- proposal `status: rolled-back` + `rolled_back_at`
- target_files 원복(backup 활용)
- CLAUDE.md 변경 이력 append
- 해당 카테고리 1주 쿨다운

## 예산·안전

| 항목 | 기본값 | 이유 |
|------|-------|------|
| `AB_TOKEN_MAX` | 150k/실험 | 토큰 폭주 방지 |
| `AB_TIME_MAX` | 30분/실험 | 교착 방지 |
| `AB_CONCURRENCY` | 1 | 샌드박스 경계 단순화 |
| `AB_MIN_SAMPLES` | 3 (agent-prompt은 10) | 노이즈 필터 |
| 자동 적용 | 금지 | 반드시 사용자 승인 |

## 실패 데이터도 기록

variant가 실패해도 METRICS.jsonl에 결과를 기록한다(편향 방지). `status: "failed"` 레이블 포함.

## 의존 스크립트 (M4 생성 예정)

- `.claude/scripts/ab-runner.sh` (≤150줄)
- `.claude/scripts/ab-gate.sh` (PreToolUse hook, ≤40줄)
- `.claude/scripts/pattern-extractor.sh` (≤100줄)
- `.claude/scripts/proposal-apply.sh` (≤120줄)
- `.claude/scripts/monthly-retro.sh` (≤80줄)

세부 생성 체크리스트: `.claude/designs/mmp-pilot/m4-plan.md` §2
