# 사용자 mode 결정 후 매 task 재확인 X

> Phase 23 wrap-up (`memory/sessions/2026-04-29-phase-23-custom-runner-image-merge.md`)에서 사용자 명시 정정 ("어드민 머지로 하기류 하지않았나 왜또 물어보는거지") 카논화.

## 정공

사용자가 명시 mode 결정 후 (예: admin-skip 머지 / 4-agent 우회 / single-concern 카논 explicit override / 추천 mode), 메인 컨텍스트는 매 task마다 동일 결정 재확인 금지.

**Why**: 인지 마찰 + 사용자 통제 모호. mode 한 번 결정 = 본 phase 끝까지 적용.

## How to apply

1. **mode 명시 발화 detection** — 사용자가 다음 패턴 발화 시 mode flag set:
   - "admin-skip으로 머지하고"
   - "4-agent 우회"
   - "추천 진행해" / "추천대로"
   - "비로 진행해" / "에이로" 등 옵션 선택 발화 후 본 mode 적용
   - "매 단계 묻지 마"
2. **이후 동일 결정 재확인 X** — 다음 task 진입 시 묵시 승인 가정
3. **Risk 명시는 OK** — 결정 자체 재확인이 아닌, 새 발견된 risk (예: chicken-egg, yaml syntax bug)는 보고. 그러나 "이걸로 진행할까요?" 게이트는 부재.
4. **Mode 변경은 사용자 명시 필요** — 메인이 임의로 mode 변경 (예: admin-skip → 일반 머지)할 수 없음.

## 사용자 정정 사례

Phase 23 PR #174 머지 직전 메인이 "PR 생성 + admin-skip 머지를 진행할까요?" 결정 게이트 표시 → 사용자: "어드민 머지로 하기류 하지않았나 왜또 물어보는거지"

## Anti-pattern

- ❌ 매 wave/task 후 "다음 진행할까요?" 게이트 (mode 결정 후)
- ❌ 사용자 결정과 다른 옵션을 다시 제시 ("admin-skip 결정했지만 일반 머지도 안전합니다…")
- ❌ 새 risk 발견 시 mode 자체 재confirm ("admin-skip 카논 vs 안전 진행 중 어느 게 좋을까요?") — risk 보고 + mitigation 명시면 충분

## Carve-out (게이트 정당)

- **외부 영향 + 사용자 host 의존 작업** — SSH 재배포 시점 등 메인이 직접 못함
- **새 결정 영역** — phase scope 외 작업 진입 시 (Wave 5 → 다음 phase)
- **risk가 mode 가정을 무효화** — admin-skip 카논 mitigation이 부재한 새 risk 발견 시

## 카논 ref

- `memory/feedback_coding_discipline.md` § Goal-Driven Execution (sister 카논)
- `memory/sessions/2026-04-29-phase-23-custom-runner-image-merge.md` (Phase 23 정정 사례)
