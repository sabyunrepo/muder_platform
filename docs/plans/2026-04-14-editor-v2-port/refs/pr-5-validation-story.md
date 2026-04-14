# PR-5: 검증→탭이동 + 스토리 split-view

> Wave 3 | 의존: PR-3, PR-4 | Branch: `feat/phase-17.0/PR-5`

## 문제 1: 검증 에러 탭 이동

검증 에러 목록만 표시. 클릭해도 해당 탭으로 이동 안 됨.
v2는 에러 클릭 → 해당 탭 자동 전환.

## 문제 2: 스토리 split-view

단일 뷰만 지원. v2는 좌측 편집 + 우측 미리보기 split-view.

## 수정 대상

| 파일 | 변경 |
|------|------|
| 검증 UI 컴포넌트 | ERROR_TAB_MAP + onErrorClick 핸들러 |
| `EditorLayout.tsx` | 에러 클릭 → setActiveTab 연동 |
| `StoryTab.tsx` | split-view 레이아웃 + 마크다운 렌더링 |

## v2 참고

- `ValidationModal.tsx:17-35` — ERROR_TAB_MAP + guessTabFromError
- `StoryTab.tsx:117-205` — 3-pane (키 목록 / 에디터 / 미리보기)

## Tasks

### Task 1: ERROR_TAB_MAP 정의
```typescript
const ERROR_TAB_MAP: Record<string, EditorTab> = {
  'theme_name': 'overview', 'cover_image': 'overview',
  'character': 'characters', 'clue': 'clues',
  'module': 'design', 'flow': 'design', 'phase': 'design',
};
```

### Task 2: 검증 모달 에러 클릭 핸들러
- 에러 항목에 onClick 추가
- 에러 코드에서 탭 추론 → EditorLayout의 setActiveTab 호출

### Task 3: StoryTab split-view
- 기존 편집 영역 좌측 배치
- 우측에 마크다운 렌더링 (react-markdown 또는 DOMPurify)
- 토글 버튼: 편집 | 분할 | 미리보기

### Task 4: 테스트
- 에러 클릭 → 탭 전환 확인
- split-view 토글 동작 확인

## 검증

- [ ] 검증 에러 클릭 → 해당 탭 자동 이동
- [ ] 스토리 split-view 3모드 전환
- [ ] `pnpm test` pass
