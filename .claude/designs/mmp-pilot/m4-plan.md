# M4 — A/B 테스트 + 자기개선 루프 활성화 (미실행 계획)

> M3 cutover 완료 + 메트릭 20 run 이상 축적 후 시작. 현재 상태: **대기**.

## 1. 진입 조건

- [ ] M3 cutover 완료(`.claude/scripts/m3-cutover.sh` 실행됨)
- [ ] `memory/mmp-pilot-metrics.jsonl` 라인 ≥ 20
- [ ] 최근 5 run 연속 안정(scope violation 0, blocker 0)
- [ ] 사용자 승인("M4 활성화")

## 2. 활성화 절차

### Step 1: ab-gate hook 등록 (`.claude/settings.json`)
```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Edit|Write",
        "command": ".claude/scripts/ab-gate.sh",
        "description": "A/B 모드 중 샌드박스 밖 쓰기 차단"
      }
    ]
  }
}
```

### Step 2: ab-runner 스크립트 생성
위치: `.claude/scripts/ab-runner.sh` (≤150줄)
- acquire → variant A/B 병렬 실행 → METRICS.jsonl append → VERDICT.md 생성
- 상세 로직: `.claude/skills/mmp-pilot/references/ab-runner.md`

### Step 3: pattern-extractor 생성
위치: `.claude/scripts/pattern-extractor.sh` (≤100줄)
- `memory/mmp-pilot-metrics.jsonl` 최근 N=20 집계
- 패턴: 특정 에이전트/스킬의 지표 회귀, 반복 violation
- 출력: `.claude/proposals/{date}-{topic}.md` 자동 생성

### Step 4: proposal-applier 생성
위치: `.claude/scripts/proposal-apply.sh` (≤120줄)
- proposal 상태 `accepted` → target_files에 diff 적용
- CLAUDE.md 변경 이력 append
- 회귀 모니터 등록(다음 N=10 run 지표 추적)

### Step 5: `/plan-go --ab` 플래그 활성화
현재 스텁("M4 이후 지원") 메시지 제거 → ab-runner 호출.

### Step 6: 월간 리포트 자동화
`.claude/scripts/monthly-retro.sh` — 매월 1일 실행(수동 또는 cron)
- 대상: `memory/mmp-pilot-metrics.jsonl`의 지난 달 레코드
- 출력: `memory/mmp-pilot-retrospectives/{YYYY-MM}.md`

## 3. 실험 카테고리 우선순위

안전한 실험부터 위험한 실험 순으로 점진 적용:

| 순서 | 카테고리 | 위험도 | 첫 실험 예 |
|------|---------|-------|-----------|
| 1 | skill-pushy | 낮음 | mmp-200-line-rule description 강화 |
| 2 | skill-body | 낮음 | mmp-test-strategy에 flaky 예시 추가 |
| 3 | shared-ref | 중 | security-reviewer 프롬프트에 mmp-security-rfc9457 참조 명시 |
| 4 | team-size | 중 | 풀스택 task에 5인 vs 3인 |
| 5 | team-strategy | 중 | 파이프라인 vs 팀 편성 |
| 6 | reviewer-count | 중 | 2인 vs 4인 리뷰 |
| 7 | agent-prompt | 높음 | 에이전트 역할 문구 개선 — 최소 30 샘플 필요 |

## 4. 메트릭 가중치 초기값

| 지표 | 가중치 | 방향 |
|------|-------|------|
| scope violations | 5 | lower |
| tests.failed | 5 | lower |
| security.blockers | 5 | lower |
| 200-line violations | 4 | lower |
| user_rating | 4 | higher |
| security findings_high | 3 | lower |
| lint pass ratio | 3 | higher |
| coverage_delta | 3 | higher |
| duration_sec | 2 | lower |
| tokens_used | 2 | lower |
| max_file_lines | 1 | lower |

**채택 조건**: 상대 이득 ≥ +3% AND (scope·blockers·failed) 회귀 0건.
**샘플 크기**: 단일 카테고리 실험은 N=3 평균. agent-prompt는 N=10 이상 필수.

## 5. 안전 장치

- 동시 실험 수 1 (`AB_CONCURRENCY=1`)
- 실험당 토큰 상한 150k, 시간 상한 30분
- ab-gate hook이 실제 repo 경로 쓰기 차단
- 자동 적용 금지 — 반드시 사용자 승인 게이트
- 회귀 감지 시 자동 rollback 제안 (proposal에 `status: rolled-back` 기록)

## 6. 검증(M4 self-test)

V4 시나리오: synthetic task × `--ab team-size`
- 두 variant `.claude/runs/{run-id}/ab/exp-team-size/A,B/` 격리 확인
- METRICS.jsonl 2 line 생성 확인
- VERDICT.md 생성·실제 repo 변경 0 확인
- ab-gate hook이 samples_done 증가해도 실제 파일 차단 확인

## 7. 롤백 시나리오

proposal 적용 후 다음 10 run에서 지표 회귀:

```
pattern-extractor 감지
  → proposal 상태 'rolled-back' 기록
  → target_files 원복 (backup 활용)
  → CLAUDE.md 변경 이력 append (rollback)
  → 후속 실험은 해당 카테고리 1주 쿨다운
```

## 8. 체크리스트 (M4 시작 시)

- [ ] 진입 조건 모두 충족
- [ ] ab-gate hook 등록 및 self-test 통과
- [ ] ab-runner 스크립트 500줄 이하 + 테스트
- [ ] pattern-extractor 첫 실행 결과 검토
- [ ] 첫 proposal 생성 및 사용자 검토
- [ ] 승인 시 A/B 실험, 미승인 시 proposal archive
- [ ] 월간 리포트 첫 발행 확인

## 9. 참조

- 설계 상세: `.claude/designs/mmp-pilot/03-hooks-and-ab.md` (§12-16)
- 러너 상세: `.claude/skills/mmp-pilot/references/ab-runner.md`
- 메트릭 스키마: `.claude/designs/mmp-pilot/03-hooks-and-ab.md` §14
- Proposal 템플릿: `.claude/designs/mmp-pilot/03-hooks-and-ab.md` §15
