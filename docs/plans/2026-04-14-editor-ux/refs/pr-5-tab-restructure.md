# PR-5: 게임설계 탭 구조 재편

> Phase 14.0 | Wave 3 | 의존: PR-3, PR-4

---

## 문제

- `배치` 서브탭 내 `캐릭터 배정`이 상위 `등장인물` 탭과 중복
- `배치`에 단서 배치만 남으면 inner tab 불필요
- 게임설계 서브탭이 5개 → 정리 필요

---

## 변경 후 구조

### 게임설계 서브탭 (5개 → 3개)

```
게임설계
├── 모듈 (PR-4에서 통합 완료)
├── 흐름
└── 장소+배치 (통합)
```

### 등장인물 탭 (서브탭 추가)

```
등장인물
├── 목록 (기존 CharactersTab 컨텐츠)
└── 배정 (CharacterAssignPanel 이동)
```

### 장소+배치 통합

```
장소+배치 (LocationsSubTab 확장)
├── 좌측: 맵/장소 리스트 (기존)
└── 우측: 장소 선택 시 → 장소 정보 + 단서 배치
```

---

## 변경 파일

| 파일 | 변경 |
|------|------|
| `DesignTab.tsx` | 서브탭 3개로 축소 (modules, flow, locations) |
| `AssignmentSubTab.tsx` | **삭제** (inner tab 구조 제거) |
| `CharactersTab.tsx` | 서브탭 추가 (목록 / 배정) |
| `CharacterAssignPanel.tsx` | props 변경 없음, import 경로만 변경 |
| `LocationsSubTab.tsx` | CluePlacementPanel 통합 |
| `CluePlacementPanel.tsx` | 변경 없음 (재사용) |

---

## Task 목록

1. **CharactersTab 서브탭 구조 추가**
   - `'list' | 'assignment'` 서브탭
   - `list`: 기존 캐릭터 그리드
   - `assignment`: `CharacterAssignPanel` 렌더링

2. **DesignTab 서브탭 축소**
   - `assignment`, `settings` 제거 → `modules | flow | locations`
   - SUB_TABS 배열 업데이트
   - SubTab 타입 업데이트

3. **LocationsSubTab에 CluePlacement 통합**
   - 장소 선택 시 우측에 장소 정보 + 단서 배치 섹션 추가
   - `CluePlacementPanel`을 장소 상세 하단에 렌더링

4. **AssignmentSubTab 삭제**
   - 파일 삭제
   - import 정리

5. **테스트 업데이트**
   - `DesignTab.test.tsx`: 서브탭 3개 확인
   - `CharactersTab.test.tsx` (신규/확장): 서브탭 전환

---

## 최종 에디터 탭 구조

```
기본정보 | 스토리 | 등장인물(목록/배정) | 단서 | 게임설계(모듈/흐름/장소) | 미디어 | 고급 | 템플릿
```
