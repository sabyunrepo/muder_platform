# /ultraplan 입력 프롬프트 — mmp-pilot 통합 시스템 설계 (self A/B 개선 루프 포함)

> 사용법: `/ultraplan "$(cat .claude/prompts/ultraplan-mmp-pilot.md)"` 또는 /ultraplan 실행 후 본 문서 전체를 입력.

---

# 목표
MMP v3 프로젝트의 기존 /plan-* 커맨드 체계(plan-autopilot 포함)와 신규 mmp 하네스(6 agents + 6 skills)를 **병합하여 단일 신규 시스템**을 설계하라. 조합이 아니라 "하나의 새 체계"다. 기존 명칭·경로는 필요 시 재설계하되, 기존 산출물(docs/plans/, memory/, .claude/active-plan.json)은 재사용 가능해야 한다. 추가로 **자체 A/B 테스트 루프와 자기 개선 프로세스**를 설계에 포함한다. 구현은 하지 말고 설계만.

# 컨텍스트 (자급자족 — 외부 파일 접근 가정 금지)

## A. 프로젝트
- Repo: `/Users/sabyun/goinfre/muder_platform` (Go 1.25 backend + React 19 frontend + Expo)
- 규칙: 파일 크기 티어(Go 500/함수 80, TS·TSX 400/함수 60·컴포넌트 150, MD 200), AppError+RFC 9457, zerolog, mockgen+testcontainers 75%+, Zustand 3-layer, @jittda/ui+@seed-design/react+lucide-react, QMD MCP 필수(docs/plans/, memory/ Grep 차단 Hook)
- 활성 plan: Phase 18.3 보안 하드닝 (W0 PR-0 Task 1 진행중)

## B. 기존 시스템 1 — plan-* 커맨드
- 파일: `.claude/commands/plan-{new,start,status,tasks,resume,stop,finish,autopilot}.md` + `session-wrap.md`
- 상태: `.claude/active-plan.json` (scope[], waves[], current_wave/pr/task), `memory/project_phase{N}_progress.md`, `docs/plans/{YYYY-MM-DD}-{topic}/{design,plan,checklist}.md`
- plan-autopilot: wave 기반 병렬 sub-agent + `.claude/worktrees/` + 4 내장 리뷰어(security/perf/arch/test-coverage). 스크립트: `$HOME/.claude/skills/plan-autopilot/scripts/`, `.claude/scripts/plan-wave.sh`
- Hook: scope 밖 Edit/Write BLOCK, Grep on docs/plans 차단, STATUS 주입, PreCompact plan 상태 보존

## C. 기존 시스템 2 — mmp 하네스
- 에이전트 6(전원 opus): `docs-navigator, go-backend-engineer, react-frontend-engineer, module-architect, test-engineer, security-reviewer`
- 스킬 6: `mmp-harness`(TeamCreate+TaskCreate+SendMessage 오케스트레이터), `mmp-qmd-first`, `mmp-200-line-rule`, `mmp-module-factory`, `mmp-test-strategy`, `mmp-security-rfc9457`
- 산출물: `_workspace/{순서}_{에이전트}_{아티팩트}.md`
- Phase 0: active-plan.json 읽어 scope 인식. Phase 5: 결과 종합 + checklist 갱신 제안

## D. 중복·충돌 지점
1. plan-autopilot 4 내장 리뷰어 ↔ 하네스 security/test 에이전트 중복
2. wave/worktree는 autopilot만, 전문가 팀은 하네스만
3. 산출물 경로 이원화(.claude/worktrees/ vs _workspace/)
4. 진행 기록 이원화(memory/progress.md vs SUMMARY 미정)
5. 단일 task vs wave 단위 자동화 진입점 분리

---

# 설계 요구

## R1. 신규 통합 시스템
- 시스템 이름 제안(예: **mmp-pilot**). 기존 plan-* 명칭 흡수/alias 결정
- 단일 진입점 1개. wave 자동 실행, 단일 task, 재개, 중단, 상태, 아카이브 모두 이 입구에서 파생
- autopilot의 4 내장 리뷰어는 제거하고 하네스 6 에이전트로 흡수

## R2. 3-Layer 실행 모델
- **Layer 1 오케스트레이터**: wave 루프, scope enforcement, 락 관리, checkpoint, SUMMARY 파싱
- **Layer 2 동적 팀**: 6 에이전트에서 task 성격에 맞게 2~6명 선정 (TeamCreate 또는 서브에이전트)
- **Layer 3 공용 스킬**: mmp-qmd-first / mmp-200-line-rule / mmp-module-factory / mmp-test-strategy / mmp-security-rfc9457
- 단일 task도 wave 1개 × PR 1개로 모델링 → 분기 최소화

## R3. 상태·산출물 일원화
- active-plan.json 확장: phase, wave, pr, task 트리 + lock + run_id 필드
- 산출물 경로 통일: `.claude/runs/{run-id}/{wave}/{pr}/{task}/NN_agent_artifact.md` + `SUMMARY.md`
- docs/plans/, memory/progress.md는 최종 승격 경로로 유지(런 산출물 ≠ plan 문서)
- SUMMARY.md 스키마(YAML frontmatter): files_changed, line_counts, tests_run/passed/failed, coverage_delta, blockers[], next_actions[]

## R4. 락·동시성
- `.claude/run-lock.json` (owner, run_id, started_at, pid, wave/pr/task, worktree)
- 획득·해제 시점, stale 탐지(60분 무활동 등), 강제 해제 정책
- 단일 시스템이므로 시스템 간 충돌 개념 제거

## R5. 워크트리 × 팀 결합
- wave parallel PR마다 worktree 1개 + 팀 인스턴스 1개 매핑
- 팀 CWD = worktree. `_workspace` 대신 `runs/` 가 worktree 내부 또는 메인 레포 중 어디에 위치할지 결정
- 머지 전략: fast-forward + checklist/progress.md 자동 갱신

## R6. 커맨드 설계
- `/plan-new` 유지(저작)
- `/plan-start` run 컨텍스트 생성
- `/plan-go` (신규, autopilot 대체): wave 루프 + 팀 편성 + 워크트리 통합. 플래그: `--task`, `--wave`, `--until`, `--dry-run`, `--ab`
- `/plan-status`, `/plan-tasks`, `/plan-resume`, `/plan-stop`, `/plan-finish` 유지 + 스키마 업그레이드
- mmp-harness 스킬 → /plan-go 내부로 흡수(deprecated 직접 호출)

## R7. Hook 체계
- scope BLOCK Hook이 팀 서브세션에도 적용되는지 검증 + 보강
- QMD enforcer, PreCompact, SessionStart/UserPromptSubmit 유지
- 신규 Hook: run-lock 자동 정리, SUMMARY.md 생성 강제, ab-report 트리거

## R8. 마이그레이션
- alias → deprecation 경고 → 제거 3단계
- 기존 plan-autopilot.md, mmp-harness SKILL.md, `_workspace/` 경로를 신규 경로로 리디렉션
- Phase 18.3 무중단 전환 가능성 검토

## R9. 파일별 변경 계획
- **신규**: `/plan-go` 커맨드, `.claude/scripts/run-lock.sh`, `.claude/scripts/run-wave.sh`, `.claude/skills/mmp-pilot/SKILL.md`, SUMMARY 파서, ab 러너
- **수정**: plan-start/status/tasks/resume/stop/finish, active-plan.json 스키마, CLAUDE.md, 6 agents 정의(runs/ 경로 반영)
- **제거/deprecate**: plan-autopilot.md, `_workspace/` 참조, autopilot 4 내장 리뷰어 정의

## R10. **자체 A/B 테스트 + 자기 개선 루프 (핵심 추가 요구)**

### R10-1. 평가 대상
각 구성요소를 독립적으로 측정 가능해야 한다:
- 6 에이전트 각각(역할 충실도, 산출물 품질)
- 6 공용 스킬 각각(트리거 정확도, 가이드 효과)
- 오케스트레이터 워크플로우(팀 편성 결정, 데이터 전달, 에러 핸들링)
- 락·worktree 관리(회복 탄력성)

### R10-2. A/B 러너 설계
- 단일 task를 **variant A(현행)** vs **variant B(개선안)** 로 병렬 실행
- 입력: `runs/{run-id}/ab/{experiment-id}/{A|B}/` 격리된 작업 공간
- 실행: 동일 task를 두 variant로 각각 수행, 산출물·로그·시간·토큰 기록
- 변형 축(실험 카테고리):
  - 에이전트 프롬프트 변형(role/원칙 문구 차이)
  - 팀 편성 전략 변형(파이프라인 vs 팀 vs 하이브리드)
  - 스킬 본문 변형(description pushy 정도, 예시 추가 유무)
  - 공용 스킬 참조 포함 여부
  - 리뷰어 수(2인 vs 4인) 변형

### R10-3. 메트릭 정의
| 카테고리 | 지표 | 수집 방법 |
|---------|------|----------|
| 품질 | lint pass, 타입 pass, 테스트 pass, 커버리지 델타 | CI 명령 실행 |
| 정확도 | scope 위반 수, 파일/함수 크기 위반 수, hook BLOCK 수 | Hook 로그 파싱 |
| 효율 | 실행 시간, 토큰 사용량, 반복 횟수 | 세션 메타 수집 |
| 보안 | security-reviewer Blocker 수, redaction 누락 | SUMMARY 파싱 |
| 가독성 | 파일 평균 라인 수, 함수 복잡도 | 정적 분석 |
| 인간 평가 | 사용자 rating(1-5), 코멘트 | 옵션 수동 입력 |

### R10-4. 비교·판정
- 각 메트릭별 가중치 선언(scope violation > quality > efficiency > readability)
- 승자 판정 규칙: variant B가 모든 가중 지표 합이 +3% 이상일 때만 채택(노이즈 방지)
- 동률·불확실 시 "추가 샘플 N회 실행" 옵션
- 결과는 `runs/{run-id}/ab/{experiment-id}/VERDICT.md`에 기록

### R10-5. 자기 개선 루프
```
수집 → 분석 → 제안 → 검증(A/B) → 적용 → 회귀 모니터
```
- **수집 단계**: 매 run 종료 시 SUMMARY + Hook 로그 + metric → `memory/mmp-pilot-metrics.jsonl`에 append
- **분석 단계**: 최근 N run 집계 → 상습 약점 패턴 추출(예: "react-frontend-engineer가 컴포넌트 150줄 위반 3건 이상 반복")
- **제안 단계**: 패턴별로 수정 proposal 자동 생성(에이전트 프롬프트 diff, 스킬 본문 diff, 공용 스킬 추가 등). 제안은 `proposals/{date}-{topic}.md`
- **검증 단계**: 사용자 승인 시 A/B 실험으로 돌려 판정
- **적용 단계**: B 승리 시 실제 파일에 반영 + CLAUDE.md 변경 이력 갱신 + proposal archived
- **회귀 모니터**: 적용 후 다음 N run에서 메트릭 회귀 감지 시 자동 rollback 제안

### R10-6. 예산·안전 장치
- 실험당 최대 토큰/시간 상한
- 동시 실험 수 제한(기본 1)
- 실험 모드에서는 실제 repo 커밋 금지(dry-run 강제 또는 `.claude/runs/` 내부 샌드박스만 수정)
- 실험 실패도 데이터로 기록하여 편향 방지

### R10-7. 보고
- 월간 자동 리포트: "지난 달 실험 N건, 승률 X%, 개선 적용 Y건, 회귀 Z건"
- 리포트 위치: `memory/mmp-pilot-retrospectives/{YYYY-MM}.md`

## R11. 검증
- 통합 테스트 3 시나리오: 전체 phase 자동 / 단일 task 수동 / 중단 후 재개
- A/B 파이프라인 self-test 시나리오(synthetic task로 러너·메트릭·판정 체인 검증)
- Regression 방어: scope 이탈, 락 leak, worktree 정리 실패, A/B 샌드박스 경계 침범

# 제약
- 파일 크기 티어 하드 리밋 전 파일 적용 (Go 500 / TS·TSX 400 / MD 200 + 함수 한도)
- QMD MCP 우선
- docs/plans/{date}-{topic}/ + memory/project_phase{N}_progress.md 구조 유지
- Phase 18.3 무중단 전환
- 단일 입구 커맨드
- A/B 루프가 일상 실행을 지연시키지 않도록 opt-in(`--ab` 플래그)

# 출력 형식 (반드시 이 순서)
1. 시스템 이름 제안 + 설계 요약(500자 이내)
2. 3-Layer 다이어그램
3. 단일 진입점 커맨드 스펙 표(플래그·동작·기본값)
4. active-plan.json 확장 JSON 스키마
5. run-lock.json 스키마 + 상태 다이어그램
6. `.claude/runs/` 디렉터리 트리 예시(A/B 공간 포함)
7. SUMMARY.md 스키마(YAML)
8. 실행 흐름 시퀀스 3개(전체 wave / 단일 task / 재개)
9. 파일별 변경 계획 표(신규/수정/제거 × 경로 × 핵심 변경)
10. 마이그레이션 단계(alias→경고→제거 타임라인)
11. Hook 보강 목록
12. **A/B 테스트 러너 설계**(실험 카테고리 × 변형 축 표 + 메트릭 표 + 판정 규칙)
13. **자기 개선 루프 시퀀스 다이어그램**(수집→분석→제안→검증→적용→회귀)
14. **메트릭 스키마**(jsonl 레코드 필드 정의)
15. **Proposal 문서 템플릿**
16. 검증 시나리오(통합 3 + A/B self-test 1)
17. 리스크 레지스터(항목 × 영향 × 완화)
18. Open Questions

# 기타
- 한국어 출력
- 표·다이어그램·리스트 우선, 산문 최소화
- 추측은 "가정:" 태그로 명시
- 설계만. 코드 작성 금지.
