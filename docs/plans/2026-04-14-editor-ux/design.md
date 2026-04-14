# Phase 14.0 — 에디터 UX 개선 + 버그 수정 (index)

> **상태**: 확정
> **시작**: 2026-04-14
> **다음 단계**: plan.md → wave 기반 실행
> **상위 참조**: docs/plans/2026-04-05-rebuild/design.md
> **MD 200줄 제한**: 모든 문서 <200줄. 상세는 `refs/` 분할.

---

## 목적

에디터 v3의 Phase 13.0 구현 후 발견된 UX 퇴보 및 버그를 수정한다.
이미지 업로드 400 에러, 반응형 미대응, 히든미션/단서 UI 퇴보,
게임설계 탭 구조 비효율(중복/불필요 탭)을 해결한다.

---

## Scope

| 카테고리 | 항목 |
|---------|------|
| 버그 | 이미지 업로드 빈 UUID 400 에러 fix |
| 반응형 | 에디터 전체 탭/사이드바/타임라인 반응형 |
| UX 개선 | 히든미션 타입 변경 + 타입별 설정 UI |
| UX 개선 | 단서 카드 compact 뷰 + 뷰 전환 |
| 구조 재편 | 모듈+설정 탭 통합, 배치→등장인물 이동 |

**Out of scope**: 흐름 탭 React Flow 도입 (Phase 15.0), 엔딩 분기 에디터, 백엔드 스키마 변경

상세는 [refs/scope-and-decisions.md](refs/scope-and-decisions.md).

---

## 7대 결정

| # | 결정 | 선택 | 근거 |
|---|------|------|------|
| 1 | Scope | B안 (도메인별 5 PR) | 관련 기능 묶어 일관성 |
| 2 | Architecture | 프론트엔드 only | 백엔드 변경 없음 |
| 3 | Lifecycle | 기존 컴포넌트 리팩터링 | 신규 페이지 없음 |
| 4 | External Interface | API 변경 없음 | imageApi 클라이언트만 수정 |
| 5 | Persistence | config_json 내 mission 구조만 확장 | DB 스키마 무변경 |
| 6 | 운영 안전성 | 기존 테스트 유지 + 수정분 테스트 | Vitest + Testing Library |
| 7 | 도입 전략 | Wave 3단계, feature flag 불필요 | UI 리팩터링이라 즉시 반영 |

---

## 문서 맵 (refs/)

| 파일 | 내용 |
|------|------|
| [refs/scope-and-decisions.md](refs/scope-and-decisions.md) | 7대 결정 상세 |
| [refs/execution-model.md](refs/execution-model.md) | Wave DAG + PR 의존 |
| [refs/pr-1-image-fix.md](refs/pr-1-image-fix.md) | PR-1 상세 |
| [refs/pr-2-responsive.md](refs/pr-2-responsive.md) | PR-2 상세 |
| [refs/pr-3-mission-clue-ux.md](refs/pr-3-mission-clue-ux.md) | PR-3 상세 |
| [refs/pr-4-module-settings.md](refs/pr-4-module-settings.md) | PR-4 상세 |
| [refs/pr-5-tab-restructure.md](refs/pr-5-tab-restructure.md) | PR-5 상세 |

---

## 실행 전략 요약

| Wave | PRs | 모드 | 의존 |
|------|-----|------|------|
| W1 | PR-1, PR-2 | parallel | - |
| W2 | PR-3, PR-4 | parallel | W1 |
| W3 | PR-5 | sequential | W2 |

**속도 이득**: 순차 5T → 병렬 3T (~40% 단축)

---

## 종료 조건

- [ ] 5 PR main 머지 (3 waves 완료)
- [ ] pnpm build 성공
- [ ] pnpm test 통과
- [ ] 이미지 업로드 정상 동작 확인
- [ ] 모바일 뷰포트에서 잘림 없음
- [ ] `project_phase140_progress.md` 최종 갱신
