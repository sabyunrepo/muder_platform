# Phase 16.0 — 에디터 UX 버그픽스 + 개선 설계 (index)

> **상태**: 확정
> **시작**: 2026-04-14
> **다음 단계**: plan.md → wave 기반 실행
> **상위 참조**: Phase 15.0 완료 후 QA에서 발견된 이슈
> **MD 200줄 제한**: 모든 문서 <200줄. 상세는 `refs/` 분할.

---

## 목적

Phase 15.0(Flow Canvas) 완료 후 에디터 전반의 UX 이슈 4건을 수정한다.
버그 1건(단서 이미지 미표시) + UX 개선 3건(모달 스크롤, 모듈 탭 리디자인, 흐름 기본 템플릿).

---

## Scope

| 카테고리 | 항목 |
|---------|------|
| 버그 | 단서 이미지 업로드 후 화면 미표시 (캐시 무효화 누락) |
| UX | 단서 등록 고급 옵션 시 버튼 가림 (Modal 스크롤) |
| UX | 모듈 탭 v2 토글 형식 리디자인 + 코어 모듈 숨김 |
| UX | 흐름 탭 새 테마 시 기본 템플릿 자동 생성 |

**Out of scope**: 새 모듈 추가, 흐름 검증 강화, 모바일 대응

상세는 [refs/scope-and-decisions.md](refs/scope-and-decisions.md).

---

## 7대 결정 (변경 금지)

| # | 결정 | 선택 | 근거 |
|---|------|------|------|
| 1 | Scope | 4건 버그/UX 한정 | QA 결과 기반 |
| 2 | Architecture | 기존 구조 유지 | 새 컴포넌트 없음, 기존 수정만 |
| 3 | Lifecycle | N/A | 상태 변화 없음 |
| 4 | External Interface | API 변경 없음 | 프론트 전용 수정 |
| 5 | Persistence/State | React Query 캐시만 | 백엔드 변경 없음 |
| 6 | 운영 안전성 | Vitest + Playwright | 기존 테스트 보강 |
| 7 | 도입 전략 | 직접 적용 (flag 불필요) | 버그픽스+UI 개선이라 flag 과잉 |

---

## 문서 맵 (refs/)

| 파일 | 내용 |
|------|------|
| [refs/scope-and-decisions.md](refs/scope-and-decisions.md) | 4건 이슈 상세 분석 + 수정 방안 |
| [refs/execution-model.md](refs/execution-model.md) | Wave DAG + 파일 스코프 |

---

## 실행 전략 요약

| Wave | PRs | 모드 | 의존 |
|------|-----|------|------|
| W1 | PR-1, PR-2 | parallel | - |
| W2 | PR-3, PR-4 | parallel | W1 |

**속도 이득**: 순차 4T → 병렬 2T (~50% 단축)

---

## 종료 조건

- [ ] 모든 PR main 머지 (2 waves 완료)
- [ ] 단서 이미지 업로드 후 즉시 표시 확인
- [ ] 고급 옵션 펼쳐도 버튼 항상 보임
- [ ] 모듈 탭에 코어 모듈 미표시 + 토글 형식
- [ ] 새 테마 생성 시 기본 흐름 노드 자동 생성
- [ ] Playwright E2E 18/18 유지
- [ ] `project_phase160_progress.md` 최종 갱신
