---
name: MMP v3 모듈 시스템 설계
description: 33개 게임 모듈 (spec 29 + crime_scene 3 + media 1) — BaseModule, ConfigSchema, PhaseReactor, AutoContent, Factory 패턴, PlayerAware 게이트
type: project
---
**모듈 시스템 핵심:**
- BaseModule + ConfigSchema(선언적 설정) + AutoContent(자동 콘텐츠)
- PhaseReactor(선택적): PhaseAction에 반응하는 모듈만 구현
- Factory 패턴: 세션별 독립 인스턴스 (싱글턴 금지)
- init() + blank import 등록
- **🔴 PlayerAware 게이트 (F-sec-2, Phase 19.1 PR-A 이후 필수)** — 모든 `engine.Module`은 `BuildStateFor(playerID)` redaction **또는** `engine.PublicStateMarker` 임베드 둘 중 하나 충족. registry boot panic. escape hatch 없음.

**33개 모듈 (8 카테고리) — 2026-04-19 기준:**
- **Core 4**: connection, room, ready, clue_interaction
- **Progression 8**: script/hybrid/event_progression, skip_consensus, gm_control, consensus_control, reading, ending
- **Communication 5**: text_chat, whisper, group_chat, voice_chat, spatial_voice
- **Decision 3**: voting, accusation, hidden_mission
- **Exploration 4**: floor/room/timed_exploration, location_clue
- **Clue Distribution 5**: conditional/starting/round/timed/trade_clue
- **Crime Scene 3** (Phase 11+ 승격): location, evidence, combination
- **Media 1** (Phase 11+ 승격): audio

**PhaseAction 12종:** configJson.phases에서 선언적 정의. `PLAY_SOUND/PLAY_MEDIA/SET_BGM/STOP_AUDIO`는 Audio 모듈이 EventBus로 브리지.

**게임 엔진:** GameProgressionEngine (3가지 Strategy: Script/Hybrid/Event) + ActionDispatcher

**네이밍 혼동 주의:**
- `LocationClueModule` (#24, exploration, 공용 단서 풀)
- `LocationModule` (#30, crime_scene, per-player 이동·검사) — 별개 모듈

**상세 스펙:**
- `docs/plans/2026-04-05-rebuild/module-spec.md` (33 모듈 인덱스, 2026-04-19 갱신 — PR #116)
- `refs/modules/core.md`, `progression.md`, `communication.md`, `decision.md`, `exploration.md`, `clue-distribution.md`, `crime_scene.md` (신규), `media.md` (신규)

**Why:** v2 싱글턴 버그 해결, 모듈=설정 단일 소스로 에디터 자동 UI. PlayerAware 게이트로 per-player state 누출 차단.
**How to apply:** Phase 3(게임엔진 코어) + Phase 5(모듈 이식)에서 구현. 신규 모듈 추가 시 BaseModule + ConfigSchema + AutoContent + (선택)PhaseReactor + Factory + init()/blank import 등록 + PlayerAware 게이트(BuildStateFor 또는 PublicStateMarker) 충족 패턴 준수.
