---
name: 서브에이전트 모델은 Sonnet 4.6 기본
description: Claude Sonnet 4.6 출시 이후 서브에이전트 생성 시 `claude-sonnet-4-6` 명시. 4.5 사용 금지
type: feedback
---
서브에이전트 spawn 시 모델 파라미터는 `claude-sonnet-4-6` 기본. 4.5(`claude-sonnet-4-5`)는 구버전이므로 사용 금지.

**Why**: 2026-04-19 세션에서 사용자가 "Sonnet 4.6 나왔으니까 4.5 말고 4.6으로" 명시. 성능·가격 유지하면서 최신 capability 사용.

**How to apply**:
- `Agent` tool 호출 시 `model: "claude-sonnet-4-6"` 또는 `subagent_type` 지정 후 내부 inherit 관계 확인
- `oh-my-claudecode:executor`·`writer` 등 OMC 에이전트는 대부분 sonnet 계열 — 모델 오버라이드 필요 없으면 skip, 필요하면 명시
- 예외: 보안·아키텍처 판단은 `claude-opus-4-7` 사용 (advisor 패턴, CLAUDE.md § Opus↔Sonnet 위임)
- 간단 검색·요약은 `claude-haiku-4-5-20251001` 허용

**모델 ID 요약**:
- Opus 4.7: `claude-opus-4-7`
- Sonnet 4.6: `claude-sonnet-4-6`
- Haiku 4.5: `claude-haiku-4-5-20251001`
