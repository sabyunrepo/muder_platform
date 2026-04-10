# Phase D: Editor Layer 2 — Phase Timeline

> 부모: [../design.md](../design.md) | 선행: Phase C (Template Studio)
> **목표**: 비디오 타임라인 형태의 페이즈 편집 + React Flow 캔버스 도입

---

## PR Overview

| PR | 제목 | 단계 | 의존 | 병렬 |
|----|------|------|------|------|
| D-1 | React Flow 캔버스 + FlowEditor 셋업 | D1 | C-1 | -- |
| D-2 | PhaseNode + PhaseEdge 커스텀 | D2 | D-1 | -- |
| D-3 | TimelineView (순차 페이즈 편집) | D3 | D-1, D-2 | D-4, D-5와 병렬 |
| D-4 | Module Palette (드래그 소스) | D4 | D-2 | D-3, D-5와 병렬 |
| D-5 | Phase Config Panel | D5 | D-2 | D-3, D-4와 병렬 |
| D-6 | JSON Logic Rule Editor | D6 | D-5 | -- |
| D-7 | Phase Template API (백엔드) | D7 | 없음 | D-1~D-6과 병렬 |

### Wave 구조

```
W1: D-7 (백엔드) ───────────────────────┐
W1: D-1 (React Flow 캔버스)               │
W2: D-2 (PhaseNode/Edge)                  │
W3: D-3 ─ D-4 ─ D-5 (병렬) ──────────────┤
W4: D-6 (Rule Editor) ◄───────────────────┘
```

### PR 상세 문서

| 파일 | 내용 |
|------|------|
| [phase-d-prs/d1-flow-canvas.md](phase-d-prs/d1-flow-canvas.md) | D-1: React Flow 캔버스 + FlowEditor |
| [phase-d-prs/d2-phase-nodes.md](phase-d-prs/d2-phase-nodes.md) | D-2: PhaseNode + PhaseEdge 커스텀 |
| [phase-d-prs/d3-timeline-view.md](phase-d-prs/d3-timeline-view.md) | D-3: TimelineView 순차 편집 |
| [phase-d-prs/d4-module-palette.md](phase-d-prs/d4-module-palette.md) | D-4: 모듈 팔레트 (드래그 소스) |
| [phase-d-prs/d5-phase-config.md](phase-d-prs/d5-phase-config.md) | D-5: Phase Config Panel |
| [phase-d-prs/d6-rule-editor.md](phase-d-prs/d6-rule-editor.md) | D-6: JSON Logic Rule Editor |
| [phase-d-prs/d7-phase-api.md](phase-d-prs/d7-phase-api.md) | D-7: Phase Template 백엔드 API |

---

## 신규 의존 패키지

| 패키지 | 용도 | 도입 PR |
|--------|------|---------|
| `@xyflow/react` | React Flow 캔버스 | D-1 |
| `@dagrejs/dagre` | 자동 배치 | D-1 |
| `immer` | 불변 상태 (flowStore) | D-1 |
| `jsonlogic-js` | 클라이언트 JSON Logic 평가 | D-6 |

## ConfigJson 저장 형식

```json
{
  "genre_id": "murder_mystery",
  "preset_id": "classic-5-round",
  "game_config": { "totalRounds": 5, "voteType": "secret" },
  "phase_template": [
    { "id": "phase_intro", "phaseType": "intro", "label": "게임 소개",
      "duration": 60, "sortOrder": 0, "timerEnabled": false }
  ],
  "flow_layout": { "version": 1, "nodes": [...], "edges": [...] }
}
```

## 수용 기준

- [ ] React Flow 캔버스 (onlyRenderVisibleElements)
- [ ] PhaseNode/Edge 커스텀 (5 phaseType 색상)
- [ ] TimelineView 드래그앤드롭 순서 변경
- [ ] ModulePalette 드래그로 phaseNode 추가
- [ ] PhaseConfigPanel (SchemaDrivenForm 재사용)
- [ ] ClueDistributionEditor method별 동적 폼
- [ ] RuleEditor JSON Logic 시각적 빌드 + jsonlogic-js 미리보기
- [ ] 언두/리두 (50스텝)
- [ ] phase_template API CRUD + 검증
- [ ] 크로스 엔진 패리티: 100개 JSON Logic 식 동일 결과
- [ ] 노드 100 + 엣지 200 렌더링 < 16ms/frame
