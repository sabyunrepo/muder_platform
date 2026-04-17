# Phase 20 — 단서·장소 에디터 정식 승격 (PoC → 통합 엣지 + 라운드) (index)

> **상태**: 확정
> **시작**: 2026-04-17
> **전제**: Phase 18.8 W3 PR-5 관측 stash 후 진행 (2026-04-17 결정)
> **MD 200줄 제한**: 모든 문서 <200줄. 상세는 `refs/` 분할.

---

## 목적

2026-04-17 에디터 UX 리뷰 세션의 PoC 결론을 백엔드 스키마 + API + 프론트로 정식 승격한다.

1. 의미 없는 `clue_type` 필드 완전 제거 (게임 로직 무관 확인됨).
2. `clue_relations` 폐기 → **`clue_edge_groups` + `clue_edge_members`** 통합 스키마.
   - 엣지에 `trigger ∈ {AUTO, CRAFT}` 추가, N개 source 그룹화.
   - `CombinationModule`을 이 스키마 기반으로 리팩터.
3. 라운드 스케줄 도입 (`theme_clues.reveal_round/hide_round`, `theme_locations.from_round/until_round`).
4. 에디터 단서 카드·리스트·관계 그래프 노드에 라운드 배지 노출. PoC localStorage를 실제 API로 교체.

---

## Scope

| 카테고리 | 항목 |
|---|---|
| DB | migration 00023~00025 + sqlc 재생성 |
| 백엔드 | types/service/handler 재구성, engine round 카운터, CombinationModule 리팩터 |
| 프론트 | PoC → 정식 승격, 폼·카드·리스트 개편, 라운드 배지 |
| 테스트 | 백엔드 handler/graph/combination 재작성, 프론트 MSW 기반 재작성, E2E 1개 신규 |

**Out of scope**
- 장소 노드 그래프 참여 ("증거→장소 해금")
- 라운드 Gantt 타임라인 뷰
- 승리 엣지 (조합 즉시 종료 시나리오 부재 확정)
- 다중 엔딩 연결

상세: [refs/scope-and-decisions.md](refs/scope-and-decisions.md).

---

## 7대 결정 (변경 금지)

| # | 결정 | 선택 | 근거 |
|---|---|---|---|
| 1 | Scope | 3개 migration + 통합 엣지 스키마 + 라운드 | 사용자 확정 |
| 2 | 라운드 저장 | 정규 컬럼 (INT NULL) | 쿼리·정렬 용이 |
| 3 | 기존 clue_relations | 드롭 후 재생성 (이관 없음) | 개발 단계, 실데이터 미미 |
| 4 | CombinationModule | 통합 (clue_edge_groups trigger=CRAFT) | 런타임 단순화 |
| 5 | 타입 enum | 완전 제거 | 게임 로직 영향 0 확인 |
| 6 | 운영 안전성 | Go test + Vitest + Playwright | 기존 패턴 |
| 7 | 도입 전략 | 직접 적용 (flag 불필요) | 에디터 내부 기능 |

---

## 문서 맵 (refs/)

| 파일 | 내용 |
|---|---|
| [refs/scope-and-decisions.md](refs/scope-and-decisions.md) | 상세 결정 근거·리스크·대안 |
| [refs/schema.md](refs/schema.md) | migration 00023/00024/00025 SQL + 제약 |
| [refs/prs/pr-1.md](refs/prs/pr-1.md) | PR-1 clue_type 제거 |
| [refs/prs/pr-2.md](refs/prs/pr-2.md) | PR-2 라운드 스케줄 |
| [refs/prs/pr-3.md](refs/prs/pr-3.md) | PR-3 라운드 배지 노출 |
| [refs/prs/pr-4.md](refs/prs/pr-4.md) | PR-4 통합 엣지 스키마 |
| [refs/prs/pr-5.md](refs/prs/pr-5.md) | PR-5 CombinationModule 리팩터 |
| [refs/prs/pr-6.md](refs/prs/pr-6.md) | PR-6 PoC → 정식 프론트 승격 |

---

## 실행 전략 요약 (wave 기반)

| Wave | PRs | 모드 | 의존 |
|---|---|---|---|
| W1 | PR-1 | sequential | — |
| W2 | PR-2, PR-3 | parallel | W1 |
| W3 | PR-4 | sequential | W1 |
| W3 | PR-5 | sequential | W3.PR-4 |
| W4 | PR-6 | sequential | W2, W3 |

**속도 이득**: 순차 6T → 4T (W2·W3 일부 병렬). PoC가 이미 구조화되어 있어 PR-6 재사용률 높음.

---

## 종료 조건

- [ ] 모든 PR main 머지 (4 waves 완료)
- [ ] `clue_type` DB/백엔드/프론트 전 삭제 확인 (`grep -r ClueType` 0건 기대)
- [ ] `GET/PUT /v1/editor/themes/:id/clue-edges` 동작
- [ ] 단서 폼에서 공개/사라짐 라운드 편집 → 저장 → 리로드 복원
- [ ] 장소 행에서 등장/퇴장 라운드 편집 → 저장 → 리로드 복원
- [ ] 관계 그래프에서 AUTO/CRAFT 토글 + 드래그 연결 + 사이클 차단 → 서버 저장
- [ ] 실게임 세션: phase 전환 시 current_round 증가 → 라운드 범위 밖 단서/장소 snapshot 제외
- [ ] `combine {evidence_ids}` WS 메시지 → target 해금 이벤트 수신
- [ ] Vitest + Go + E2E 통과, 커버리지 유지

---

## Phase 18.8 관계

Phase 18.8은 2026-04-17 현재 **W3 PR-5 observation 단계** (모든 PR merged).
본 Phase 20 시작 시점에 Phase 18.8 active-plan을 `.claude/active-plan.phase-18.8.json.bak` 으로 stash.
3일 green 관측이 끝나면 Phase 18.8을 `/plan-finish` 로 정식 archive 예정 (별도 작업).
