# 4개 장르별 GenrePlugin 구현 가이드

> 부모: [../design.md](../design.md)

---

## 공통 구조

모든 GenrePlugin은 동일 인터페이스를 구현하며, `init()`에서 Registry에 자동 등록합니다.

```go
// genre/crime_scene/plugin.go
package crimescene

func init() {
    engine.DefaultRegistry.Register("crime_scene", func() engine.GenrePlugin {
        return NewCrimeScenePlugin()
    })
}
```

---

## 1. 크라임씬 (Crime Scene)

**게임 방식**: 보드게임 기반 추리, 증거 배치/거래/조합, 장소 탐색

### 기본 페이즈 구조
```
[Intro] → [Evidence Review] → [Exploration] → [Discussion] → [Accusation] → [Resolution]
                                    ↕                   ↑
                              [Additional Rounds]
```

### 장르별 확장
- `Validate`: 탐색 제한 (역할별 장소 접근), 증거 조합 규칙
- `Apply`: 장소 이동, 증거 수색, 증거 교환, 증거 파괴
- `CheckWin`: 핵심 증거 3종(동기/기회/무기) 조합 완료 시
- `OnPhaseEnter`: 탐색 페이즈 진입 시 새 단서 해금

### ConfigSchema (에디터 자동 UI)
```json
{
    "boardType": { "type": "string", "enum": ["floor", "room", "map"] },
    "explorationRounds": { "type": "integer", "minimum": 1, "maximum": 10 },
    "evidencePerSearch": { "type": "integer", "minimum": 1, "maximum": 5 },
    "tradeEnabled": { "type": "boolean", "default": true },
    "combinationEnabled": { "type": "boolean", "default": true },
    "locationAccessByRole": { "type": "boolean", "default": true },
    "accusationRounds": { "type": "integer", "minimum": 1, "maximum": 3 }
}
```

---

## 2. 스크립트킬 (Script Kill)

**게임 방식**: 스크립트 중심 LARP, 라운드별 스크립트 공개, 투표/분석 타임

### 기본 페이즈 구조
```
[Intro] → [Script Round 1: Read] → [Script Round 1: Discuss] → [Vote]
         → [Script Round 2: Read] → [Script Round 2: Discuss] → [Vote]
         → [Script Round N: Read] → [Script Round N: Discuss] → [Final Vote]
         → [Reveal]
```

### 장르별 확장
- `Validate`: 스크립트 공개 순서, 읽기 시간 제한
- `Apply`: 스크립트 페이지 넘기기, 개인 정보 공개
- `CheckWin`: 최종 투표 결과 + 정답 매칭
- `OnPhaseEnter`: 라운드 진입 시 해당 라운드 스크립트 배부

### ConfigSchema
```json
{
    "totalRounds": { "type": "integer", "minimum": 1, "maximum": 10 },
    "readingTimePerRound": { "type": "integer", "minimum": 60, "maximum": 1800 },
    "discussionTimePerRound": { "type": "integer", "minimum": 60, "maximum": 3600 },
    "autoAdvanceReading": { "type": "boolean", "default": true },
    "scriptRevealOrder": { "type": "string", "enum": ["sequential", "simultaneous", "custom"] },
    "finalVoteEnabled": { "type": "boolean", "default": true }
}
```

---

## 3. 쥬번샤 (Jubensha)

**게임 방식**: 중국식 스크립트 추리, 휴식/분석 타임, 1인칭 스크립트 뷰, 음성 중심

### 기본 페이즈 구조
```
[Intro] → [Role Reveal] → [Read Script 1] → [Investigation] → [Rest] →
[Read Script 2] → [Group Discussion] → [Rest] →
[Read Script 3] → [Debate] → [Final Vote] → [Reveal]
```

### 장르별 확장
- `Validate`: 휴식 시간 규칙, 그룹 토론 참여 조건
- `Apply`: 휴식 모드 전환, 그룹 편성, 음성 채널 이동
- `CheckWin`: 최종 투표 + 범인 식별
- `OnPhaseEnter`: 휴식 페이즈 진입 시 밀담방 자동 생성

### ConfigSchema
```json
{
    "totalRounds": { "type": "integer", "minimum": 1, "maximum": 15 },
    "restTimeBetweenRounds": { "type": "integer", "minimum": 60, "maximum": 600 },
    "voiceChatEnabled": { "type": "boolean", "default": true },
    "groupDiscussionEnabled": { "type": "boolean", "default": true },
    "groupSize": { "type": "integer", "minimum": 2, "maximum": 6 },
    "scriptFormat": { "type": "string", "enum": ["first_person", "third_person", "mixed"] },
    "bgmPerPhase": { "type": "boolean", "default": true }
}
```

---

## 4. 머더미스터리 파티 (Murder Mystery Party)

**게임 방식**: 라운드제, 라운드별 단서 배포, 최종 투표로 범인 지목

### 기본 페이즈 구조
```
[Intro] → [Round 1: Clue Distribute] → [Round 1: Discussion] → [Round 1: Vote]
         → [Round 2: Clue Distribute] → [Round 2: Discussion] → [Round 2: Vote]
         → [Final Round: Accusation] → [Reveal]
```

### 장르별 확장
- `Validate`: 라운드별 단서 배포 규칙, 투표 제한
- `Apply`: 단서 자동 배포, 비밀 투표, 투표 결과 공개
- `CheckWin`: 범인 지목 성공/실패 판정
- `OnPhaseEnter`: 라운드 진입 시 조건부 단서 배포

### ConfigSchema
```json
{
    "totalRounds": { "type": "integer", "minimum": 1, "maximum": 5 },
    "cluesPerRound": { "type": "integer", "minimum": 1, "maximum": 10 },
    "discussionTime": { "type": "integer", "minimum": 60, "maximum": 1800 },
    "voteType": { "type": "string", "enum": ["public", "secret", "sequential"] },
    "voteTime": { "type": "integer", "minimum": 30, "maximum": 600 },
    "eliminationEnabled": { "type": "boolean", "default": true },
    "deadPlayerReveal": { "type": "boolean", "default": false }
}
```

---

## 장르별 에디터 템플릿

| 장르 | 프리셋 템플릿 | 기본 인원 | 기본 시간 |
|------|-------------|----------|----------|
| 크라임씬 | "보드 탐정 4인", "증거 조합 6인" | 4-8 | 60-120분 |
| 스크립트킬 | "3라운드 스크립트", "5라운드 미스터리" | 4-10 | 90-180분 |
| 쥬번샤 | "감성 추리 6인", "하드코어 추리 8인" | 4-12 | 120-300분 |
| 머더미스터리 | "빠른 3라운드", "클래식 5라운드" | 4-12 | 60-150분 |
