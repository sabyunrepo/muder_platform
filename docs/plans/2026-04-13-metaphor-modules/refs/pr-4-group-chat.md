# PR-4: GroupChatTab — group_chat (GameChat 확장)

## 개요
GameChat에 소그룹 채팅 탭 추가. 소그룹 생성/참여/메시지.

## scope_globs
- apps/web/src/features/game/components/GameChat.tsx (수정)
- apps/web/src/features/game/components/__tests__/GameChat.test.tsx

## 백엔드 참조
- apps/server/internal/module/communication/group_chat.go
- WS 이벤트: chat:group_create, chat:group_join, chat:group_message

## 구현 상세
1. GameChat TabType 확장: "all" | "whisper" | "group"
2. 그룹 탭 선택 시:
   - 활성 그룹 목록 표시 (useModuleStore에서 groups 구독)
   - 그룹 선택 → 해당 그룹 메시지 표시
3. 그룹 생성: 참여자 선택 → send("chat:group_create", { memberIds })
4. 메시지 전송: send("chat:group_message", { groupId, text })

## 테스트
- 탭 전환
- 그룹 생성
- 그룹 메시지 전송/수신
