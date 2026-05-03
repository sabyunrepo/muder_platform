---
phase_id: "phase-24-editor-redesign"
phase_title: "Phase 24 — 에디터 ECS 재설계 (단서 단일 진실 위치 + 동적 모듈 + 결말 분기 매트릭스)"
created: 2026-05-01
status: "PR-5A~PR-9 merged — wrap-up tracking active"
spec: "docs/superpowers/specs/2026-05-01-phase-24-editor-redesign/design.md"
prs_estimated: "issue-based: PR-5A~PR-9 merged; wrap-up active"
parent_phase: "phase-21-editor-ux"
---

# Phase 24 — 에디터 ECS 재설계 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: `superpowers:subagent-driven-development` (recommended) 또는 `superpowers:executing-plans`. 모든 코드 작성 sonnet-4-6 sub-agent 위임 카논 (`memory/feedback_sonnet_46_default.md`).
>
> **Spec 카논 단일 source**: `docs/superpowers/specs/2026-05-01-phase-24-editor-redesign/design.md` (round-1 D-01~D-18 + round-2 D-19~D-26 + 10 refs + 19+8 mockups). 본 plan은 task 추적용. **Spec 우선 + plan revise** drift 시.
>
> **MD 500-line 카논**: 본 checklist는 index. PR별 task 상세는 `refs/pr-N-tasks.md`. PR-1 우선 작성, PR-2~6는 cycle 진입 시 expand.

**Goal:** v3 에디터를 ECS 패턴으로 재구성 — entity 5종 (캐릭터·장소·단서·페이즈·결말) 1차 시민 + 모듈 = capability 동적 attach + 결말 분기 매트릭스 + 단서 단일 진실 위치 + 자동 backlink.

**Architecture:** (a) 백엔드 lazy normalizer로 옛 3패널 데이터 (`clue_placement`/`locations[].clueIds`/`character_clues`) → 새 ECS shape (`modules: {[id]: {enabled, config}}` 단일 맵 + entity-attached) 자동 변환. (b) 신규 모듈 `ending_branch` (기존 `engine.ConfigSchema` 패턴 확장) — questions + matrix + scoring embed, JSONLogic 엔진(`rule_evaluator.go`) 재사용. (c) 프론트 = 6 항목 사이드바(B+C 하이브리드) + 아코디언 동적 섹션 (Notion property + Figma Inspector + Unity foldout 합본).

**Tech Stack:**
- 백엔드: Go 1.25 + sqlc + pgx + mockgen + testcontainers-go
- 프론트: React 19 + Vite + Zustand 3-layer + Tailwind 4 + lucide-react + Vitest + RTL + MSW
- 스키마: JSON Schema Draft 2020-12 (`engine.ConfigSchema.Schema()`)
- 룰 엔진: JSONLogic (`rule_evaluator.go` 기존)
- 마이그: Lazy on read (Notion/Articy 패턴, D-20)

---

## Wave/PR 분해 (Issue 기반 continuation)

> 2026-05-03 업데이트: PR-1~PR-4는 기반/엔티티 작업으로 진행되었고, GitHub Issue 기준 PR-5A~PR-9까지 머지 완료했다. Adapter/Engine 공통 계약과 이슈 링크는 `refs/pr-5-adapter-engine-issue-plan.md`를 기준으로 하며, wrap-up 및 후속 범위 정리는 [#246](https://github.com/sabyunrepo/muder_platform/issues/246)에서 추적한다.

| Issue | PR | 범위 | 상태 |
| --- | --- | --- | --- |
| [#230](https://github.com/sabyunrepo/muder_platform/issues/230) | PR-5A | Adapter/Engine 공통 계약 및 Issue 기반 전환 | done |
| [#231](https://github.com/sabyunrepo/muder_platform/issues/231) | PR-5B | 페이즈 정보 전달 Frontend Adapter | done |
| [#232](https://github.com/sabyunrepo/muder_platform/issues/232) | PR-5C | 정보 전달 Backend Engine 및 런타임 공개 상태 | done |
| [#233](https://github.com/sabyunrepo/muder_platform/issues/233) | PR-6 | 캐릭터 Adapter/Engine 이관 | done |
| [#234](https://github.com/sabyunrepo/muder_platform/issues/234) | PR-7 | 단서 Adapter/Engine 이관 | done |
| [#235](https://github.com/sabyunrepo/muder_platform/issues/235) | PR-8 | 장소 Adapter/Engine 이관 | done |
| [#236](https://github.com/sabyunrepo/muder_platform/issues/236) | PR-9 | 결말/통합 Adapter-Engine 검증 및 E2E | done — PR #245 merged |
| [#246](https://github.com/sabyunrepo/muder_platform/issues/246) | Wrap-up | 마이그레이션 sweep 및 후속 런타임 확장 정리 | active |

## Legacy Wave/PR 분해 (6 PR — historical baseline)

각 PR = 1 cycle (compound-mmp 4단계). PR 안에서 4-agent 리뷰 강제 (15 status check + admin-merge 전 카논).

### PR-1 — Backend Foundation (namespace normalizer + ending_branch 모듈 skeleton)
- **Effort** M (~5일), **Impact** Very High (Phase 24 진행의 모든 차단 unblock)
- **branch**: `feat/phase-24-pr-1-backend-foundation`
- **포함**:
  1. `config_normalizer.go` 신설 — D-19 namespace + D-20 lazy + D-21 dead key union 통합 함수
  2. `themes.go` GetByID 등 read path에 normalizer 적용
  3. `service_config.go` write path 새 shape validate (옛 shape write 거부 = 마이그 후 회귀 차단)
  4. `module/decision/ending_branch/` 신설 — Module + ConfigSchema 인터페이스 (Schema only, matrix eval은 PR-5)
  5. `module/decision/register.go` ending_branch 등록 (registry boot panic 게이트 통과)
- **데이터 변경**: 0 (lazy normalizer = 기존 themes 그대로, 첫 read에 변환 transparently)
- **테스트**: 25+ table-driven test (8 정규 마이그 시나리오 × 3 dead key 케이스 + ending_branch Schema validate)
- **상세 task**: `refs/pr-1-tasks.md`

### PR-2 — Frontend Foundation (아코디언 컴포넌트 + 사이드바 재구성 + 모듈 페이지 split)
- **Effort** M (~5일), **Impact** High (이후 모든 entity PR의 전제)
- **branch**: `feat/phase-24-pr-2-frontend-foundation`
- **포함**:
  1. `Accordion.tsx` reusable 컴포넌트 신설 (D-25 디테일 3 — 베이스 항상 펼침 / 활성 기본 펼침 / localStorage 상태)
  2. 사이드바 = 6 항목 B+C 하이브리드 (entity 5 + 글로벌 1, 그룹 헤더)
  3. 글로벌 모듈 페이지 신설 (D-03 분리 모델, 카드 클릭 = 모달)
  4. `ModulesSubTab.tsx` 폐기 → entity 리스트 화면 상단 모듈 토글로 이전 (D-04)
  5. `theme.config_json.modules` 새 shape 사용 (D-19) — 프론트 store 통합
- **사용자 영향**: 기존 themes 자동 마이그 (PR-1 normalizer 효과), 사용자 액션 0
- **상세 task**: `refs/pr-2-tasks.md` (PR-1 머지 후 expand)

### PR-3 — Entity Pages (캐릭터 + 장소 + 단서)
- **Effort** L (~7일), **Impact** High (3 entity 첫 출시)
- **branch**: `feat/phase-24-pr-3-entity-character-location-clue`
- **2026-05-02 scope update**: 캐릭터 역할 enum, 탐정 투표 후보 정책, PDF/이미지 역할지 지원은 PR-3 계열 후속 PR로 분리. 상세는 `refs/pr-3-expansion-role-pdf-voting.md`.
- **포함**:
  1. 캐릭터 entity 페이지 (D-06) — 베이스 + 역할지 Markdown + starting_clue/hidden_mission 모듈 섹션
  2. 장소 entity 페이지 (D-07) — Tree 무한 중첩 + 접근 제한 + 단순 사진 + evidence/location_clue 모듈 섹션
  3. 단서 entity 페이지 (D-08) — 단일 진실 위치 + 자동 backlink + 미사용 표시 + conditional_clue/combination/clue_interaction 모듈 섹션
  4. 자동 backlink 백엔드 신설 — derived 쿼리 vs DB 별도 테이블 (writing-plans 단계 결정, refs/10 참조)
  5. PR-3A~E 확장 — `mystery_role`, voting `candidatePolicy`, typed role sheet
     - DOCUMENT/PDF, image role sheet viewer는 후속 PR로 분리 (위 scope update 기준)
     - PR-3A 테스트 책임: 역할 enum 저장/검증, Markdown 역할지 저장, entity preview 반응형/E2E
- **상세 task**: `refs/pr-3-tasks.md` (PR-2 머지 후 expand)

### PR-4 — Entity Pages (페이즈 + 결말)
- **Effort** M (~5일), **Impact** High (entity 5종 완성)
- **branch**: `feat/phase-24-pr-4-entity-phase-ending`
- **포함**:
  1. 페이즈 entity 페이지 (D-10) — Flow 다이어그램 메인 뷰 + 노드 더블클릭 편집 + round_clue/timed_clue/progression/gm_control 모듈 섹션
  2. 결말 entity 페이지 (D-11) — 두 탭 (목록 + 분기). **이 PR은 목록 탭만**, 분기 탭 = PR-5
  3. 기존 `EndingNodePanel` (Flow 노드)와 결말 entity 1:1 매핑 wire-up
- **상세 task**: `refs/pr-4-tasks.md` (PR-3 머지 후 expand)

### PR-5 — Ending Branch Matrix (질문 에디터 + 매트릭스 UI + JSONLogic eval + per-choice threshold)
- **Effort** L (~7일), **Impact** Very High (결말 분기 시스템 완성 — Phase 24 핵심 가치)
- **branch**: `feat/phase-24-pr-5-ending-branch-matrix`
- **포함**:
  1. 결말 entity 페이지 분기 탭 (D-12~D-18, D-23, D-24, D-26 모두 적용)
  2. 질문 에디터 — 단일/다중 선택, 보기, 응답 캐릭터 셀렉트, impact (branch/score) 분기 UI
  3. 매트릭스 UI — 행 추가/삭제, "+" 결합 표기, 와일드카드 `*`, 우선순위 정렬
  4. voting 모듈 결과 자동 컬럼 (D-18) — wire-up
  5. 백엔드 ending_branch 모듈 matrix evaluator — JSONLogic rule 변환 + per-choice threshold (D-26) + 점수 누적 (D-24)
  6. 게임 끝 화면 — 공통 결말 + 캐릭터별 응답 breakdown (랭킹 X)
- **상세 task**: `refs/pr-5-tasks.md` (PR-4 머지 후 expand)

### PR-6 — Migration Sweep + Cleanup
- **Effort** S (~2일), **Impact** Medium (기술 부채 정리)
- **branch**: `chore/phase-24-pr-6-migration-sweep`
- **포함**:
  1. Telemetry — 옛 shape read 빈도 메트릭 (Prometheus counter)
  2. UI marker — admin 페이지에 "마이그 진행률 N%" 표시
  3. 100% sweep 후 normalizer disable + 옛 키 (`clue_placement`/`locations[].clueIds`/`character_clues`/`module_configs`) DB 컬럼 drop SQL
  4. 프리셋 32개 새 shape으로 재작성 (lazy normalizer 의존 해소)
- **사용자 영향**: 0 (normalizer 효과 그대로, 코드 cleanup만)
- **상세 task**: `refs/pr-6-tasks.md` (PR-5 머지 + sweep 100% 도달 후)

---

## PR-1 상세 — Backend Foundation

> **TDD 강제** (`compound-mmp:tdd-mmp-go` 카논): 새 .go 파일에 *_test.go 없으면 soft ask. 도메인 모델·sqlc 자동생성 예외.
>
> **75%+ 커버리지 목표** (현재 enforcement 41%). 새 normalizer 모듈은 테이블 드리븐 100% 커버 목표.

상세 30 step bite-sized tasks: **`refs/pr-1-tasks.md`**

핵심 결정 적용 매트릭스:

| Spec 결정 | PR-1 task |
|---|---|
| D-19 단일 맵 namespace | task 6~12 (modules array → object map, configs extract) |
| D-20 Lazy on read | task 21~22 (themes.go 읽기 path normalize) |
| D-21 dead key Union 병합 | task 13~18 (clue_placement + locations[].clueIds priority union, 충돌 DEBUG 로그) |
| D-23 ending_branch 모듈 신설 | task 25~30 (Module 인터페이스 + ConfigSchema, register) |
| D-24 score embed | task 27 (questions Schema에 impact: branch/score + scoreMap) |
| D-26 per-choice threshold | PR-5에서 평가기 작성 (PR-1은 Schema 정의만) |

---

## 검증 게이트 (전 PR 공통)

PR 생성 전:
- [ ] `compound-mmp:compound-review` 4-agent 병렬 리뷰 (security/perf/arch/test) 통과
- [ ] `go test ./...` + `bun test` 통과
- [ ] 75%+ 커버리지 (PR-1 normalizer 모듈 100% 목표)
- [ ] graphify 의존성 변경 없음 확인 (Phase 종료 시점 refresh, 카논 `project_graphify_refresh_policy.md`)

PR 생성:
- [ ] 15 status check 통과 (file-size-guard / orphan-gate / WS-token / 4-agent 등)
- [ ] PR description = goal + 변경 + 검증 + 결정 ID 매핑

머지:
- [ ] admin-merge 전 4-agent 리뷰 카논 (`memory/feedback_4agent_review_before_admin_merge.md`)
- [ ] PR-2 진입 전 PR-1 머지 + main 안정화 확인

---

## 미해결 (writing-plans → implementation 단계 결정)

Spec D-23/D-24 합본 후 잔여 디테일 — 각 PR 진입 시 결정:

| 디테일 | 어느 PR | 결정 위임 |
|---|---|---|
| 마이그 normalizer "complete sweep" 판정 기준 | PR-6 | telemetry 임계값 + UI marker 룰 |
| 모듈 disable 시 `module_configs` 키 보존 vs 삭제 | PR-2 | UX 결정 (보존이 안전) |
| Backlink 인덱스 위치 (DB 별도 테이블 vs derived 쿼리) | PR-3 | 성능 측정 후 결정 |
| 순환 참조 처리 (combination 무한 루프) | PR-3 | validation rule 추가 |
| Soft delete (휴지통 vs 즉시) | PR-3+ | 사용자 결정 위임 |
| 이미지 업로드 인프라 — Phase 24 scope ❓ | PR-3 진입 시 spec drift check | 기존 v3 image 인프라 재사용이면 OK |

---

## Wrap-up

Phase 24 전 PR 머지 + sweep 100% 후 wrap-up:
- `memory/sessions/2026-XX-XX-phase-24-completion.md` 핸드오프 (PR ID + carry-over)
- `MEMORY.md` 활성 phase 갱신 (Phase 25 후보로 E-3 동시편집 명시 — D-22 deferred 분)
- `compound-mmp:compound-wrap` 7단계 wrap 시퀀스 실행
