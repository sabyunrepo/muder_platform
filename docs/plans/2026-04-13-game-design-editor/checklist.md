<!-- STATUS:READY -->
# Phase 13.0 체크리스트

## Wave 1 (병렬)
### PR-1: 게임설계 서브탭 레이아웃 리팩토링
- [ ] DesignTab을 서브탭 컨테이너로 리팩토링
- [ ] 서브탭 네비게이션: 모듈/흐름/장소/배치/설정
- [ ] 기존 모듈 토글 기능을 "모듈" 서브탭으로 이동
- [ ] Vitest 테스트

### PR-2: ConfigSchema API + SchemaDrivenForm
- [x] 백엔드: GET /api/v1/editor/module-schemas 엔드포인트
- [x] 백엔드: 모듈별 ConfigSchema JSON Schema 수집
- [x] 프론트: SchemaDrivenForm 컴포넌트 (string/number/boolean/enum/array)
- [x] 프론트: "설정" 서브탭에서 활성 모듈별 폼 렌더링
- [x] config_json.module_configs에 저장
- [x] Vitest 테스트

## Wave 2 (병렬)
### PR-3: 맵/장소 관리 UI
- [ ] 맵 CRUD UI (이름, 이미지)
- [ ] 장소 CRUD UI (맵 선택 → 장소 추가/편집/삭제)
- [ ] 에디터 API hooks (useEditorMaps, useEditorLocations)
- [ ] "장소" 서브탭에 배치
- [ ] Vitest 테스트

### PR-4: 페이즈 타임라인 UI
- [ ] PhaseTimeline 컴포넌트 (수평 타임라인)
- [ ] 페이즈 추가/삭제/순서변경 (드래그앤드롭 or 버튼)
- [ ] 페이즈 설정 패널 (타입, 시간, 라운드 수)
- [ ] 프리셋 버튼 ("표준 머더미스터리 5페이즈")
- [ ] config_json.phases에 저장
- [ ] "흐름" 서브탭에 배치
- [ ] Vitest 테스트

## Wave 3 (병렬)
### PR-5: 단서→장소 배치 UI
- [ ] CluePlacementPanel 컴포넌트
- [ ] 좌: 미배치 단서 목록, 우: 장소별 단서 목록
- [ ] 단서를 장소로 드래그앤드롭 또는 select 배정
- [ ] config_json.clue_placement에 저장
- [ ] "배치" 서브탭 (단서 탭)에 배치
- [ ] Vitest 테스트

### PR-6: 캐릭터→단서/미션 배정 UI
- [ ] CharacterAssignPanel 컴포넌트
- [ ] 캐릭터 선택 → 시작 단서 체크박스 배정
- [ ] 캐릭터 선택 → 히든 미션 추가/편집/삭제
- [ ] config_json.character_clues, character_missions에 저장
- [ ] "배치" 서브탭 (캐릭터 탭)에 배치
- [ ] Vitest 테스트

## Wave 4
### PR-7: 통합 + 유효성 검증 강화
- [ ] 유효성 검증: 페이즈 없음 경고, 미배치 단서 경고
- [ ] 유효성 검증: 캐릭터 미배정 경고
- [ ] AdvancedTab 검증 API 연동
- [ ] 전체 플로우 수동 검증
