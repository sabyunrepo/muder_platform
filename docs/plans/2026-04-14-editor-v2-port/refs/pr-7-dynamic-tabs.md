# PR-7: 동적 탭 (모듈 기반)

> Wave 4 | 의존: PR-5, PR-6 | Branch: `feat/phase-17.0/PR-7`

## 문제

8개 고정 탭으로, 아직 지원 안 되는 모듈의 탭도 항상 보임.
v2는 활성 모듈에 따라 탭이 자동으로 나타남/사라짐.

## 수정 대상

| 파일 | 변경 |
|------|------|
| `constants.ts` | EDITOR_TABS에 activator 조건 추가 |
| `EditorTabNav.tsx` | 활성 모듈 기반 필터링 |

## v2 참고

- `EditorLayout.tsx:38-63` — FIXED_TABS + DYNAMIC_TAB_DEFS
- `EditorLayout.tsx:94-102` — 동적 탭 빌드 로직 (module_id로 필터)

## Tasks

### Task 1: EDITOR_TABS 확장
```typescript
export const EDITOR_TABS = [
  { key: "overview", label: "기본정보", icon: FileText, always: true },
  { key: "story", label: "스토리", icon: BookOpen, always: true },
  { key: "characters", label: "등장인물", icon: Users, always: true },
  { key: "clues", label: "단서", icon: Search, always: true },
  { key: "design", label: "게임설계", icon: Settings, always: true },
  { key: "media", label: "미디어", icon: Music, requiredModule: "voice_chat" },
  { key: "advanced", label: "고급", icon: Code, always: true },
  { key: "template", label: "템플릿", icon: LayoutTemplate, always: true },
];
```
`always: true` 탭은 항상 표시. `requiredModule`이 있는 탭은 해당 모듈 활성 시에만 표시.

### Task 2: EditorTabNav 필터링
- theme.config_json.modules에서 활성 모듈 목록 가져오기
- EDITOR_TABS 필터링: always || modules.includes(requiredModule)
- 숨겨진 탭이 현재 활성이면 첫 번째 탭으로 자동 전환

### Task 3: 테스트
- 모듈 비활성 → 해당 탭 숨김 확인
- 모듈 활성 → 탭 표시 확인
- 현재 탭이 숨겨지면 overview로 전환 확인

## 검증

- [ ] 미디어 모듈 OFF → 미디어 탭 숨김
- [ ] 미디어 모듈 ON → 미디어 탭 표시
- [ ] 동적 탭 전환 시 에러 없음
- [ ] `pnpm test` pass
