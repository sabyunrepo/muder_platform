# Crime Scene 모듈 (3개) — 수사 메커니즘

> Phase 11.0(2026-04-13) 단서 아이템 + 메타포 템플릿 도입으로 승격된 신규 카테고리.
> 스펙 #24 `LocationClueModule`(탐색 위 단서 배치)과 달리, **crime_scene은 장소 이동·증거 수집·조합의 구체 수사 루프**를 담당. 독립 카테고리로 분리해 혼동 방지.

## 이벤트 체인

```
location.examine → location.examined
                    ↓ (autoDiscover=true)
                 evidence.discovered → evidence.collected
                                        ↓ (구독)
                                     combination.completed / clue_unlocked / available
```

---

## 30. LocationModule

```
타입: location | 카테고리: CRIME_SCENE | 인증: CHARACTER
PhaseReactor: 아님
인터페이스: Module + GameEventHandler + SerializableModule + RuleProvider + PlayerAwareModule
```

**ConfigSchema:**
| Key | Label | Type | Default |
|-----|-------|------|---------|
| locations | 장소 목록 | LocationDef[] | [] |
| startingLocation | 시작 장소 | string | "" |
| moveCooldownSec | 이동 쿨다운 (초) | number | 0 (무제한) |

**LocationDef:** `{ id, name, description, accessRules[] }`

**WS 이벤트:**
- `→ location:move { location_id }` → `← location.moved { playerID, locationID }`
- `→ location:examine { location_id }` → `← location.examined { playerID, locationID }`

**State (per-player):** `positions[playerID]` / `history[playerID]` / `lastMove[playerID]`

**PlayerAware 경계 (F-sec-2 / Phase 18.1 B-2):**
- `BuildStateFor(alice)` → 본인 위치 + 이동 히스토리만 공개
- Peer 위치는 기본 **비공개** (공개 맵 필요 시 `engine.PublicStateMarker` 임베드로 opt-out 권장)

**핵심:**
- 이동 시 쿨다운 검증 (`moveCooldownSec > 0` 설정 시)
- `startingLocation`은 Init 시점 존재 검증
- `evidence.autoDiscover=true`일 때 `location.examined` 발행 → evidence 모듈이 구독

---

## 31. EvidenceModule

```
타입: evidence | 카테고리: CRIME_SCENE | 인증: CHARACTER
PhaseReactor: 아님
인터페이스: Module + GameEventHandler + SerializableModule + PlayerAwareModule
```

**ConfigSchema:**
| Key | Label | Type | Default |
|-----|-------|------|---------|
| evidence | 증거 목록 | EvidenceDef[] | [] |
| autoDiscover | 장소 검사 시 자동 발견 | boolean | false |

**EvidenceDef:** `{ id, name, locationId, availableAtPhase, hidden }`
- `availableAtPhase=""` → 시작부터 해금
- `hidden=true` → autoDiscover 대상에서 제외 (명시적 discover 메시지 필요)

**WS 이벤트:**
- `→ evidence:discover { evidence_id, location_id? }` → `← evidence.discovered`
- `→ evidence:collect { evidence_id }` → `← evidence.collected`
- (자동) `location.examined` 구독 시 `autoDiscover` 실행

**핵심 불변식:**
1. collect는 discovered 이후에만 가능
2. 같은 증거 중복 discover/collect는 idempotent (무시)
3. `hidden=true` 증거는 autoDiscover 건너뜀 → 플레이어가 명시적으로 찾아야 함
4. phase 게이트: `availableAtPhase` 미도달 증거는 `unlockedByID=false`

**State (per-player):** `discovered[playerID][]` / `collected[playerID][]`

**PlayerAware:** 본인 발견/수집만 공개. Peer 진행 상황 누출 차단.

**EventBus 발행:** `evidence.discovered`, `evidence.collected` → combination 모듈이 수신

---

## 32. CombinationModule

```
타입: combination | 카테고리: CRIME_SCENE | 인증: CHARACTER
PhaseReactor: 아님
인터페이스: Module + GameEventHandler + WinChecker + RuleProvider
            + SerializableModule + PlayerAwareModule (5종 — 레포 최다)
파일 구조: 4-file 분할 (module/handlers/state/events)
```

**ConfigSchema:**
| Key | Label | Type | Default |
|-----|-------|------|---------|
| combinations | 조합 레시피 | CombinationDef[] | [] |
| winCombination | 승리 조건 증거 ID | string[] | [] |

**CombinationDef:** `{ id, inputIds[], outputClueId, description }`

**Phase 20 PR-5 단일 소스:** `id` 필드가 `clue_edge_groups.id`와 일치 → 에디터가 CRAFT-트리거 그룹을 만들면 ID 공유. 클라이언트는 `combine` payload에 `group_id`를 직접 넘길 수 있음 (O(1) 매칭). 미전달 시 `inputIds` 집합 동등성으로 fallback.

**WS 이벤트:**
- `→ combination:combine { evidence_ids[], group_id? }`
- `← combination.completed { playerID, combinationID }`
- `← combination.clue_unlocked { playerID, outputClueID }`
- `← combination.available { playerID, clueID }` (재료 확보 시 자동 발행)

**핵심 보안 — CRAFT Trigger (Phase 20 PR-5):**
- `clue.Graph`에 `Trigger: clue.TriggerCRAFT`로 등록 → 재료만 모여도 자동 해금 **금지**
- `handleCombine`가 명시적으로 성공해야 output clue가 `crafted` 집합에 진입
- `graph.Resolve(discovered, crafted)` — CRAFT output은 crafted 진입 전까지 reveal 차단

**핵심 불변식:**
1. `HasCycle()` Init 시점 검증 — 순환 의존 거부
2. 모든 input이 `collected`에 있어야 combine 성공
3. 같은 combo 중복 완료는 idempotent (early return)
4. **Deadlock 방지 (hotfix #108, 2026-04-18)**: EventBus publish는 `m.mu.Unlock()` 이후에만 수행 — BuildStateFor가 broadcast 경로에서 다시 m.mu를 잡을 수 있음

**PlayerAware 경계 (D-MO-1):**
- `BuildStateFor(alice)` → 본인 `completed` / `derived` / `collected`만 반환
- Peer가 무엇을 크래프팅했는지는 전략적 정보 → 절대 누출 금지
- `uuid.Nil` 방어: zero-value playerID로 호출 시 빈 shape 반환 (redaction layer에서 차단)

**State:**
- `completed[playerID][]` — 완료된 combination ID
- `derived[playerID][]` — 조합으로 획득한 output clue ID
- `collected[playerID]{evidenceID: bool}` — evidence 모듈 이벤트 미러

**WinChecker:** `winCombination` 전량 수집 시 해당 플레이어 승리 판정.

**RuleProvider:** `has_combination` 규칙 노출 (조건 빌더용).

---

## 호환성

- **independent** — 다른 모듈과 conflict 없음
- **권장 조합**: `location` + `evidence` + `combination` 3종 세트로 수사 루프 완성
- **연계 모듈**:
  - `ClueInteraction` — 단서 교환·양도
  - `ConditionalClue` — `evidence.collected` 이벤트 구독해 파생 단서 해금
  - `LocationClue` (스펙 #24) — 층/방 단위 추상 단서 분배 (crime_scene과 병행 가능)

## 구분: LocationClue vs crime_scene/location

| 축 | LocationClueModule (#24) | LocationModule (#30) |
|----|-------------------------|----------------------|
| 카테고리 | Exploration | CrimeScene |
| 역할 | "ThemeLocation에 단서 배치" | "플레이어 이동·검사" |
| State | 공용 단서 풀 | per-player 위치/히스토리 |
| PlayerAware | public | per-player redaction |
| 타입 문자열 | `location-clue` | `location` |
