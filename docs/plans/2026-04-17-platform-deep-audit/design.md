# Phase 19 감사 설계 — MMP v3 플랫폼 심층 감사

**Shadow plan.** Phase 18.8 observation 완료 후 `/plan-start`로 활성화. 현재는 문서만 작성.

## 목적
Phase 18.8 E2E Skip Recovery 종료 시점(안정 구간)에서 9축(디자인·UX·아키텍처·보안·성능·접근성·테스트·DX·배포)을 멀티에이전트로 심층 감사하여 Phase 19의 실행 백로그를 구조화한다.

## 산출물
- `refs/audits/{01-09}-{area}.md` × 9 (각 ≤200줄, 초과 시 `refs/topics/{area}/{sub}.md` 분할)
- `refs/shared/{scope-matrix, baseline, severity-rubric}.md` × 3
- `refs/advisor-consultations.md` (W3 cross-cutting)
- `refs/executive-summary.md` (P0/P1/P2 롤업)
- `refs/phase19-backlog.md` (PR 후보, `/plan-new` 입력 포맷)

## 팀 구성
| 역할 | 에이전트 | 신규 여부 | 담당 draft |
|-----|---------|---------|----------|
| backend 계층·AppError·크기 | go-backend-engineer | 기존 | 01 |
| frontend Zustand·컴포넌트·lazy | react-frontend-engineer | 기존 | 02 |
| 모듈 시스템 일관성 | module-architect | 기존 | 03 |
| 테스트 커버리지·skip·flaky | test-engineer | 기존 | 04 |
| 보안 OWASP·auditlog·redaction | security-reviewer | 기존 | 05 |
| 성능·관측성 | platform-perf-observability | **신규** | 06 |
| 디자인·접근성 | platform-design-a11y | **신규** | 07 |
| 문서·설계 drift | docs-navigator | 기존 | 08 |
| WS 스키마 3자 대조 | go-backend + react-frontend (공동, `mmp-ws-contract` 스킬) | 신규 스킬 | 09 |
| Cross-cutting synthesis | platform-advisor | **신규, read-only** | advisor-consultations + executive-summary + phase19-backlog |

## Advisor 패턴 — 2-pass
```
Pass 1 (W2 executor 병렬):
  각 executor → draft + "ADVISOR_ASK: Q1..Q3" (최대 3)
Pass 2 (W3a advisor intake, 1회):
  platform-advisor가 6 draft + ASK 일괄 검토 → cross-cutting + delta 지시
Pass 3 (W3b delta, 선택):
  지시받은 executor만 1 round 보완
Pass 4 (W3c synthesis, 1회):
  advisor가 executive-summary + phase19-backlog 조립
```

**호출 상한 11회**. ADVISOR_ASK 비어있으면 delta skip. cross-cutting <3이면 per-area delta 생략.

## Wave 구조
| Wave | 작업 | 모드 | Exit Criteria |
|------|-----|-----|--------------|
| W0 | 신규 에이전트·스킬·설계 파일 작성 | 직렬 | 파일 7종 생성 + frontmatter 유효 |
| W1 Foundation | docs-navigator(baseline + QMD coverage), module-architect(모듈 인벤토리), test-engineer(커버리지·skip·flaky) | 병렬 3 | scope-matrix · baseline · severity-rubric 확정 |
| W2 Specialists | 6 executor 병렬 (backend, frontend, security, perf, a11y, ws-contract 공동) | 병렬 6 | 각 draft 스키마 통과 |
| W3a Advisor intake | platform-advisor 1회 | 직렬 | cross-cutting ≥3 or "none" 근거 |
| W3b Delta | 지시받은 executor만 | 선택적 병렬 | 지시 100% 처리 |
| W3c Synthesis | platform-advisor 1회 | 직렬 | executive-summary + phase19-backlog |

## 관점 매트릭스 (scope 충돌 방지)
`refs/shared/scope-matrix.md`에 기계 가독 표로 유지. **관점이 primary, 파일 경로는 hint**. 타 영역 Finding은 `[cross:area]` 태그로 패스.

## Draft 스키마 (모든 audit 공통)
```
## Scope (≤10줄)
## Method (≤10줄)
## Findings (3-12개)
### F-{area}-{N}: {title}
- Severity: P0/P1/P2
- Evidence: file:line
- Impact: 1줄
- Proposal: 1-3줄
- Cross-refs: [cross:...] (있으면)
## Metrics
## Advisor-Ask (최대 3)
```

## Severity Rubric (초안)
- **P0**: 프로덕션 보안 · 데이터 유실 · 즉각 장애 가능성. 다음 릴리스 전 필수.
- **P1**: 사용자 경험 중대 저해 · 확장성 병목 · 팀 생산성 저하. 이번 분기.
- **P2**: 품질 개선 · 기술 부채. 백로그.

## 검증
1. **W0 스모크**: 신규 에이전트 frontmatter(`name/description/model`) 유효성, `wc -l` 500 이하.
2. **W1 dry-run**: docs-navigator 단독 실행 후 `baseline.md`가 실제 수치로 채워짐.
3. **W2 gate**: 각 draft `grep '^## Findings'` · finding 3-12 · `wc -l ≤200` · `[cross:` ≥1 · P0+P1 ≥50%.
4. **W3 log**: `advisor-consultations.md` 상단 `Invocations: N / 11` 명시. 11 초과 시 W3b 중단.
5. **최종**: executive-summary P0 ≤10, phase19-backlog PR 후보 ≥5 + `/plan-new` 포맷 준수.

## Phase 18.8 충돌 방지
- 18.8 `.claude/active-plan.json` scope는 `apps/server/internal/domain/room/**` 등 8개 경로 — 이 감사 디렉터리·에이전트·스킬 파일은 모두 scope 밖.
- 18.8 observation(3일 nightly + alert 도달) 완료 후 `/plan-start docs/plans/2026-04-17-platform-deep-audit/`.

## 참조
- 팀 인벤토리: `.claude/agents/` (9종 = 기존 6 + 신규 3: `platform-perf-observability`, `platform-design-a11y`, `platform-advisor`)
- 공유 스킬: `.claude/skills/mmp-*` (7종) + `mmp-ws-contract` 1종
- 현재 active plan: `docs/plans/2026-04-16-e2e-skip-recovery/`
- MMP v3 규칙: `CLAUDE.md`
