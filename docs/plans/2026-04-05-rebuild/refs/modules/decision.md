# Decision 모듈 (3개) — 결정/투표

## 18. VotingModule (공개+비밀 통합)

```
타입: voting | 카테고리: DECISION | 인증: CHARACTER
PhaseReactor: ReactsTo [OPEN_VOTING, CLOSE_VOTING]
AutoContent: voting-guide (투표 안내문)
```

**ConfigSchema:**
| Key | Label | Type | Default | DependsOn |
|-----|-------|------|---------|-----------|
| mode | 투표 방식 | select | open | |
| minParticipation | 최소 참여율 % | number | 75 | |
| tieBreaker | 동점 처리 | select | revote | |
| showRealtime | 실시간 현황 | boolean | true | mode=open |
| revealVoters | 결과 시 투표자 공개 | boolean | false | mode=secret |
| allowAbstain | 기권 허용 | boolean | false | |
| maxRounds | 최대 재투표 | number | 3 | |
| deadCanVote | 사망자 투표 | boolean | false | |

**핵심:** mode=open → 실시간 현황. mode=secret → votedCount만. 비밀도 DB 저장(감사용, API 비노출). 공용 Poll 유틸. 동점: revote/random/no_result.

WS: `vote:cast/change` → `vote:status/result/opened/closed`

---

## 19. AccusationModule

```
타입: accusation | 인증: CHARACTER
AutoContent: accusation-guide (고발 안내문)
```

**Config:** maxPerRound(1), defenseTime(60초), voteThreshold(50%), allowSelfAccuse(false), deadCanAccuse(false)

**플로우:** 지목 → 변론 타이머 → 찬반 투표 → 추방/생존.
동시 지목 방지 (하나만 활성). 추방: player.isAlive=false. 공용 Poll 유틸.

WS: `accusation:accuse/vote` → `accusation:started/vote_status/resolved`

---

## 20. HiddenMissionModule

```
타입: hidden-mission | 인증: CHARACTER
AutoContent: mission:{characterCode} (캐릭터당 1개, perCharacter=true)
```

**Config:** verificationMode(auto/self_report/gm_verify), showResultAt(ending), scoreWinnerTitle("MVP"), affectsScore(true)

**자동 검증 미션:** hold_clue(단서 보유), vote_target(투표), transfer_clue(전달), survive(생존)
**수동 검증 미션:** custom(주관적 → self_report 또는 gm_verify)

**에디터 설정:**
```json
{ characterCode: "godong", missions: [
  { type: "hold_clue", targetClueId: "clue-ring", points: 10, verification: "auto" },
  { type: "custom", description: "외도 사실 숨기기", points: 25, verification: "gm_verify" }
]}
```

**엔딩 reveal:** 캐릭터별 달성/미달성 + 획득 점수 → 합산 순위 → MVP 표시
