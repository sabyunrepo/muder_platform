# PR-7: 마이그레이션 + 통합

> Phase 15.0 | Wave 4 | 의존: PR-5, PR-6

---

## 변경 범위

### 데이터 마이그레이션
- Go 마이그레이션 스크립트: config_json.phases → flow_nodes + flow_edges
- 선형 변환: phases[i] → PhaseNode, phases[i]→phases[i+1] 엣지
- Start 노드 자동 생성 (Start→첫번째Phase 엣지)
- 위치 자동 배치: 수평 등간격 (x=i*250, y=200)

### FlowSubTab 전환
- feature flag 제거: FlowCanvas 항상 렌더링
- 기존 PhaseTimeline 코드 삭제 (또는 레거시로 유지)
- config_json.phases 읽기 → flow API 읽기로 전환

### 기존 코드 정리
- PhaseTimeline.tsx: 삭제 또는 deprecated 마킹
- PhaseCard.tsx: 삭제 또는 deprecated 마킹
- FlowSubTab 내 기존 상태 관리 로직 제거

---

## Task 목록

1. **Go 마이그레이션 스크립트** — phases→flow_nodes/edges 변환
2. **마이그레이션 테스트** — 빈/1개/5개/프리셋 케이스
3. **FlowSubTab 전환** — FlowCanvas 직접 렌더링
4. **기존 코드 정리** — PhaseTimeline/PhaseCard 제거
5. **feature flag 제거** — flow_canvas_enabled 제거
6. **통합 테스트** — 마이그레이션 → 캔버스 로드 → 편집

---

## 테스트

- `migration_test.go`: 다양한 phases 입력 → flow 그래프 검증
- `FlowSubTab.test.tsx`: 캔버스 렌더링 확인
