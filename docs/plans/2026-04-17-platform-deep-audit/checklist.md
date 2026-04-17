# Phase 19 감사 — 체크리스트

<!-- STATUS-START -->
**Active**: Phase 19 Platform Deep Audit — W2 완료, W3a 대기
**Wave**: W2 → W3a
**Task**: W2 9 drafts 완료(총 90 Findings, P0 10 / P1 52 / P2 28), W3a Advisor intake 대기
**State**: w2-complete
**Blockers**: 없음
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

## W1 — Foundation (병렬 3) ✅

> 18.8 observation 기간 병렬 실행 (새 브랜치 `chore/phase-19-audit-w1`).

- [x] docs-navigator: `refs/shared/baseline.md` (129줄) — Go 199 파일/38,284줄, Frontend 331/35,745, 500+ 초과 10, 400+ 초과 3, 테스트 988/108/12, Phase 후속 39건
- [x] docs-navigator: `refs/shared/severity-rubric.md` (76줄) — P0/P1/P2 각 실사례 3건 + 경계 4건 + 9영역 P0 시드
- [x] docs-navigator: QMD coverage 검증 — 6쿼리 중 search 2 hit + vector_search 보강 6/6
- [x] module-architect: `refs/shared/module-inventory.md` (109줄) — 33 모듈 표 + 준수 비율 (engine.Module 100% / ConfigSchema 67% / PlayerAwareModule 0%)
- [x] test-engineer: `refs/shared/test-baseline.md` (166줄) — Go 988/44.6%, Vitest 108/1034, E2E 12/68, skip 35, flaky 0, 0% 패키지 9건
- [x] W1 gate: 3 파일 존재 ✅ + 모듈 33개 ≥28 ✅

## W2 — Specialists (병렬 9) ✅

> W1 gate 통과 후 병렬 실행 완료. 각 draft 하단에 `Advisor-Ask Q1..Q3`.

- [x] 01 go-backend-engineer → `01-go-backend.md` (131줄, 8 Findings, P0:0/P1:5/P2:3, cross:13)
- [x] 02 react-frontend-engineer → `02-react-frontend.md` (122줄, 10 Findings, P0:0/P1:5/P2:5, cross:8)
- [x] 03 module-architect → `03-module-architect.md` (130줄, 6 Findings, P0:1/P1:3/P2:2, cross:7)
- [x] 04 test-engineer → `04-test-engineer.md` (117줄, 10 Findings, P0:0/P1:6/P2:4, cross:11)
- [x] 05 security-reviewer → `05-security.md` (172줄, 12 Findings, P0:4/P1:6/P2:2, cross:5영역)
- [x] 06 platform-perf-observability → `06-perf-observability.md` (118줄, 10 Findings, P0:1/P1:4/P2:5, cross:4)
- [x] 07 platform-design-a11y → `07-design-a11y.md` (144줄, 12 Findings, P0:2/P1:7/P2:3, cross:4)
- [x] 08 docs-navigator → `08-docs-navigator.md` (126줄, 10 Findings, P0:0/P1:6/P2:4, cross:9)
- [x] 09 ws-contract 공동 → `09-ws-contract.md` (171줄, 12 Findings, P0:2/P1:10/P2:0, cross:6영역)
- [x] W2 gate — 모든 draft: ≤200줄 · 3-12 Findings · [cross:...] ≥1 · P0+P1 ≥50% ✅

### W2 총계
- 총 Finding **90건** (P0: 10 / P1: 52 / P2: 28)
- 3자 WS 일치율 <4% — Phase 17.5~18.6 반복 회귀 검증됨
- Security P0 4건(RFC 9457 우회·PlayerAware 25모듈 공백·token 평문 로그·auditlog 부재)
- module-inventory 실측 교정: PlayerAwareModule 0/33 → **8/33**(W1 시드 오류, 05·03 공동 교정)

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
