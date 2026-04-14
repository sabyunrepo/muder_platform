# Phase 17.0 — 에디터 UX v2 이식 + 흐름 에디터 완성 설계 (index)

> **상태**: 확정
> **시작**: 2026-04-14
> **다음 단계**: plan.md → wave 기반 실행
> **상위 참조**: v2(`/Users/sabyun/goinfre/merdermistery_hotel`) 에디터 분석 결과
> **MD 200줄 제한**: 모든 문서 <200줄. 상세는 `refs/` 분할.

---

## 목적

v2 에디터에서 v3보다 우수한 UX를 이식하고, Phase 15.0에서 만들어둔 흐름 에디터 컴포넌트의
미연결(wiring) 이슈를 해결한다. 백엔드 변경 최소화 (JSONB 활용).

---

## Scope

| 카테고리 | 항목 |
|---------|------|
| Wiring | 엣지 삭제 + Delete 키, 커스텀 엣지 등록, 분기 조건 서버 저장 |
| 흐름 강화 | PhaseNodePanel 확장 (7필드), 흐름 프리셋 시스템 |
| UX 이식 | 검증 에러→탭 이동, 스토리 split-view 개선 |
| 시각화 | 흐름 시뮬레이션 패널, 동적 탭 (모듈 기반) |

**Out of scope**: 단서 관계 그래프(P6, 별도 Phase), 모듈 인라인 설정(이미 구현), 모바일

상세는 [refs/scope-and-decisions.md](refs/scope-and-decisions.md).

---

## 7대 결정 (변경 금지)

| # | 결정 | 선택 | 근거 |
|---|------|------|------|
| 1 | Scope | Wiring 3건 + UX 6건 (P6 제외) | P6은 백엔드 API 필요, 별도 Phase |
| 2 | Architecture | 기존 ReactFlow + JSONB data 유지 | 스키마 마이그레이션 불필요 |
| 3 | Lifecycle | N/A | 새 엔티티 없음 |
| 4 | External Interface | API 변경 없음 | 프론트 전용 수정 |
| 5 | Persistence | FlowNodeData JSONB 확장 | 타입만 추가, DB 변경 없음 |
| 6 | 운영 안전성 | Vitest + Playwright | 기존 테스트 보강 |
| 7 | 도입 전략 | 직접 적용 (flag 불필요) | 에디터 내부 UX 개선 |

---

## 문서 맵 (refs/)

| 파일 | 내용 |
|------|------|
| [refs/scope-and-decisions.md](refs/scope-and-decisions.md) | 9건 이슈 상세 + 수정 방안 |
| [refs/execution-model.md](refs/execution-model.md) | Wave DAG + 파일 스코프 |
| [refs/v2-reference.md](refs/v2-reference.md) | v2 참고 파일 경로 맵 |

---

## 실행 전략 요약

| Wave | PRs | 모드 | 의존 |
|------|-----|------|------|
| W1 | PR-1, PR-2 | parallel | - |
| W2 | PR-3, PR-4 | parallel | W1 |
| W3 | PR-5, PR-6 | parallel | W2 |
| W4 | PR-7 | sequential | W3 |

**속도 이득**: 순차 7T → 병렬 4T (~43% 단축)

---

## 종료 조건

- [ ] 모든 PR main 머지 (4 waves 완료)
- [ ] 엣지 삭제 동작 (Delete 키 + UI)
- [ ] 분기 노드 조건 설정 → 서버 저장 확인
- [ ] PhaseNodePanel 7+ 필드 편집 가능
- [ ] 흐름 프리셋 1클릭 적용
- [ ] 시뮬레이션 패널 페이즈 순회
- [ ] 검증 에러 클릭 → 탭 자동 이동
- [ ] 동적 탭 (모듈 OFF → 탭 숨김)
- [ ] Vitest 테스트 유지
