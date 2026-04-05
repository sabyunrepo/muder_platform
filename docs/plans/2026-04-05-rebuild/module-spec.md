# MMP v3 모듈 스펙 인덱스

> 29개 모듈 상세는 `refs/modules/` 참조. 이 파일은 전체 목록 + 핵심 원칙만.

## 핵심 원칙

1. **모듈 = 설정 단일 소스** — initialSettings 제거, 모든 설정은 해당 모듈 ConfigSchema
2. **콘텐츠 = 고정형 + 자율형** — 고정: 모듈/캐릭터 추가 시 자동. 자율: 제작자 임의 생성
3. **gmMode 연동** — REQUIRED→GmControl, NONE→ConsensusControl, OPTIONAL→둘 다
4. **PhaseAction 12종** — 모듈 상태 변경 부수효과 (ActionDispatcher → PhaseReactor)

## PhaseAction 전체 목록

| PhaseAction | 반응 모듈 |
|-------------|----------|
| RESET_DRAW_COUNT | ClueInteraction |
| RESET_FLOOR_SELECTION | FloorExploration |
| SET_CLUE_LEVEL | ClueInteraction |
| OPEN_VOTING / CLOSE_VOTING | Voting |
| ALLOW_EXCHANGE | TradeClue |
| BROADCAST_MESSAGE / PLAY_SOUND | (모듈 무관) |
| PLAY_MEDIA / SET_BGM | (모듈 무관) |
| MUTE_CHAT / UNMUTE_CHAT | TextChat, Whisper, GroupChat |
| OPEN_GROUP_CHAT / CLOSE_GROUP_CHAT | GroupChat |
| LOCK_MODULE / UNLOCK_MODULE | 대상 모듈 |

## 전체 모듈 목록 (29개)

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
| 24 | LocationClue | 장소 단서 배치 (독립) |

### F. Clue Distribution → [refs/modules/clue-distribution.md](refs/modules/clue-distribution.md)
| # | 모듈 | 역할 |
|---|------|------|
| 25 | ConditionalClue | 전제조건 자동 해금 |
| 26 | StartingClue | 초기 단서 배포 |
| 27 | RoundClue | 라운드별 자동 배포 |
| 28 | TimedClue | 시간 경과 자동 배포 |
| 29 | TradeClue | 교환 + 보여주기 |

## 호환성 매트릭스

**상호 배타:** script ↔ hybrid ↔ event / floor ↔ room ↔ timed
**의존:** skip-consensus → script / spatial-voice → voice-chat + (floor OR room)
**gmMode:** REQUIRED→gm-control / NONE→consensus / OPTIONAL→둘 다
