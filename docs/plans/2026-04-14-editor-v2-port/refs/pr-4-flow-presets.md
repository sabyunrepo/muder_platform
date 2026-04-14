# PR-4: 흐름 프리셋 시스템

> Wave 2 | 의존: PR-1, PR-2 | Branch: `feat/phase-17.0/PR-4`

## 문제

빈 캔버스에서 시작해야 함. v2는 프리셋 1클릭 적용 가능.

## 수정 대상

| 파일 | 변경 |
|------|------|
| 새 `hooks/flowPresets.ts` | 프리셋 데이터 정의 |
| `design/FlowToolbar.tsx` | 프리셋 드롭다운 메뉴 추가 |

## v2 참고

- `GameFlowTab.tsx:42-67` — PRESETS 정의 (클래식 5단계, 타임어택 3단계)
- `GameFlowTab.tsx:367-377` — handleApplyPreset

## Tasks

### Task 1: flowPresets.ts 정의
3가지 프리셋:
- **클래식 머더미스터리**: Start → 자기소개 → 자유조사 → 중간투표 → 최종변론 → 최종투표 → Ending
- **타임어택**: Start → 단서탐색(20분) → 긴급토론(10분) → 투표 → Ending
- **자유탐색**: Start → 자유조사 → 투표 → Ending (간소화)
각 프리셋은 `createDefaultTemplate`과 같은 형태 반환 (UUID 생성)

### Task 2: FlowToolbar 프리셋 드롭다운
- "프리셋 적용" 버튼 (드롭다운 메뉴)
- 기존 노드가 있으면 "기존 흐름이 대체됩니다" 확인 다이얼로그
- 적용 후 autoSave 트리거

### Task 3: 테스트
- 프리셋 적용 → 올바른 노드/엣지 수 확인
- 확인 다이얼로그 동작 확인

## 검증

- [ ] 3가지 프리셋 선택 가능
- [ ] 1클릭 적용 → 캔버스에 노드 배치
- [ ] 기존 흐름 대체 시 확인 다이얼로그
- [ ] `pnpm test` pass
