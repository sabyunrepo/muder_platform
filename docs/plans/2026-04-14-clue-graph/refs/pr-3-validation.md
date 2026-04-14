# PR-3: 검증 연동

> Wave 2 | 의존: PR-1 | Branch: `feat/phase-17.5/PR-3`

## 목표

단서 관계 그래프의 무결성을 에디터 검증 시스템에 통합.
cycle, orphan, unreachable 감지 → ValidationPanel 표시.

## 수정 대상

| 파일 | 변경 |
|------|------|
| 수정 `validation.ts` | validateClueGraph 함수 추가 |
| 수정 `ValidationPanel.tsx` | ERROR_TAB_MAP에 clue_graph 추가 |
| 수정 `ThemeEditor.tsx` | 검증 시 clue relations도 포함 |

## Tasks

### Task 1: validateClueGraph 함수
- 입력: ClueRelation[] + Clue[]
- 체크 항목:
  - cycle 존재 → error "단서 관계에 순환 참조가 있습니다"
  - orphan (관계 없는 단서) → warning (정보 제공만)
  - self-reference → error "자기 자신을 참조하는 관계"
- 반환: DesignWarning[] (category: 'clue_graph')

### Task 2: ValidationPanel + ThemeEditor 확장
- ERROR_TAB_MAP에 `clue_graph: 'clues'` 추가
- ThemeEditor.handleValidate에 clueRelation 데이터 포함
- DesignWarning category 타입에 'clue_graph' 추가

### Task 3: Vitest 테스트
- cycle 감지 → error 반환
- self-reference → error 반환
- 정상 그래프 → 빈 배열 반환
- orphan → warning 반환

## 검증
- [ ] 검증 버튼 → 단서 관계 문제 표시
- [ ] 에러 클릭 → 단서 탭 이동
- [ ] `pnpm test` pass
