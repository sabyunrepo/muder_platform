# PR-4: 모듈+설정 탭 통합

> Phase 14.0 | Wave 2 | 의존: W1 완료

---

## 문제

- `ModulesSubTab`: 240px 사이드바 + 우측 상세 → 상세에 토글 하나 + "추후 구현" placeholder
- `SettingsSubTab`: 별도 탭으로 분리 → 사용자가 모듈 설정 위치를 헤맴
- v2에서는 한 화면에서 토글 + 인라인 설정

---

## 변경 후 구조

```
ModulesSubTab (통합)
├── 카테고리 헤더 (접이식)
│   ├── 모듈 행 [토글 dot] [이름] [설명] [chevron]
│   │   └── 펼침: ConfigSchema 인라인 폼 (SchemaDrivenForm)
│   ├── 모듈 행 ...
│   └── ...
├── 카테고리 헤더 ...
└── ...
```

- 사이드바 제거 → 단일 스크롤 리스트
- 각 모듈 행 클릭 시 아코디언 펼침 → 토글 + ConfigSchema 폼
- 스키마 없는 모듈은 토글만 표시

---

## 변경 파일

| 파일 | 변경 |
|------|------|
| `ModulesSubTab.tsx` | 전면 리팩터링 — 아코디언 리스트 |
| `SettingsSubTab.tsx` | **삭제** |
| `DesignTab.tsx` | `settings` 서브탭 제거 (4개 → 3개 임시) |
| `SchemaDrivenForm.tsx` | 변경 없음 (재사용) |

---

## Task 목록

1. **ModulesSubTab 리팩터링**
   - 사이드바 레이아웃 제거
   - 카테고리별 접이식 섹션 (`Disclosure` 패턴)
   - 각 모듈 행: 토글 + 이름 + 설명
   - 활성 모듈 클릭 시 아코디언 → ConfigSchema 폼

2. **ConfigSchema 인라인 연동**
   - `useModuleSchemas()` 호출
   - 스키마 있는 모듈: 펼치면 `SchemaDrivenForm` 렌더링
   - 스키마 없는 모듈: "설정 없음" 텍스트

3. **SettingsSubTab 삭제**
   - 파일 삭제
   - 테스트 파일 삭제: `__tests__/SettingsSubTab.test.tsx`
   - import 정리

4. **DesignTab 서브탭 정리**
   - `settings` 제거
   - SubTab 타입에서 제거

---

## 테스트

- `ModulesSubTab.test.tsx` 업데이트: 아코디언 펼침 + ConfigSchema 렌더링
- `DesignTab.test.tsx` 업데이트: settings 탭 제거 반영
- 기존 `SchemaDrivenForm.test.tsx` 변경 없음
