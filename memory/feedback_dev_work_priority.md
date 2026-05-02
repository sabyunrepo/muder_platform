---
name: 개발(feature) 작업이 메타·인프라·CI 작업보다 우선
description: 활성 Phase의 feature 개발(Go/React 코드)이 핸드오프의 P1 메타 작업(카논 명문화·CI yaml·PR 회고·CodeRabbit 확인 등)보다 우선 큐에 들어가야 한다. 메타 작업은 카논 위반이 임박하거나 사용자가 명시 호출할 때만 끌어올린다.
type: feedback
---

활성 Phase의 feature 개발(코드 변경 — Go 백엔드, React UI, DB 마이그레이션,
도메인 로직)이 항상 우선순위 큐 상단에 있어야 한다. 다음 같은 메타 작업은
모두 P2 이하로 둔다:

- 카논 문서 명문화 (memory/ feedback_*.md, refs/*.md)
- CI yaml 미세 조정 (paths-filter anchor, concurrency, glob 정정)
- PR 사후 회고 (CodeRabbit 코멘트 확인, retro 정리)
- 핸드오프·MEMORY 인덱스 정리 자체가 다음 우선순위가 되는 것
- 4-agent fallback 정책·docs-only carve-out 같은 운영 룰 명문화

**Why:**
- **2026-05-01 사용자 호소** — "개발 작업을 하고 싶은데 자꾸 다른 거 한다고
  개발이 하나도 안된다." 직전 5개 PR(#192~#196)이 전부 wrap-up·CI 슬림화·
  paths-filter hotfix·MEMORY 정리. 마지막 feature 머지가 PR #189/#191
  (Phase 21 E-7~E-12)까지 거슬러 올라간 상태였다.
- **메타 작업의 자기 증식** — 메타 작업은 wrap-up에서 또 다른 메타
  follow-up(MISTAKES 카논화·MEMORY 추가·다음 wrap-up)을 만들어내며 큐를
  잠식한다. feature 개발은 wrap-up이 끝나면 다음 feature로 자연 전환되지만,
  메타는 "다 정리할 때까지" 늘어난다.
- **활성 Phase 진척이 우선순위 source of truth** — `MEMORY.md` 의 "활성
  Phase" 섹션과 `docs/plans/<active>/checklist.md` 의 STATUS marker 가
  실제 다음 작업을 가리킨다. 핸드오프의 "Next Session Priorities" 가
  메타로 채워져 있어도, 활성 Phase 의 다음 Wave/PR 이 우선이다.

**How to apply:**
  먼저 확인하고, 핸드오프의 P1 메타 항목보다 위에 둔다.
- 메타 작업 끌어올리기 조건 (예외 4가지):
  1. 카논 위반이 직전 PR 에서 발생 — fallback 룰 부재로 다음 PR 도 위반 임박
  2. CI 가 실제로 깨져 있어 다음 feature PR 머지가 막힘
  3. 사용자가 명시 호출 ("paths-filter 카논 정리해줘" 등)
  4. 메타 작업이 활성 Phase feature 의 의존 prerequisite (예: migration
     도구 없으면 PR-9 진행 불가)
- 사용자가 우선순위 점검을 요청하면 큐를 **메타 / 개발** 두 컬럼으로 구분해
  보여주고, 활성 Phase 다음 작업을 굵게 표시한다.
- wrap-up 의 followup-suggester 가 메타 후보를 P0/P1 로 분류해 와도, 메인
  컨텍스트가 P2 로 강등 후 "활성 Phase 진척이 우선" 코멘트와 함께 표기.

**Reference**:
- `memory/MEMORY.md` 활성 Phase 섹션 (단일 source of truth)
- `docs/plans/<active-phase>/checklist.md` STATUS marker
- 본 룰 발동 첫 사례: 2026-05-01 Phase 19 W4 PR-9 (WS Auth Protocol)
  진입. 핸드오프 P1-A/P1-B(메타 카논 명문화) 무시하고 활성 Phase 다음
  Wave 로 직진.
