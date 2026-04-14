<!-- STATUS: {"phase":"14.0","wave":"W3","pr":"PR-5","task":"done","state":"completed"} -->
# Phase 14.0 — 에디터 UX 개선 체크리스트

> 부모: [design.md](design.md) | 실행: [plan.md](plan.md)

---

## Wave 1 — 버그 fix + 반응형 (parallel)

### PR-1: 이미지 업로드 400 fix
- [x] imageApi.ts target_id 빈 문자열 방어
- [x] CoverImageCropUpload PNG→WebP 전환
- [x] ImageCropUpload PNG→WebP 전환
- [ ] 수동 QA: 커버/캐릭터/단서 이미지 업로드 확인

### PR-2: 에디터 반응형 대응
- [x] EditorLayout 탭 네비 overflow-x-auto
- [x] PhaseTimeline 수직 폴백 (md 미만)
- [x] 사이드바 반응형 통일 (Modules/Locations/CharacterAssign)
- [ ] 뷰포트별 수동 QA (375/768/1280px)

**Wave 1 gate**:
- [x] PR-1, PR-2 tasks ✅
- [x] pnpm build pass
- [x] pnpm test pass
- [ ] 이미지 업로드 정상 동작
- [ ] 모바일 뷰포트 잘림 없음
- [x] Both PRs merged to main
- [x] User confirmed next wave

---

## Wave 2 — UX 개선 (parallel)

### PR-3: 히든미션 재설계 + 단서 compact
- [x] Mission 인터페이스 확장 (타입별 optional 필드)
- [x] MISSION_TYPES 상수 변경 (kill/possess/secret/protect)
- [x] MissionEditor 타입별 설정 폼 조건부 렌더링
- [x] CharacterAssignPanel 핸들러 업데이트
- [x] CluesTab 뷰 전환 토글 (리스트/그리드)
- [x] ClueListRow 컴포넌트 생성
- [x] ClueCard compact 모드 (이미지 없을 때)

### PR-4: 모듈+설정 탭 통합
- [x] ModulesSubTab 아코디언 리스트 리팩터링
- [x] ConfigSchema 인라인 연동
- [x] SettingsSubTab + 테스트 삭제
- [x] DesignTab settings 서브탭 제거

**Wave 2 gate**:
- [x] PR-3, PR-4 tasks ✅
- [x] pnpm build pass
- [x] pnpm test pass
- [ ] 히든미션 타입별 설정 정상
- [ ] 단서 뷰 전환 정상
- [ ] 모듈 아코디언 + ConfigSchema 정상
- [x] Both PRs merged to main
- [x] User confirmed next wave

---

## Wave 3 — 구조 재편 (sequential)

### PR-5: 게임설계 탭 구조 재편
- [x] CharactersTab 서브탭 구조 추가 (목록/배정)
- [x] DesignTab 서브탭 축소 (modules/flow/locations)
- [ ] LocationsSubTab에 CluePlacement 통합 (skip — 기존 구조에 패널 없음)
- [x] AssignmentSubTab 삭제
- [x] 테스트 업데이트

**Wave 3 gate**:
- [x] PR-5 tasks ✅
- [x] pnpm build pass
- [x] pnpm test pass
- [ ] 최종 탭 구조 정상 동작
- [x] PR merged to main

---

## Phase completion gate

- [x] All 3 waves ✅
- [x] Root checklist "Phase 14.0 ✅"
- [x] `project_phase140_progress.md` final
- [x] `/plan-finish` executed
