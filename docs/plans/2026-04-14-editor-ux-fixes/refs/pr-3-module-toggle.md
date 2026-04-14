# PR-3: 모듈 탭 v2 토글 리디자인

> Wave 2 | 의존: PR-1, PR-2 | Branch: `feat/phase-16.0/PR-3`

## 문제

현재 ModulesSubTab이 아코디언 형식으로 29개 모듈 전체 표시.
코어 모듈 4개는 항상 true라 토글 의미 없음. UI가 무겁고 v2 대비 사용성 저하.

## 수정 방향

v2 `ModuleSelectorTab.tsx` 참고: 카테고리별 카드 + 개별 토글 스위치.

### 변경 사항
- 코어 모듈 숨김: `REQUIRED_MODULE_IDS` 필터링으로 목록에서 제외
- 아코디언 → 카드+토글: 카테고리 헤더 + 모듈별 토글 카드
- 활성 모듈만 설정 표시: 토글 ON → ConfigSchema 폼 인라인 펼침

## 수정 대상

| 파일 | 변경 |
|------|------|
| `components/design/ModulesSubTab.tsx` | 전면 리디자인 (토글 카드) |
| `components/design/ModuleAccordionItem.tsx` | 삭제 또는 카드로 교체 |
| `constants.ts` | 필터 유틸 추가 (optional 모듈만) |

## Tasks

### Task 1: 코어 모듈 필터링
- `constants.ts`에서 `OPTIONAL_MODULES` 유틸 추가
- `MODULE_CATEGORIES`에서 `required=true` 모듈 제외한 목록 생성

### Task 2: 카드+토글 UI 전환
- ModulesSubTab을 카테고리별 섹션 + 토글 카드로 교체
- 각 카드: 모듈명 + 설명 + Switch 토글
- Tailwind: 다크 모드 slate/zinc + amber 액센트

### Task 3: 활성 모듈 설정 인라인
- 토글 ON 시 카드 아래에 ConfigSchema 설정 폼 펼침
- SchemaDrivenForm 재사용
- 토글 OFF 시 설정 접기 + 값 초기화

### Task 4: 테스트
- 모듈 토글 ON/OFF Vitest
- 코어 모듈 미표시 확인
- 설정 폼 렌더링 확인

## 검증

- [ ] 코어 4개 모듈 목록에 없음
- [ ] 선택 모듈 토글 ON/OFF 정상
- [ ] 활성 모듈 설정 폼 정상 렌더링
- [ ] `pnpm test` pass
