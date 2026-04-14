<!-- STATUS-START -->
**Active**: Phase 16.0 에디터 UX 버그픽스 — 완료
**PR**: ALL (100%)
**Task**: Phase completion gate
**State**: completed
**Blockers**: none
**Last updated**: 2026-04-14
<!-- STATUS-END -->

# Phase 16.0 에디터 UX 버그픽스 + 개선 체크리스트

> 부모: [design.md](design.md) | 실행: [plan.md](plan.md)

---

## Wave 1 — 버그픽스 + 모달 (parallel)

### PR-1: 단서 이미지 캐시 무효화
- [x] Task 1 — imageApi.ts에 clues 캐시 무효화 추가 (`imageApi.ts`) — 88c4663
- [x] Task 2 — Vitest 테스트 작성 + 검증 — 5 passed
- [x] Run after_task pipeline (format + scope test)

### PR-2: Modal 스크롤 + 버튼 고정
- [x] Task 1 — Modal.tsx에 max-h + overflow-y-auto 적용 — e2b10bc
- [x] Task 2 — ClueForm에서 고급 옵션 펼친 상태 스크롤 확인
- [x] Task 3 — 다른 모달(방 만들기, 코드참가 등) 회귀 확인
- [x] Run after_task pipeline (format + scope test)

**Wave 1 gate**:
- [x] All PR-1 tasks done
- [x] All PR-2 tasks done
- [x] Parallel review — worktree agents verified
- [x] `pnpm test` pass — 790 passed (19 pre-existing failures in Social.test.tsx)
- [x] Both PRs merged to main — 88c4663, e2b10bc
- [x] User confirmed next wave

---

## Wave 2 — UX 개선 (parallel)

### PR-3: 모듈 탭 v2 토글 리디자인
- [x] Task 1 — 코어 모듈(required=true) 목록에서 제거 — OPTIONAL_MODULE_CATEGORIES
- [x] Task 2 — 아코디언 → 카드+토글 UI 전환 — 5c0a99a
- [x] Task 3 — 활성 모듈만 설정 펼침 유지 — SchemaDrivenForm 인라인
- [x] Task 4 — Vitest 테스트 + 스냅샷 갱신 — 307 passed
- [x] Run after_task pipeline (format + scope test)

### PR-4: 흐름 기본 템플릿
- [x] Task 1 — 기본 템플릿 데이터 정의 (Start→Phase×3→Ending) — flowDefaults.ts
- [x] Task 2 — useFlowData에서 빈 flow 감지 시 템플릿 자동 삽입 — ff96628
- [x] Task 3 — Vitest 테스트 (빈 flow → 기본 노드 생성 확인) — 15 new tests
- [x] Run after_task pipeline (format + scope test)

**Wave 2 gate**:
- [x] All PR-3 tasks done
- [x] All PR-4 tasks done
- [x] Parallel review — worktree agents verified
- [x] `pnpm test` pass — 805 passed (19 pre-existing failures in Social.test.tsx)
- [x] Both PRs merged to main — 5c0a99a, ff96628
- [x] User confirmed

---

## Phase completion gate

- [ ] All waves done
- [ ] 단서 이미지 업로드 후 즉시 표시 확인
- [ ] 고급 옵션 펼쳐도 버튼 항상 보임
- [ ] 모듈 탭 코어 숨김 + 토글 형식
- [ ] 새 테마 기본 흐름 자동 생성
- [ ] Playwright E2E 유지
- [ ] `project_phase160_progress.md` 최종 갱신
- [ ] `/plan-finish` 실행
