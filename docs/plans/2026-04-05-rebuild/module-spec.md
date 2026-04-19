# MMP v3 모듈 스펙 인덱스

> 33개 모듈 상세는 `refs/modules/` 참조. 이 파일은 전체 목록 + 핵심 원칙만.
> (스펙 원본 29개 + Phase 11~12에서 승격된 CrimeScene 3 + Media 1 = 33)

## 핵심 원칙

1. **모듈 = 설정 단일 소스** — initialSettings 제거, 모든 설정은 해당 모듈 ConfigSchema
2. **콘텐츠 = 고정형 + 자율형** — 고정: 모듈/캐릭터 추가 시 자동. 자율: 제작자 임의 생성
3. **gmMode 연동** — REQUIRED→GmControl, NONE→ConsensusControl, OPTIONAL→둘 다
4. **PhaseAction 12종** — 모듈 상태 변경 부수효과 (ActionDispatcher → PhaseReactor)
5. **🔴 PlayerAware 게이트 (F-sec-2, Phase 19.1 PR-A 이후 필수)** — 모든 `engine.Module`은 `BuildStateFor(playerID)` 구현(per-player redaction) **또는** `engine.PublicStateMarker` 임베드(전원 공개) 둘 중 하나 충족. registry boot panic으로 강제, escape hatch 없음.

## PhaseAction 전체 목록

| PhaseAction | 반응 모듈 |
|-------------|----------|
| RESET_DRAW_COUNT | ClueInteraction |
| RESET_FLOOR_SELECTION | FloorExploration |
| SET_CLUE_LEVEL | ClueInteraction |
| OPEN_VOTING / CLOSE_VOTING | Voting |
| ALLOW_EXCHANGE | TradeClue |
| PLAY_SOUND / PLAY_MEDIA / SET_BGM / STOP_AUDIO | **Audio** (Phase 11+ 승격) |
| BROADCAST_MESSAGE | (모듈 무관) |
| MUTE_CHAT / UNMUTE_CHAT | TextChat, Whisper, GroupChat |
| OPEN_GROUP_CHAT / CLOSE_GROUP_CHAT | GroupChat |
| LOCK_MODULE / UNLOCK_MODULE | 대상 모듈 |

## 전체 모듈 목록 (33개)

### A. Core (항상 활성) → [refs/modules/core.md](refs/modules/core.md)
| # | 모듈 | 역할 |
|---|------|------|
| 1 | ConnectionModule | 접속/재접속 |
| 2 | RoomModule | 방 관리, 자동콘텐츠(공지/프롤로그/오프닝) |
| 3 | ReadyModule | 전원 준비 |
| 4 | ClueInteractionModule | 단서 수색/양도, drawLimit 단일소스 |

### B. Progression (진행) → [refs/modules/progression.md](refs/modules/progression.md)
| # | 모듈 | 역할 |
|---|------|------|
| 5 | ScriptProgression | phases[] 순차 실행 (택1) |
| 6 | HybridProgression | 타이머+트리거+합의 (택1) |
| 7 | EventProgression | 방향성 그래프 (택1) |
| 8 | SkipConsensus | Script 보조, 전원 스킵 |
| 9 | GmControl | GM 수동 제어 (gmMode 연동) |
| 10 | ConsensusControl | 합의 제어 (gmMode 연동) |
| 11 | Reading | 대사/나레이션 + 음성 |
| 12 | Ending | 조건별 엔딩 + reveal 단계 |

### C. Communication → [refs/modules/communication.md](refs/modules/communication.md)
| # | 모듈 | 역할 |
|---|------|------|
| 13 | TextChat | 공개 채팅 |
| 14 | Whisper | 1:1 귓속말 (독립) |
| 15 | GroupChat | 밀담 (사전생성 방, 음성 이동) |
| 16 | VoiceChat | 기본 음성 (LiveKit) |
| 17 | SpatialVoice | 공간 음성 분리 |

### D. Decision → [refs/modules/decision.md](refs/modules/decision.md)
| # | 모듈 | 역할 |
|---|------|------|
| 18 | Voting | 공개/비밀 투표 (통합) |
| 19 | Accusation | 지목→변론→찬반→추방 |
| 20 | HiddenMission | 히든 미션 + 점수제 + MVP |

### E. Exploration → [refs/modules/exploration.md](refs/modules/exploration.md)
| # | 모듈 | 역할 |
|---|------|------|
| 21 | FloorExploration | 층 이동 (택1) |
| 22 | RoomBasedExploration | 방 이동 (택1) |
| 23 | TimedExploration | 시간 제한 (택1) |
| 24 | LocationClue | 장소 단서 배치 (독립, 공용 풀) |

### F. Clue Distribution → [refs/modules/clue-distribution.md](refs/modules/clue-distribution.md)
| # | 모듈 | 역할 |
|---|------|------|
| 25 | ConditionalClue | 전제조건 자동 해금 |
| 26 | StartingClue | 초기 단서 배포 |
| 27 | RoundClue | 라운드별 자동 배포 |
| 28 | TimedClue | 시간 경과 자동 배포 |
| 29 | TradeClue | 교환 + 보여주기 |

### G. Crime Scene (Phase 11+ 승격) → [refs/modules/crime_scene.md](refs/modules/crime_scene.md)
| # | 모듈 | 역할 |
|---|------|------|
| 30 | Location | 플레이어 이동·검사 (per-player 위치) |
| 31 | Evidence | 증거 발견·수집 (장소 연계, autoDiscover) |
| 32 | Combination | 증거 조합 → 파생 단서 (CRAFT trigger) |

### H. Media (Phase 11+ 승격) → [refs/modules/media.md](refs/modules/media.md)
| # | 모듈 | 역할 |
|---|------|------|
| 33 | Audio | 오디오 PhaseAction 브리지 + Reading 음성 자동화 |

## 호환성 매트릭스

**상호 배타:** script ↔ hybrid ↔ event / floor ↔ room ↔ timed
**의존:** skip-consensus → script / spatial-voice → voice-chat + (floor OR room)
**gmMode:** REQUIRED→gm-control / NONE→consensus / OPTIONAL→둘 다
**권장 세트:** crime_scene/{location, evidence, combination} — 수사 루프 3종
**독립:** audio, location-clue (다른 모듈과 자유 조합)

## 네이밍 혼동 주의

| 축 | LocationClueModule (#24) | LocationModule (#30) |
|----|-------------------------|----------------------|
| 카테고리 | Exploration | CrimeScene |
| 역할 | 탐색 위 단서 배치 (공용 풀) | 플레이어 이동·검사 (per-player) |
| 타입 문자열 | `location-clue` | `location` |

## PlayerAware 게이트 분포 (33개 기준)

| 분류 | 모듈 (예) |
|------|----------|
| **per-player redaction** (`BuildStateFor`) | ClueInteraction, Whisper, GroupChat, TextChat, Reading, Voting, Accusation, HiddenMission, Evidence, Location, Combination |
| **public state** (`PublicStateMarker`) | Room, Audio, VoiceChat, SpatialVoice, Script/Hybrid/EventProgression, GmControl, SkipConsensus, ConsensusControl, Ending |

registry boot panic + `go test ./internal/engine/... -run Gate`로 33/33 충족 검증.
