# Phase 9.0 — Composable Module Engine Redesign

**Started**: 2026-04-12
**Supersedes**: `docs/plans/2026-04-10-editor-engine-redesign/` (archived — GenrePlugin 방향 폐기)
**Approach**: Composable Module + JSON Template

## 한 줄 요약

Phase 8.0 `Module` 인터페이스를 ISP 로 리파인먼트(Core 7 + Optional 5)하고,
장르를 Go 코드가 아닌 JSON 템플릿으로 정의해서 모듈을 여러 장르가 공유할 수 있게 한다.

## 핵심 결정 요약

| # | 결정 | 값 |
|---|------|----|
| 1 | Scope | 엔진 리파인먼트 + 4장르 JSON 템플릿 + L1 에디터 MVP |
| 2 | Architecture | Composable Module + JSON Template (장르 = 데이터) |
| 3 | Lifecycle | 세션당 Factory, deterministic init/cleanup |
| 4 | Interface | WS 불변, 신규 REST `/api/templates/{id}/schema` |
| 5 | Persistence | `go:embed` 템플릿 + 기존 snapshot + 신규 auditlog |
| 6 | Safety | PhaseEngine 경계 panic 격리 + 모듈 격리 CI 게이트 |
| 7 | Rollout | 빅뱅 (feature flag 없음, A4 에서 레거시 통째 삭제) |

## 문서 구조

- [Scope & 7 Decisions](refs/scope-and-decisions.md)
- [Architecture](refs/architecture.md)
- [Execution Model (Wave DAG)](refs/execution-model.md)
- [Observability & Testing](refs/observability-testing.md)

## PR Index — 16 PRs / 7 Waves

| Wave | 병렬 | PRs |
|------|------|-----|
| W1 | ×3 | [A1](refs/prs/pr-a1.md) · [A2](refs/prs/pr-a2.md) · [A3](refs/prs/pr-a3.md) |
| W2 | ×2 | [A4](refs/prs/pr-a4.md) · [A5](refs/prs/pr-a5.md) |
| W3 | seq | [A6](refs/prs/pr-a6.md) → [A7](refs/prs/pr-a7.md) |
| W4 | ×4 | [B1](refs/prs/pr-b1.md) · [B2](refs/prs/pr-b2.md) · [B3](refs/prs/pr-b3.md) · [B4](refs/prs/pr-b4.md) |
| W5 | seq | [T1](refs/prs/pr-t1.md) → [T2](refs/prs/pr-t2.md) |
| W6 | ×2 | [C1](refs/prs/pr-c1.md) · [F1](refs/prs/pr-f1.md) |
| W7 | seq | [V1](refs/prs/pr-v1.md) |

## 새 plan 이 이전 plan 에서 바꾸는 것

- **GenrePlugin 폐기** → 장르는 Go 패키지 아님. JSON 템플릿.
- **Phase 8.0 29 모듈 생존** → `absorbed` 재작성 대신 Optional opt-in 으로 점진 마이그
- **커스텀 조합 가능한 하부 구조** → 모듈 = 재사용 Go 코드, 에디터 팔레트 UX 는 future phase
- **빅뱅 cutover** → A4 에서 레거시 통째 삭제 + Plugin→Module 리네임 (feature flag 없음)

## 다음 단계

1. 이 파일 + refs/ + checklist 커밋 후 `/plan-start docs/plans/2026-04-12-composable-module-engine-redesign`
2. 기존 `docs/plans/2026-04-10-editor-engine-redesign/` 는 SUPERSEDED 마커 달고 archive
3. `/plan-autopilot` 으로 Wave 1 자동 실행 (A1/A2/A3 ×3 worktree)
