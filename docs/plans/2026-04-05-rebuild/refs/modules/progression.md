# Progression 모듈 (8개) — 진행 방식

## 전략 (택 1, 상호 배타적)

### 5. ScriptProgressionModule

```
타입: script-progression | conflicts: [hybrid, event]
Config: allowSkip(bool), showProgress(bool), autoStartFirst(bool)
```
phases[] 순차 실행. 인덱스 기반. onEnter→타이머→onExit→다음. 리딩 섹션 완료 대기.

### 6. HybridProgressionModule

```
타입: hybrid-progression | conflicts: [script, event]
Config: consensusThreshold(70%), defaultAdvanceCondition(timer|trigger|consensus|manual)
```
자체 PhaseSequence. 페이즈별 조건 조합: timer/trigger/consensus/manual.
WS: `hybrid:consensus_vote`, `hybrid:trigger_event` → `hybrid:phase_changed`

### 7. EventProgressionModule

```
타입: event-progression | conflicts: [script, hybrid]
Config: initialPhase(text), allowBacktrack(bool)
```
방향성 그래프. triggers[] 매칭 시 targetPhase로 전환. 비선형.
WS: `event:trigger` → `event:phase_changed`

### 8. SkipConsensusModule

```
타입: skip-consensus | requires: [script-progression]
Config: autoAgreeTimeout(10초), requiredRatio(100%)
```
Script 위 보조. 전원 동의 시 스킵. N초 미응답 자동 동의.
WS: `skip:request/agree/disagree` → `skip:resolved`

---

## 보조 레이어 (gmMode 연동 자동 활성)

### 9. GmControlModule

```
타입: gm-control | 자동 활성: gmMode=REQUIRED/OPTIONAL
인증: GM
```
GM 수동 페이즈 제어. engine.GMOverride 경유 (onExit/onEnter 보장).
WS: `gm:start_prologue/start_playing/show_ending/toggle_voting/advance_phase/play_media/broadcast_message`

### 10. ConsensusControlModule

```
타입: consensus-control | 자동 활성: gmMode=NONE/OPTIONAL
인증: CHARACTER
```
7가지 합의 액션: START_GAME, NEXT_PHASE, NEXT_ROUND, START_VOTING, SHOW_ENDING, READING_COMPLETE, REVEAL_ALL_CLUES. 과반수 합의. 분산 락+멱등성.
WS: `consensus:propose/vote` → `consensus:result`

---

## 확장

### 11. ReadingModule

```
타입: reading | 카테고리: PROGRESSION (보조)
```
configJson.phases[].readingSection 기반 대사 순차 표시.
- advanceMode: gm(방장 제어) / auto(음성 완료 후) / player(각자)
- voiceId → AudioManager 자동 재생
- Redis: `reading:{sessionId}:lineIndex`

WS: `reading:advance/jump` → `reading:line_changed/completed` + `audio:play_voice`

### 12. EndingModule

```
타입: ending | Config: revealSteps, showTimeline(bool), showRelationships(bool), showMissionScores(bool)
AutoContent: 없음 (엔딩 = 자율형)
```

**reveal 단계 (순차 공개):**
1. 투표 결과 → 2. 범인 공개 → 3. 타임라인 → 4. 관계도 → 5. 히든 미션+점수 → 6. 엔딩 콘텐츠

configJson.endings: `[{ id, conditions, contentKey, bgmAssetKey, isDefault }]`
configJson.reveal: `{ timeline: [...], relationships: [...] }` (게임 중 비공개)

WS: `ending:next_reveal` → `ending:reveal_step { step, data }` → `ending:completed`
