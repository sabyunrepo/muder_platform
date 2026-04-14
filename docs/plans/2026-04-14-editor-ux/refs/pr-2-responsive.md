# PR-2: 에디터 반응형 대응

> Phase 14.0 | Wave 1 | 의존: 없음

---

## 문제

에디터 여러 탭에서 좁은 뷰포트 시 콘텐츠 잘림:
- 상위 탭 8개가 한 줄 → overflow 미처리
- 사이드바(w-60) 고정 → 모바일에서 콘텐츠 영역 부족
- PhaseTimeline 수평 스크롤만 → 좁은 화면 UX 열악

---

## 변경 파일

| 파일 | 변경 |
|------|------|
| `EditorLayout.tsx` | 탭 네비 overflow-x-auto + 스크롤 힌트 |
| `PhaseTimeline.tsx` | 좁은 화면 수직 레이아웃 |
| `PhaseCard.tsx` | 수직 모드 카드 폭 조정 |
| `ModulesSubTab.tsx` | 사이드바 → 반응형 (md: 이상 사이드바, 미만 상단) |
| `LocationsSubTab.tsx` | 동일 패턴 |
| `CharacterAssignPanel.tsx` | 동일 패턴 |
| `AssignmentSubTab.tsx` | inner tab 반응형 |

---

## Task 목록

1. **EditorLayout 탭 네비 반응형**
   - `overflow-x-auto scrollbar-hide` 추가
   - 좌우 그라데이션 fade 힌트 (스크롤 가능 표시)

2. **PhaseTimeline 수직 폴백**
   - `md:` 이상: 기존 수평 flex
   - `md:` 미만: 수직 flex-col, 카드 full-width
   - 커넥터 라인 방향 변경 (수평→수직)

3. **사이드바 반응형 패턴 통일**
   - 공통 패턴: `md:w-60 md:border-r` + `< md: border-b w-full`
   - `ModulesSubTab`: 모바일에서 카테고리 접이식 리스트
   - `LocationsSubTab`: 모바일에서 맵 select 드롭다운
   - `CharacterAssignPanel`: 모바일에서 캐릭터 select 드롭다운

4. **뷰포트별 수동 QA**
   - 375px (모바일), 768px (태블릿), 1280px (데스크탑)
   - 각 서브탭 잘림 없음 확인

---

## 테스트

- 기존 테스트 breakage 없음 확인
- 반응형은 수동 QA 중심 (Tailwind breakpoint 기반)
