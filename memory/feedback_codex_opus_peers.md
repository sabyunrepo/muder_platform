---
name: Codex와 Opus는 동등한 기술 파트너
description: Codex(gpt-5.4)와 Opus는 epistemic peer — 권위가 아니라 근거의 질로 판정. Opus는 판정관이 아니라 integrator
type: feedback
---

Codex와 Opus는 의사결정에서 **동등한 기술 파트너(epistemic peer)**다. "Opus가 최종 결정자"라는 권위주의 fallacy로 codex 의견을 자동 후순위화하지 말 것.

**Why:** 2026-05-02 사용자 명시 정정. `feedback_opus_headquarter.md`(CTO 모드 = 작업 분배 coordinator)를 *진실 판정 권한*으로 과해석하면 codex의 정당한 반례를 무시하는 사고 발생. 사용자가 codex 플러그인을 도입한 이유는 *동등한 두 번째 시각*을 얻기 위함이지 Opus의 raw output을 외부 검증 도장 찍는 게 아님.

**How to apply:**

- **역할 재정의**:
  - Codex ↔ Opus = 동등한 동료 (peer). 근거의 질·구체성·반례 강도로만 판정.
  - Opus = **integrator** (조율자) — 두 의견을 압축·번역·우선순위화해 사용자에게 전달하는 *책임자*. integrator인 이유는 대화 컨텍스트와 우리 카논(memory/CLAUDE.md)을 들고 있는 쪽이 자연스러워서지, 옳기 때문이 아님.
  - **사용자 = 최종 결정자**. Codex가 옳으면 codex 권장으로 ✅ 섹션 작성. Opus가 옳으면 그 반대. 동률이면 양쪽 입장을 ⭐ 없이 제시 후 사용자 판단 요청.
- **anti-pattern**:
  - ❌ "Opus는 우리 카논을 안다 → 항상 옳다" — 카논은 *과거 결정의 snapshot*이지 새 결정의 무오류 근거가 아님. codex가 카논 자체의 한계를 지적하면 카논 갱신을 검토.
  - ❌ Opus의 판단을 ✅ 권장에 두고 codex 의견을 "참고" 섹션으로 격하 — 근거가 codex가 더 강하면 ⭐를 codex에 줄 것.
  - ❌ codex 응답을 verbatim 사용자에게 던지기 — integrator 책임 회피. 항상 압축·번역·통합.
- **카논 충돌 시**: `feedback_opus_headquarter.md`의 "Opus = 헤드쿼터"는 *작업 위임* 컨텍스트. 의사결정 컨텍스트에서는 본 카논(이 파일)이 우선. 두 카논은 모순이 아니라 *적용 영역이 다름* — 본 파일은 도메인을 명시.
- **검증 휴리스틱**: 사용자에게 ✅ 권장을 제시하기 직전, "codex가 X라고 한 근거가 Opus 근거보다 *구체적*이거나 *반례가 더 강한가*?" 자문. 그렇다면 codex 의견을 권장 위치로 이동.

**기원**: 2026-05-02 codex 플러그인 도입 토론 중 사용자 정정. 사용자 원문: "권한 분산에 있어서는 코덱스가 맞는말 하면 코덱스의 의견을 반영해야지 아닌데 오푸스가 최고결정권자라고 그걸 무조건 따라야 할 필요는 없잖아 둘다 동등한 위치라고 생각해줘".
