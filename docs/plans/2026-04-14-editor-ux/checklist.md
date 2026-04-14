<!-- STATUS: {"phase":"14.0","wave":"W1","pr":"","task":"","state":"pending"} -->
# Phase 14.0 — 에디터 UX 개선 체크리스트

> 부모: [design.md](design.md) | 실행: [plan.md](plan.md)

---

## Wave 1 — 버그 fix + 반응형 (parallel)

### PR-1: 이미지 업로드 400 fix
- [ ] imageApi.ts target_id 빈 문자열 방어
- [ ] CoverImageCropUpload PNG→WebP 전환
- [ ] ImageCropUpload PNG→WebP 전환
- [ ] 수동 QA: 커버/캐릭터/단서 이미지 업로드 확인

### PR-2: 에디터 반응형 대응
- [ ] EditorLayout 탭 네비 overflow-x-auto
- [ ] PhaseTimeline 수직 폴백 (md 미만)
- [ ] 사이드바 반응형 통일 (Modules/Locations/CharacterAssign)
- [ ] 뷰포트별 수동 QA (375/768/1280px)

**Wave 1 gate**:
- [ ] PR-1, PR-2 tasks ✅
- [ ] pnpm build pass
- [ ] pnpm test pass
- [ ] 이미지 업로드 정상 동작
- [ ] 모바일 뷰포트 잘림 없음
- [ ] Both PRs merged to main
- [ ] User confirmed next wave

---

## Wave 2 — UX 개선 (parallel)

### PR-3: 히든미션 재설계 + 단서 compact
- [ ] Mission 인터페이스 확장 (타입별 optional 필드)
- [ ] MISSION_TYPES 상수 변경 (kill/possess/secret/protect)
- [ ] MissionEditor 타입별 설정 폼 조건부 렌더링
- [ ] CharacterAssignPanel 핸들러 업데이트
- [ ] CluesTab 뷰 전환 토글 (리스트/그리드)
- [ ] ClueListRow 컴포넌트 생성
- [ ] ClueCard compact 모드 (이미지 없을 때)

### PR-4: 모듈+설정 탭 통합
- [ ] ModulesSubTab 아코디언 리스트 리팩터링
- [ ] ConfigSchema 인라인 연동
- [ ] SettingsSubTab + 테스트 삭제
- [ ] DesignTab settings 서브탭 제거

**Wave 2 gate**:
- [ ] PR-3, PR-4 tasks ✅
- [ ] pnpm build pass
- [ ] pnpm test pass
- [ ] 히든미션 타입별 설정 정상
- [ ] 단서 뷰 전환 정상
- [ ] 모듈 아코디언 + ConfigSchema 정상
- [ ] Both PRs merged to main
- [ ] User confirmed next wave

---

## Wave 3 — 구조 재편 (sequential)

### PR-5: 게임설계 탭 구조 재편
- [ ] CharactersTab 서브탭 구조 추가 (목록/배정)
- [ ] DesignTab 서브탭 축소 (modules/flow/locations)
- [ ] LocationsSubTab에 CluePlacement 통합
- [ ] AssignmentSubTab 삭제
- [ ] 테스트 업데이트

**Wave 3 gate**:
- [ ] PR-5 tasks ✅
- [ ] pnpm build pass
- [ ] pnpm test pass
- [ ] 최종 탭 구조 정상 동작
- [ ] PR merged to main

---

## Phase completion gate

- [ ] All 3 waves ✅
- [ ] Root checklist "Phase 14.0 ✅"
- [ ] `project_phase140_progress.md` final
- [ ] `/plan-finish` executed
