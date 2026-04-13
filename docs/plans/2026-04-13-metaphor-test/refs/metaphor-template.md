# 메타포 6인 템플릿 구조

## 기본 정보
- id: metaphor_6p
- genre: murder_mystery
- name: 메타포 (6인)
- players: min=6, max=6

## 모듈 구성
```json
{
  "modules": [
    { "id": "connection" },
    { "id": "room" },
    { "id": "ready" },
    { "id": "text-chat", "config": { "maxLength": 500 } },
    { "id": "whisper" },
    { "id": "group-chat" },
    { "id": "clue-interaction", "config": {
      "drawLimit": 4,
      "initialClueLevel": 1,
      "cumulativeLevel": true,
      "duplicatePolicy": "exclusive"
    }},
    { "id": "trade-clue" },
    { "id": "script-progression" },
    { "id": "reading" },
    { "id": "voting", "config": {
      "mode": "secret",
      "minParticipation": 100,
      "tieBreaker": "revote",
      "maxRounds": 2
    }},
    { "id": "hidden-mission", "config": {
      "verificationMode": "self_report",
      "showResultAt": "ending",
      "affectsScore": true
    }},
    { "id": "ending", "config": {
      "showTimeline": true,
      "showMissionScores": true
    }},
    { "id": "consensus-control" }
  ]
}
```

## 페이즈 구성 (13단계)
```json
{
  "phases": [
    { "id": "lobby", "name": "대기실" },
    { "id": "prologue", "name": "사건의 배경", "readingSection": "prologue", "actions": ["MUTE_CHAT"] },
    { "id": "character_select", "name": "캐릭터 선택" },
    { "id": "opening", "name": "오프닝", "readingSection": "opening", "actions": ["MUTE_CHAT"] },
    { "id": "introduction", "name": "자기소개", "duration": 300, "actions": ["UNMUTE_CHAT"] },
    { "id": "investigation_1", "name": "1차 조사", "duration": 900, "actions": ["RESET_DRAW_COUNT", "SET_CLUE_LEVEL:1"] },
    { "id": "discussion_1", "name": "1차 토의", "duration": 1200, "actions": ["MUTE_WHISPER"] },
    { "id": "secret_reveal", "name": "시크릿카드", "readingSection": "secret" },
    { "id": "investigation_2", "name": "2차 조사", "duration": 900, "actions": ["RESET_DRAW_COUNT", "SET_CLUE_LEVEL:2"] },
    { "id": "discussion_2", "name": "2차 토의", "duration": 1200, "actions": ["MUTE_WHISPER"] },
    { "id": "voting", "name": "투표", "duration": 300, "actions": ["OPEN_VOTING"] },
    { "id": "action", "name": "액션" },
    { "id": "ending", "name": "엔딩", "actions": ["SHOW_ENDING"] }
  ]
}
```

## 캐릭터 (6명)
저스티스, + 5명 (테마 시드에서 구체화)

## 단서 구성
- 1차 단서: 장소별 분배 (level=1)
- 2차 단서: 장소별 분배 (level=2)
- 아이템 단서(★): is_usable=true, use_effect=peek
