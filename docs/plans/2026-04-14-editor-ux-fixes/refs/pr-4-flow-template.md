# PR-4: 흐름 기본 템플릿

> Wave 2 | 의존: PR-1, PR-2 | Branch: `feat/phase-16.0/PR-4`

## 문제

새 테마 생성 시 빈 캔버스. 사용자가 처음부터 모든 노드를 추가해야 하며
기본 흐름 구조를 모르면 어떻게 시작할지 막막함.

## 수정 방향

빈 flow 감지 시 기본 템플릿을 자동 생성하여 캔버스에 배치.

### 기본 템플릿 구조
```
Start → 자기소개(Phase 1) → 자유조사(Phase 2) → 투표(Phase 3) → Ending
```

- 5개 노드: start(1) + phase(3) + ending(1)
- 4개 엣지: 순차 연결
- 좌→우 수평 배치 (x 간격 250px)

## 수정 대상

| 파일 | 변경 |
|------|------|
| `hooks/useFlowData.ts` | 빈 flow 감지 + 템플릿 삽입 로직 |
| `flowTypes.ts` | 기본 템플릿 상수 (optional) |

## Tasks

### Task 1: 기본 템플릿 데이터 정의
- `DEFAULT_FLOW_TEMPLATE` 상수: 5 노드 + 4 엣지
- 노드 위치: Start(0,200) → P1(250,200) → P2(500,200) → P3(750,200) → End(1000,200)
- 각 Phase 노드에 기본 이름 설정 (자기소개/자유조사/투표)

### Task 2: useFlowData 초기화 로직
- `useFlowGraph` 응답이 빈 배열일 때 감지
- 기본 템플릿을 로컬 상태에 설정
- `autoSave()` 트리거하여 서버 저장
- `hasInitialized` ref로 중복 실행 방지

### Task 3: 테스트
- Vitest: 빈 flow → 기본 노드 5개 + 엣지 4개 생성 확인
- Vitest: 기존 flow 있는 테마 → 템플릿 미적용 확인
- Vitest: 중복 초기화 방지 확인

## 검증

- [ ] 새 테마 생성 → 캔버스에 5개 노드 자동 배치
- [ ] 기존 테마 → 기존 flow 유지 (변경 없음)
- [ ] 노드 편집/삭제/추가 정상 동작
- [ ] `pnpm test` pass
