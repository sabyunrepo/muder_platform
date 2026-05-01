# 06. 페이즈 entity

> 결정: D-10.
> 대표 mockup: [q14](../mockups/q14-phase-entity.html)

## 결정 사항

### 메인 뷰 = Flow 다이어그램

페이즈는 다른 entity 와 구조가 다름. 단순 리스트로 안 되는 이유 = **페이즈 사이 흐름** (어느 페이즈가 어디로 이어지는지) 이 본질.

```text
P1 인트로 → P2 1차 조사 → P3 2차 조사 → P4 토론 → ⚖️ 분기
                                                     ├ 정답 → 🎭 TRUTH
                                                     └ 오답 → 🎭 FALSE
```

뷰 토글:
- 📊 **다이어그램 뷰** (메인) — 시각 흐름
- 📋 리스트 뷰 (옵션) — 표 형식

### 베이스 필드 (Flow 노드)

| 필드 | 타입 |
|------|-----|
| 이름 | string |
| 타입 | enum (`investigation` / `discussion` / `reading` / `ending`) |
| 시간 (분) | number |
| 라운드 범위 | string (예: "3-4") |
| 자동 진행 | boolean |

### 🧩 동적 모듈 섹션 (모듈 ON 시)

| 모듈 | 섹션 내용 |
|------|---------|
| `round_clue` | "이 페이즈 라운드별 단서 분배" — 라운드 + 단서 + 대상 (캐릭터 또는 전원) 매핑 |
| `timed_clue` | "주기 분배" — 간격 (초) + 단서 풀 + 대상 전략 (전원 / 무작위 / 단서 적은 사람) + 최대 횟수 |
| `script_progression` / `event_progression` / `hybrid_progression` | "다음 페이즈 조건" — **택1 라디오** (3 모듈 중 하나만 ON) |
| `gm_control` / `consensus_control` / `skip_consensus` | "진행 제어" — GM 일시정지 / 합의 진행 / 스킵 |

### 분기 노드 + 결말 노드

Flow 안에 두 종류 특수 노드:
- **⚖️ 분기 노드** — 조건 분기 (voting 결과 등). 더블클릭 시 결말 페이지 탭 2 (분기 매트릭스) 로 이동
- **🎭 결말 노드** — Flow 최종점. 결말 entity 와 연결. 노드 클릭 시 결말 페이지 진입

## 배경·근거

### 왜 다른 entity 와 다른가

| 측면 | 다른 entity (캐릭터·장소·단서) | 🎬 페이즈 |
|------|----------------------------|---------|
| 메인 뷰 | 좌측 리스트 | **Flow 다이어그램** |
| 관계 | ID 참조 | **화살표 (Flow edge)** |
| 분기·조건 | 없음 | **분기 노드** |
| 결말 노드 | 결말 entity 별도 | Flow 안에 결말 노드 포함 |
| 진행 방식 | 자유 조합 | **택1 라디오** (script vs event vs hybrid) |

### 진행 방식 = 택1

`script_progression` / `event_progression` / `hybrid_progression` 3 모듈은 **상호 배타**. 한 게임에 한 방식만 활성. 모듈 토글에서 라디오 버튼 (체크박스 X).

### Flow 다이어그램 폐기 안 함

옵션:
- ⭐ Flow 다이어그램 메인 뷰 (현재)
- 리스트만 (Flow 폐기, 흐름은 텍스트로 P1→P2→P3...)

다이어그램 채택. 이유: 머더미스터리 게임 흐름 시각화가 본질. 폐기 = 손실 큼.

## UX 디테일

### Flow 다이어그램 동작

- 노드 드래그 → 위치 이동
- 노드 사이 연결 → 화살표 추가
- 노드 더블클릭 → 편집 (모달 or 패널)
- 우클릭 → 복제 / 삭제

### 페이즈 1개 편집 화면 (노드 더블클릭 시)

```text
⚙️ P3 2차 조사 편집

📋 베이스 (Flow 노드)
  이름: 2차 조사
  타입: investigation
  시간: 15분
  라운드: 3-4
  자동 진행 ☑

🟢 round_clue 옵션
  R3 시작 시: [c2 편지] → 김철수
  R4 시작 시: [c4 알리바이] → 전원

🟢 timed_clue 옵션
  간격: 5분 / 풀: [c10] [c11] [c12] / 대상: 단서 적은 사람 / 최대: 3회

🟢 hybrid_progression 옵션 (다음 페이즈 조건)
  ☑ 시간 종료
  ☑ 모두 준비 완료
  ☑ GM 강제 진행

🟢 gm_control 옵션
  ☑ 일시정지 가능 / ☑ 강제 진행 / ☑ 시간 추가/삭감
```

### 노드 표시 (Flow 캔버스)

각 노드 카드에 켜진 모듈 표시:
```text
┌─────────────────────┐
│ P3 2차 조사          │
│ investigation · 15분 │
│ R3-4                │
├─────────────────────┤
│ round_clue ·        │
│ timed_clue · gm     │ ← 켜진 모듈 (작은 글씨)
└─────────────────────┘
```

## 현재 코드 차용

| 영역 | 기존 |
|------|-----|
| Flow 다이어그램 | 현재 v3 의 Flow 시스템 (React Flow 기반) — 그대로 차용 |
| 페이즈 노드 편집 | `PhaseNodePanel.tsx` (Phase 21 #191 로 3 sub-component 분리) — 차용 + 모듈 동적 섹션 추가 |
| 분기 노드 | `BranchNodePanel.tsx` 차용 + 결말 분기 매트릭스 연결 신설 |
| 결말 노드 | `EndingNodePanel.tsx` 차용 + 결말 entity 연결 |

## 미해결 디테일

- **데이터 모델** — 페이즈는 `flow_nodes` + `flow_edges` 테이블 (이미 schema 존재). 모듈 동적 섹션 데이터를 `flow_nodes.data` JSON 컬럼에 저장 vs 별도 컬럼 — §O-01 참조.
- **분기 노드 → 매트릭스 연결** — 분기 노드 더블클릭 시 결말 페이지 탭 2 로 이동하는 구체적 wire-up 결정 (writing-plans 단계).

## 참고 mockup

- [q14](../mockups/q14-phase-entity.html) — Flow 다이어그램 메인 + 노드 편집
- [q8](../mockups/q8-all-modules-on-full-ui.html) — 페이즈 모듈 ON 시 풀 모습
