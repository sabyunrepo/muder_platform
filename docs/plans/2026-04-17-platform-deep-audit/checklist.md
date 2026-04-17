# Phase 19 감사 — 체크리스트

<!-- STATUS-START -->
**Active**: Phase 19 Platform Deep Audit — shadow plan (W0 작성 중)
**Wave**: W0
**Task**: 신규 에이전트·스킬·설계 파일 작성
**State**: drafting
**Blockers**: Phase 18.8 observation 완료 전까지 active 전환 금지
**Last updated**: 2026-04-17
<!-- STATUS-END -->

## W0 — 준비 (현재)

- [x] `.claude/agents/platform-perf-observability.md`
- [x] `.claude/agents/platform-design-a11y.md`
- [x] `.claude/agents/platform-advisor.md`
- [x] `.claude/skills/mmp-ws-contract/SKILL.md`
- [x] `docs/plans/2026-04-17-platform-deep-audit/design.md`
- [x] `docs/plans/2026-04-17-platform-deep-audit/checklist.md` (이 파일)
- [x] `docs/plans/2026-04-17-platform-deep-audit/refs/shared/scope-matrix.md` (초안)
- [ ] W0 스모크 검증 (frontmatter · `wc -l` 500↓)
- [ ] Phase 18.8 observation 완료 대기 (3일 nightly + alert 도달)
- [ ] `/plan-start docs/plans/2026-04-17-platform-deep-audit/` (Phase 18.8 finish 후)

## W1 — Foundation (병렬 3)

> 18.8 finish 이후 실행

- [ ] docs-navigator: `refs/shared/baseline.md` 작성 (wc -l, 테스트 수, 커버리지, 모듈 수, 미해결 Phase 후속)
- [ ] docs-navigator: `refs/shared/severity-rubric.md` 확정 (P0/P1/P2 예시 포함)
- [ ] docs-navigator: QMD coverage 검증 (mmp-plans · mmp-memory · mmp-specs 컬렉션에서 핵심 문서 6건 hit)
- [ ] module-architect: 29개 모듈 인벤토리 및 `BaseModule`/`Factory`/`PhaseReactor`/`ConfigSchema` 준수 매트릭스
- [ ] test-engineer: 현재 커버리지·skip·flaky·fixture 현황 snapshot
- [ ] W1 gate: `scope-matrix · baseline · severity-rubric` 3 파일 존재 + `ls refs/shared/` 확인 + 모듈 ≥28개 열거

## W2 — Specialists (병렬 6)

> W1 gate 통과 후 실행. 각 executor는 draft 하단에 `ADVISOR_ASK: Q1..Q3` 최대 3개.

- [ ] 01 go-backend-engineer → `refs/audits/01-go-backend.md`
- [ ] 02 react-frontend-engineer → `refs/audits/02-react-frontend.md`
- [ ] 03 module-architect → `refs/audits/03-module-architect.md`
- [ ] 04 test-engineer → `refs/audits/04-test-engineer.md`
- [ ] 05 security-reviewer → `refs/audits/05-security.md`
- [ ] 06 platform-perf-observability → `refs/audits/06-perf-observability.md`
- [ ] 07 platform-design-a11y → `refs/audits/07-design-a11y.md`
- [ ] 08 docs-navigator → `refs/audits/08-docs-navigator.md`
- [ ] 09 go-backend + react-frontend 공동(mmp-ws-contract 스킬) → `refs/audits/09-ws-contract.md`
- [ ] W2 gate (각 draft): `grep '^## Findings'` 통과 · finding 3-12개 · `wc -l ≤200` · `[cross:` ≥1 · P0+P1 비율 ≥50%

## W3a — Advisor Intake (직렬, 1회)

- [ ] platform-advisor 호출 (호출 #1)
- [ ] `refs/advisor-consultations.md` 생성: cross-cutting ≥3 또는 "none" 근거 + delta 지시
- [ ] `Invocations: N / 11` 상단 명시

## W3b — Delta (선택, 조건부)

- [ ] 각 delta 지시 수신 executor 1 round 보완 (ADVISOR_ASK 비었으면 skip)
- [ ] 호출 누적 11회 초과 임박 시 즉시 중단, W3c로 이동

## W3c — Synthesis (직렬, 1회)

- [ ] platform-advisor 호출 (호출 #마지막)
- [ ] `refs/executive-summary.md` 생성: P0 ≤10 + P1/P2 + metrics 롤업 + 한계
- [ ] `refs/phase19-backlog.md` 생성: PR 후보 ≥5 (`/plan-new` 포맷 — PR title, Scope, Depends, Rationale, Size, Risk)
- [ ] 최종 호출 카운트 ≤11 확인

## 종료 조건

- [ ] W3 산출물 3종 (advisor-consultations · executive-summary · phase19-backlog) 생성
- [ ] 감사 draft 9종 ≤200줄 · 스키마 통과
- [ ] Phase 19 후보 PR ≥5 backlog 확보
- [ ] `memory/project_phase19_audit_progress.md` 저작 + `MEMORY.md` 인덱스 갱신
- [ ] `/plan-finish` 실행 후 `.claude/active-plan.json`에서 아카이브
