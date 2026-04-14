<!-- STATUS-START -->
**Active**: Phase 16.0 에디터 UX 버그픽스 — Wave 1/2
**PR**: PR-1 (0%)
**Task**: 시작 전
**State**: not_started
**Blockers**: none
**Last updated**: 2026-04-14
<!-- STATUS-END -->

# Phase 16.0 에디터 UX 버그픽스 + 개선 체크리스트

> 부모: [design.md](design.md) | 실행: [plan.md](plan.md)

---

## Wave 1 — 버그픽스 + 모달 (parallel)

### PR-1: 단서 이미지 캐시 무효화
- [ ] Task 1 — imageApi.ts에 clues 캐시 무효화 추가 (`imageApi.ts`)
- [ ] Task 2 — Vitest 테스트 작성 + 검증
- [ ] Run after_task pipeline (format + scope test)

### PR-2: Modal 스크롤 + 버튼 고정
- [ ] Task 1 — Modal.tsx에 max-h + overflow-y-auto 적용
- [ ] Task 2 — ClueForm에서 고급 옵션 펼친 상태 스크롤 확인
- [ ] Task 3 — 다른 모달(방 만들기, 코드참가 등) 회귀 확인
- [ ] Run after_task pipeline (format + scope test)

**Wave 1 gate**:
- [ ] All PR-1 tasks done
- [ ] All PR-2 tasks done
- [ ] Parallel review 4-agent pass
- [ ] `pnpm test` pass
- [ ] Both PRs merged to main
- [ ] User confirmed next wave

---

## Wave 2 — UX 개선 (parallel)

### PR-3: 모듈 탭 v2 토글 리디자인
- [ ] Task 1 — 코어 모듈(required=true) 목록에서 제거
- [ ] Task 2 — 아코디언 → 카드+토글 UI 전환
- [ ] Task 3 — 활성 모듈만 설정 펼침 유지
- [ ] Task 4 — Vitest 테스트 + 스냅샷 갱신
- [ ] Run after_task pipeline (format + scope test)

### PR-4: 흐름 기본 템플릿
- [ ] Task 1 — 기본 템플릿 데이터 정의 (Start→Phase×3→Ending)
- [ ] Task 2 — useFlowData에서 빈 flow 감지 시 템플릿 자동 삽입
- [ ] Task 3 — Vitest 테스트 (빈 flow → 기본 노드 생성 확인)
- [ ] Run after_task pipeline (format + scope test)

**Wave 2 gate**:
- [ ] All PR-3 tasks done
- [ ] All PR-4 tasks done
- [ ] Parallel review pass
- [ ] `pnpm test` pass + Playwright E2E 18/18
- [ ] Both PRs merged to main
- [ ] User confirmed

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
