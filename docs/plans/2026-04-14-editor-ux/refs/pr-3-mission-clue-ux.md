# PR-3: 히든미션 재설계 + 단서 compact 뷰

> Phase 14.0 | Wave 2 | 의존: W1 완료

---

## 히든미션 재설계

### 타입 변경

| 기존 | 신규 | value |
|------|------|-------|
| 찾기 | 살해 | `kill` |
| 보호 | 보유 | `possess` |
| 방해 | 비밀 | `secret` |
| 관찰 | 보호 | `protect` |

### 타입별 설정 필드

**kill (살해)**:
- `targetCharacterId`: 대상 캐릭터 (select)
- `condition`: 조건 — 단독/공모 (select)

**possess (보유)**:
- `targetClueId`: 대상 단서 (select)
- `quantity`: 수량 (number, default 1)
- `condition`: 획득 조건 (text)

**secret (비밀)**:
- `secretContent`: 비밀 내용 (textarea)
- `penalty`: 발각 패널티 점수 (number)
- `difficulty`: 난이도 1-5 (number/slider)

**protect (보호)**:
- `targetCharacterId` 또는 `targetClueId` (select, 대상 종류 먼저 선택)
- `condition`: 위협 조건 (text)

---

## 변경 파일

| 파일 | 변경 |
|------|------|
| `MissionEditor.tsx` | 타입 상수 변경 + 타입별 설정 폼 렌더링 |
| `CharacterAssignPanel.tsx` | Mission 인터페이스 확장, 핸들러 업데이트 |
| `CluesTab.tsx` | compact 뷰 모드 추가 |
| `constants.ts` | MISSION_TYPES export (if needed) |

---

## 단서 compact 뷰

### 뷰 모드

- **리스트 뷰** (기본): 1줄 행 — 아이콘 + 이름 + 타입 badge + 레벨 + 공통 badge
- **그리드 뷰**: 기존 카드 유지, 이미지 축소 (aspect 4:3, 4열)
- 뷰 전환 토글: 우상단 `LayoutList` / `LayoutGrid` 아이콘 버튼

### ClueCard 변경

- 이미지 없으면 16:9 빈 영역 제거 → 텍스트만 compact
- 그리드 모드에서도 이미지 없으면 작은 placeholder

---

## Task 목록

1. **Mission 인터페이스 확장** — 타입별 optional 필드 추가
2. **MISSION_TYPES 상수 변경** — kill/possess/secret/protect
3. **MissionEditor 타입별 설정 폼** — 조건부 렌더링
4. **CharacterAssignPanel 핸들러 업데이트** — 확장된 Mission 지원
5. **CluesTab 뷰 전환 토글** — 리스트/그리드 state + 버튼
6. **ClueListRow 컴포넌트** — compact 리스트 행
7. **ClueCard compact 모드** — 이미지 없을 때 축소

---

## 테스트

- `MissionEditor.test.tsx` (신규): 타입별 설정 폼 렌더링
- `CluesTab.test.tsx` (신규): 뷰 전환 토글
- 기존 `CharacterAssignPanel.test.tsx` 업데이트
