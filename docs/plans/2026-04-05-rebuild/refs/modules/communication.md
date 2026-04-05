# Communication 모듈 (5개) — 소통 수단

## 13. TextChatModule

```
타입: text-chat | 카테고리: COMMUNICATION | 인증: CHARACTER
PhaseReactor: ReactsTo [MUTE_CHAT, UNMUTE_CHAT]
```

**Config:** maxLength(500), cooldown(0초), showTimestamp(true), enableEmoji(true)

WS: `chat:send { message }` → `chat:message { sender, characterCode, message, timestamp }`
DB 저장(public_chats) + 방 브로드캐스트. 쿨다운 Redis. 읽음 커서 Redis.

---

## 14. WhisperModule

```
타입: whisper | 독립 (TextChat 의존 없음) | 인증: CHARACTER
PhaseReactor: ReactsTo [MUTE_CHAT, UNMUTE_CHAT]
```

**Config:** maxLength(300)

WS: `whisper:send { targetCode, message }` → `whisper:received / whisper:toast`
DB 저장(private_chats) + 발신자/수신자에게만. MUTE_CHAT 시 전송 차단.

---

## 15. GroupChatModule (밀담)

```
타입: group-chat | 인증: CHARACTER
PhaseReactor: ReactsTo [OPEN_GROUP_CHAT, CLOSE_GROUP_CHAT, MUTE_CHAT, UNMUTE_CHAT]
```

**Config:**
| Key | Label | Type | Default |
|-----|-------|------|---------|
| rooms | 밀담방 목록 | rooms_editor | [] |
| maxPerRoom | 방당 최대 인원 | number | 3 |
| timeLimit | 시간 제한 (초) | number | 180 |
| voiceEnabled | 음성 채널 연동 | boolean | true |

**에디터 사전 생성:** `rooms: [{ id, name, maxMembers }]`

**핵심:**
- OPEN_GROUP_CHAT 페이즈에서만 이동 가능
- 플레이어가 방 선택 → 입장 (max 초과 거부)
- voiceEnabled: 메인 음성 → 밀담 음성방 자동 이동 (LiveKit)
- CLOSE_GROUP_CHAT: 전원 메인 복귀
- 밖에서는 "○○님이 응접실에서 밀담 중" 표시만

WS: `groupchat:join/leave/send` → `groupchat:joined/left/message/status/opened/closed`

---

## 16. VoiceChatModule

```
타입: voice-chat | 인증: CHARACTER
```

**Config:** autoJoin(true), pushToTalk(false), maxParticipants(12)

LiveKit Provider 경유. 음성 없는 게임: 이 모듈 비활성화.

---

## 17. SpatialVoiceModule

```
타입: spatial-voice | requires: [voice-chat, (floor-exploration OR room-exploration)]
```

**Config:** autoJoin(true), muteOnPhaseChange(false)

층/방 단위 LiveKit 룸 분리. 이동 시 자동 음성방 전환.
