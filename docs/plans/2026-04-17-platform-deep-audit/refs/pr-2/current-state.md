# PR-2 Split — 현재 상태 실측 (33 모듈)

> Source: W2 audit 03-module-architect §Metrics (2026-04-17) + main HEAD grep 재검증
> 기준: `BuildStateFor(playerID uuid.UUID) (json.RawMessage, error)` 메서드 존재 여부

## PlayerAware 구현 현황 (33 모듈)

| # | 모듈 | 카테고리 | 민감 필드 보유 | BuildStateFor | PR-2b 대상 | 비고 |
|---|------|---------|:-:|:-:|:-:|------|
| 01 | room | core | - | - | - | 공개 state (참가자 code 만) |
| 02 | ready | core | - | - | - | ready flag map - 전원 공개 의도 |
| 03 | connection | core | - | - | - | 연결 상태 메타, 플레이어별 필드 없음 |
| 04 | clue_interaction | core | O | - | **O** | `drawCount[playerID]` · `clueLevel[playerID]` 개인 상태 |
| 05 | starting_clue | cluedist | O | **O** | - | 구현됨 |
| 06 | round_clue | cluedist | O | **O** | - | 구현됨 |
| 07 | timed_clue | cluedist | O | **O** | - | 구현됨 |
| 08 | conditional_clue | cluedist | O | **O** | - | 구현됨 |
| 09 | trade_clue | cluedist | O | **O** | - | 구현됨 |
| 10 | text_chat | communication | O | - | **O** | DM 기록이 room-wide log 에 섞임 — 확인 필요 |
| 11 | whisper | communication | O | **O** | - | 구현됨 |
| 12 | group_chat | communication | O | - | **O** | `memberships[playerID]` 타 그룹 소속 누설 가능 |
| 13 | voice_chat | communication | - | - | - | LiveKit room 메타만, token 은 별도 endpoint |
| 14 | spatial_voice | communication | - | - | - | 위치 기반 필터는 클라이언트 |
| 15 | **evidence** | crime_scene | O | - | **O** | `discovered[pid]` `collected[pid]` 전체맵 노출 — **F-03 핵심** |
| 16 | **location** | crime_scene | O | - | **O** | `positions[pid]` `history[pid]` 전체맵 노출 — **F-03 핵심** |
| 17 | **combination** | crime_scene | O | - | **O** | `completed[pid]` `derived[pid]` `collected[pid]` — **F-03 핵심 + D-MO-1** |
| 18 | accusation | decision | O | - | **O** | `activeAccusation.Votes[pid]` 투표 분포 누설 |
| 19 | voting | decision | O | **O** | - | 구현됨 (secret mode redaction) |
| 20 | hidden_mission | decision | O | **O** | - | 구현됨 (타인 미션 redact) |
| 21 | floor_exploration | exploration | O | - | **O** | `floorSelection[pid]` 개인 선택 |
| 22 | room_exploration | exploration | O | - | **O** | 개인별 방문 기록 |
| 23 | timed_exploration | exploration | O | - | **O** | 개인 타이머 상태 |
| 24 | location_clue | exploration | O | - | **O** | 개인 노출 단서 맵 |
| 25 | audio | media | - | - | - | BGM/SFX 전원 동기화 |
| 26 | script_progression | progression | - | - | - | Phase 인덱스 공개 |
| 27 | event_progression | progression | - | - | - | 이벤트 큐 공개 |
| 28 | hybrid_progression | progression | - | - | - | script+event 합성 |
| 29 | reading | progression | O | - | **O** | 개인 읽기 진행 위치 |
| 30 | gm_control | progression | - | - | - | GM 전용 state, GM 만 수신 가정 (확인 필요) |
| 31 | consensus_control | progression | - | - | - | 제안 목록 공개 |
| 32 | skip_consensus | progression | - | - | - | 스킵 투표 공개 |
| 33 | ending | progression | - | - | - | 엔딩 분기 공개 |

## 요약

- **PlayerAware 구현 완료**: 8개 (cluedist 5 + whisper + hidden_mission + voting)
- **PR-2b 백필 필요**: 13개 (crime_scene 3 + decision 1 + communication 2 + core 1 + exploration 4 + progression 1 + clue_interaction 1 — **clue_interaction 은 core 중복 카운트**)
- **공개 state 확정** (PlayerAware 불요): 12개 (room · ready · connection · voice_chat · spatial_voice · audio · script_progression · event_progression · hybrid_progression · consensus_control · skip_consensus · ending)
- **확인 필요** (민감성 모호): text_chat(로그 구조), gm_control(GM-only 전달 채널 확인 필요)

실측 **8/33 (24%)** 구현, PR-2b 가 **13 모듈** 백필 → 목표 **21/33 (64%)**. 나머지 12 모듈은 공개 state 로 *명시적으로 opt-out* 하기 위해 PR-2a 에서 `var _ engine.PublicStateModule = ...` (네이밍 TBD) sentinel marker 도입 검토 — 아래 PR-2a 섹션 참조.

## 민감 필드 상세 (PR-2b 구현 가이드용)

### evidence (crime_scene)
```go
discovered   map[uuid.UUID][]string   // playerID → discovered evidenceIDs
collected    map[uuid.UUID][]string   // playerID → collected evidenceIDs
unlockedByID map[string]bool          // 전역, 공개 OK
```
→ BuildStateFor: `discovered[caller]` + `collected[caller]` 만 포함. 타 플레이어 키 제거.

### location (crime_scene)
```go
positions map[uuid.UUID]string
history   map[uuid.UUID][]string
lastMove  map[uuid.UUID]time.Time
```
→ BuildStateFor: `positions[caller]` 만 + `history[caller]` 만. 룸 전체 위치 공유는 별도 public state 분리 설계가 이상적이나 PR-2b 범위에서는 단순 redact.

### combination (crime_scene) — PR-2c 분리
```go
completed map[uuid.UUID][]string
derived   map[uuid.UUID][]string
collected map[uuid.UUID]map[string]bool
```
→ PR-2b 에서는 BuildStateFor 를 추가하되, redaction 은 PR-2c 로 분리. 즉 PR-2b 커밋에서는 `BuildStateFor` 가 현재 `BuildState` 와 동일 결과를 반환하는 **stub** 으로 두고, PR-2c 에서 실제 per-player filter 적용.

### accusation (decision)
```go
activeAccusation *Accusation  // Votes map[uuid.UUID]bool
```
→ `Votes` 는 결과 공개 전까지 hidden (accusation 완료 후에만 reveal). PR-2b 에서는 config 의 `VoteThreshold`/`DefenseTime` 등 공개 필드와 분리한 `activeAccusation` 을 "DefenseDeadline 전이면 Votes 비움, 이후 전원 공개" 정책 고정.

### clue_interaction (core)
```go
drawCount map[uuid.UUID]int
clueLevel map[uuid.UUID]int   // 개별 단서 난이도 단계
```
→ BuildStateFor: caller 만. 타 플레이어의 draw 상태는 공개하지 않음.

### group_chat (communication)
```go
memberships map[uuid.UUID][]string   // playerID → groupIDs
messages    map[string][]Message     // groupID → messages
```
→ BuildStateFor: `memberships[caller]` + `messages[g]` (g ∈ caller 가 속한 groups). 타 그룹 메시지는 엄격히 제외.

### reading (progression)
```go
progress map[uuid.UUID]int   // playerID → 현재 라인 인덱스
```
→ BuildStateFor: caller progress 만.

### exploration 4종 (floor/room/timed/location_clue)
- 각각 개인별 선택/방문/타이머/노출 단서 맵. 동일 패턴으로 caller 만 유지.
