# PR-6: 조건 규칙 빌더

> Phase 15.0 | Wave 3 | 의존: PR-4

---

## 변경 범위

### 규칙 빌더 컴포넌트
- `ConditionBuilder.tsx`: 메인 빌더 (루트 AND/OR 그룹)
- `ConditionGroup.tsx`: 재귀 그룹 (AND/OR + 하위 규칙/그룹)
- `ConditionRule.tsx`: 개별 규칙 행 (변수 + 연산자 + 값)
- `conditionTypes.ts`: 타입 정의 + 변수 메타데이터

### 변수별 값 선택기
- `mission_status`: 캐릭터 select → 미션 select → 성공/실패
- `character_alive`: 캐릭터 select → 생존/사망
- `vote_target`: 캐릭터 select 또는 진범/무죄
- `clue_held`: 캐릭터 select → 단서 select → true/false
- `custom_flag`: 키 input → 값 input

### Branch 노드 연동
- BranchNode 선택 시 → NodeDetailPanel → ConditionBuilder
- 엣지별 조건 편집: 엣지 클릭 → ConditionBuilder 팝오버

### 데이터 훅
- `useFlowConditionData.ts`: 캐릭터/미션/단서 목록 조회 (기존 API 재사용)

---

## Task 목록

1. **conditionTypes.ts** — 타입 + 변수 메타데이터
2. **ConditionRule.tsx** — 변수 선택 → 대상 선택 → 연산자 → 값
3. **ConditionGroup.tsx** — AND/OR 토글 + 규칙/그룹 추가/삭제
4. **ConditionBuilder.tsx** — 루트 빌더 (그룹 래퍼)
5. **useFlowConditionData.ts** — 캐릭터/미션/단서 목록 훅
6. **NodeDetailPanel branch 연동** — Branch 선택 시 빌더 표시
7. **엣지 조건 편집** — 엣지 클릭 → 조건 빌더
8. **테스트** — ConditionBuilder 렌더링 + 규칙 추가/삭제

---

## 테스트

- `ConditionBuilder.test.tsx`: 그룹 추가, 규칙 추가, AND/OR 토글
- `ConditionRule.test.tsx`: 변수별 필드 렌더링
