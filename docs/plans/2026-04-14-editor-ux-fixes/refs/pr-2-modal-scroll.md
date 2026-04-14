# PR-2: Modal 스크롤 + 버튼 고정

> Wave 1 | 의존: 없음 | Branch: `feat/phase-16.0/PR-2`

## 문제

Modal에 `max-h` 제한 없고 Body에 `overflow-y-auto` 없어서,
단서 등록 고급 옵션 펼치면 버튼이 뷰포트 밖으로 밀림.

## 수정 대상

| 파일 | 변경 |
|------|------|
| `apps/web/src/shared/components/ui/Modal.tsx` | max-h + flex + overflow 추가 |

## Tasks

### Task 1: Modal 레이아웃 수정
- 모달 컨테이너: `max-h-[90vh] flex flex-col` 추가
- Body 영역: `overflow-y-auto flex-1` 추가
- Header/Footer는 고정, Body만 스크롤

### Task 2: ClueForm 고급 옵션 검증
- 고급 옵션 + 아이템 설정 전부 펼친 상태에서 스크롤 동작 확인
- 저장/취소 버튼이 항상 하단에 보이는지 확인

### Task 3: 회귀 테스트
- 방 만들기 모달, 코드로 참가 모달 등 기존 모달 정상 동작 확인
- 짧은 콘텐츠의 모달이 불필요한 스크롤바 없는지 확인

## 검증

- [ ] 단서 폼 고급 옵션 전체 펼쳐도 버튼 보임
- [ ] 기존 모달들 회귀 없음
- [ ] Playwright E2E 18/18 유지
