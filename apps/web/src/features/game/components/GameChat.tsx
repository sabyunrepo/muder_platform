import { useState, useRef, useEffect, useCallback } from "react";
import { Send, MessageCircle, Lock, Users, Plus, X, Check } from "lucide-react";
import type { WsEventType } from "@mmp/shared";
import { WsEventType as Events } from "@mmp/shared";
import { Button, Input } from "@/shared/components/ui";
import { useWsEvent } from "@/hooks/useWsEvent";
import { useGameSessionStore as useGameStore } from "@/stores/gameSessionStore";
import { useModuleStore } from "@/stores/moduleStoreFactory";
import { ChatMessage } from "./ChatMessage";
import type { ChatMessageProps } from "./ChatMessage";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** WS에서 수신하는 채팅 페이로드 */
interface ChatPayload {
  sender: string;
  nickname: string;
  text: string;
  ts: number;
}

/** WS에서 수신하는 귓속말 페이로드 */
interface WhisperPayload {
  sender: string;
  nickname: string;
  targetId: string;
  text: string;
  ts: number;
}

/** 그룹 정보 */
interface GroupInfo {
  id: string;
  name: string;
  members: string[];
}

/** 그룹 메시지 페이로드 */
interface GroupMessagePayload {
  groupId: string;
  senderId: string;
  senderName: string;
  text: string;
  ts: number;
}

/** group_chat 모듈 스토어 데이터 형태 */
interface GroupChatData {
  groups?: GroupInfo[];
  groupMessages?: Record<string, GroupMessagePayload[]>;
}

type TabType = "all" | "whisper" | "group";

interface GameChatProps {
  /** WS send 함수 */
  send: (type: WsEventType, payload: unknown) => void;
  /** discussion 페이즈에서 전체 너비로 표시 */
  fullWidth?: boolean;
}

// ---------------------------------------------------------------------------
// 메시지 상한
// ---------------------------------------------------------------------------

const MAX_MESSAGES = 500;
const MAX_NICKNAME_LEN = 20;
const MAX_TEXT_LEN = 1000;

/** WS 수신 메시지의 닉네임/텍스트 길이를 제한한다 */
function sanitizeChat(payload: { nickname: string; text: string }) {
  return {
    nickname: String(payload.nickname || "").slice(0, MAX_NICKNAME_LEN),
    text: String(payload.text || "").slice(0, MAX_TEXT_LEN),
  };
}

function appendMessage<T>(prev: T[], msg: T): T[] {
  const next = [...prev, msg];
  return next.length > MAX_MESSAGES ? next.slice(-MAX_MESSAGES) : next;
}

// ---------------------------------------------------------------------------
// GameChat
// ---------------------------------------------------------------------------

export function GameChat({ send, fullWidth = false }: GameChatProps) {
  const [activeTab, setActiveTab] = useState<TabType>("all");
  const [messages, setMessages] = useState<ChatMessageProps[]>([]);
  const [whisperMessages, setWhisperMessages] = useState<ChatMessageProps[]>([]);
  const [inputText, setInputText] = useState("");
  const [whisperTarget, setWhisperTarget] = useState<string>("");

  // 그룹 관련 상태
  const [selectedGroupId, setSelectedGroupId] = useState<string>("");
  const [groupMessages, setGroupMessages] = useState<Record<string, ChatMessageProps[]>>({});
  const [isCreatingGroup, setIsCreatingGroup] = useState(false);
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // 스토어에서 플레이어 정보 가져오기
  const players = useGameStore((s) => s.players);
  const myPlayerId = useGameStore((s) => s.myPlayerId);

  // group_chat 모듈 스토어 구독
  const groupChatData = useModuleStore("group_chat", (s) => s.data as GroupChatData);
  const groups: GroupInfo[] = groupChatData.groups ?? [];

  // 자신을 제외한 플레이어 목록
  const otherPlayers = players.filter((p) => p.id !== myPlayerId);

  // 스크롤 하단 고정
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  const currentMessages =
    activeTab === "all"
      ? messages
      : activeTab === "whisper"
        ? whisperMessages
        : selectedGroupId
          ? (groupMessages[selectedGroupId] ?? [])
          : [];

  useEffect(() => {
    scrollToBottom();
  }, [currentMessages, scrollToBottom]);

  // WS 이벤트 구독: 전체 채팅
  useWsEvent<ChatPayload>("game", Events.CHAT_MESSAGE, (payload) => {
    const { nickname, text } = sanitizeChat(payload);
    setMessages((prev) =>
      appendMessage(prev, {
        nickname,
        text,
        ts: payload.ts,
        isMine: payload.sender === myPlayerId,
      }),
    );
  });

  // WS 이벤트 구독: 귓속말
  useWsEvent<WhisperPayload>("game", Events.CHAT_WHISPER, (payload) => {
    const { nickname, text } = sanitizeChat(payload);
    setWhisperMessages((prev) =>
      appendMessage(prev, {
        nickname,
        text,
        ts: payload.ts,
        isWhisper: true,
        isMine: payload.sender === myPlayerId,
      }),
    );
  });

  // WS 이벤트 구독: 그룹 메시지 (MODULE_EVENT를 통해 수신)
  useWsEvent<{ type: string; data: GroupMessagePayload }>("game", Events.MODULE_EVENT, (payload) => {
    if (payload.type !== "groupMessage") return;
    const data = payload.data;
    const text = String(data.text || "").slice(0, MAX_TEXT_LEN);
    const senderName = String(data.senderName || "").slice(0, MAX_NICKNAME_LEN);
    setGroupMessages((prev) => ({
      ...prev,
      [data.groupId]: appendMessage(prev[data.groupId] ?? [], {
        nickname: senderName,
        text,
        ts: data.ts,
        isGroup: true,
        isMine: data.senderId === myPlayerId,
      }),
    }));
  });

  /** 메시지 전송 */
  const handleSend = () => {
    const trimmed = inputText.trim();
    if (!trimmed) return;

    if (activeTab === "whisper") {
      if (!whisperTarget) return;
      send(Events.CHAT_WHISPER, { targetId: whisperTarget, text: trimmed });
    } else if (activeTab === "group") {
      if (!selectedGroupId) return;
      send(Events.GAME_ACTION, { type: "chat:group_message", groupId: selectedGroupId, text: trimmed });
    } else {
      send(Events.CHAT_MESSAGE, { text: trimmed });
    }

    setInputText("");
  };

  /** Enter 키 전송 */
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  /** 그룹 생성 */
  const handleCreateGroup = () => {
    if (selectedMembers.length === 0) return;
    send(Events.GAME_ACTION, { type: "chat:group_create", memberIds: selectedMembers });
    setIsCreatingGroup(false);
    setSelectedMembers([]);
  };

  /** 멤버 체크박스 토글 */
  const toggleMember = (id: string) => {
    setSelectedMembers((prev) =>
      prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id],
    );
  };

  // 전송 버튼 비활성화 조건
  const isSendDisabled =
    !inputText.trim() ||
    (activeTab === "whisper" && !whisperTarget) ||
    (activeTab === "group" && !selectedGroupId);

  return (
    <div className={`flex flex-col bg-slate-900 ${fullWidth ? "h-full" : "h-full rounded-xl border border-slate-800"}`}>
      {/* 탭 헤더 */}
      <div className="flex border-b border-slate-800">
        <button
          type="button"
          className={`flex flex-1 items-center justify-center gap-1.5 px-4 py-2.5 text-sm font-medium transition-colors ${
            activeTab === "all"
              ? "border-b-2 border-amber-500 text-amber-400"
              : "text-slate-400 hover:text-slate-200"
          }`}
          onClick={() => setActiveTab("all")}
        >
          <MessageCircle className="h-3.5 w-3.5" />
          전체
        </button>
        <button
          type="button"
          className={`flex flex-1 items-center justify-center gap-1.5 px-4 py-2.5 text-sm font-medium transition-colors ${
            activeTab === "whisper"
              ? "border-b-2 border-purple-500 text-purple-400"
              : "text-slate-400 hover:text-slate-200"
          }`}
          onClick={() => setActiveTab("whisper")}
        >
          <Lock className="h-3.5 w-3.5" />
          귓속말
        </button>
        <button
          type="button"
          className={`flex flex-1 items-center justify-center gap-1.5 px-4 py-2.5 text-sm font-medium transition-colors ${
            activeTab === "group"
              ? "border-b-2 border-teal-500 text-teal-400"
              : "text-slate-400 hover:text-slate-200"
          }`}
          onClick={() => setActiveTab("group")}
        >
          <Users className="h-3.5 w-3.5" />
          그룹
        </button>
      </div>

      {/* 귓속말 대상 선택 */}
      {activeTab === "whisper" && (
        <div className="border-b border-slate-800 px-3 py-2">
          <select
            className="w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-1.5 text-sm text-slate-200 outline-none focus:border-purple-500"
            value={whisperTarget}
            onChange={(e) => setWhisperTarget(e.target.value)}
          >
            <option value="">대상 선택...</option>
            {otherPlayers.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nickname}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* 그룹 탭 사이드바 */}
      {activeTab === "group" && (
        <div className="border-b border-slate-800">
          {/* 그룹 목록 */}
          {!isCreatingGroup ? (
            <div className="px-3 py-2">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-slate-400">그룹 목록</span>
                <button
                  type="button"
                  className="flex items-center gap-1 rounded px-2 py-1 text-xs text-teal-400 hover:bg-slate-800 hover:text-teal-300 transition-colors"
                  onClick={() => setIsCreatingGroup(true)}
                >
                  <Plus className="h-3 w-3" />
                  그룹 만들기
                </button>
              </div>
              {groups.length === 0 ? (
                <p className="py-2 text-center text-xs text-slate-500">생성된 그룹이 없습니다.</p>
              ) : (
                <div className="flex flex-col gap-1 max-h-28 overflow-y-auto">
                  {groups.map((g) => (
                    <button
                      key={g.id}
                      type="button"
                      className={`flex items-center justify-between rounded-md px-2.5 py-1.5 text-sm transition-colors ${
                        selectedGroupId === g.id
                          ? "bg-teal-900/40 text-teal-300"
                          : "text-slate-300 hover:bg-slate-800"
                      }`}
                      onClick={() => setSelectedGroupId(g.id)}
                    >
                      <span className="font-medium">{g.name}</span>
                      <span className="text-xs text-slate-500">{g.members.length}명</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            /* 그룹 생성 UI */
            <div className="px-3 py-2">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-slate-400">멤버 선택</span>
                <button
                  type="button"
                  className="text-slate-500 hover:text-slate-300 transition-colors"
                  onClick={() => { setIsCreatingGroup(false); setSelectedMembers([]); }}
                  aria-label="취소"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="flex flex-col gap-1 max-h-28 overflow-y-auto mb-2">
                {otherPlayers.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    className={`flex items-center gap-2 rounded-md px-2.5 py-1.5 text-sm transition-colors ${
                      selectedMembers.includes(p.id)
                        ? "bg-teal-900/40 text-teal-300"
                        : "text-slate-300 hover:bg-slate-800"
                    }`}
                    onClick={() => toggleMember(p.id)}
                  >
                    <div className={`flex h-4 w-4 flex-shrink-0 items-center justify-center rounded border ${
                      selectedMembers.includes(p.id)
                        ? "border-teal-500 bg-teal-500"
                        : "border-slate-600"
                    }`}>
                      {selectedMembers.includes(p.id) && <Check className="h-2.5 w-2.5 text-white" />}
                    </div>
                    {p.nickname}
                  </button>
                ))}
              </div>
              <button
                type="button"
                className="w-full rounded-md bg-teal-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-teal-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                onClick={handleCreateGroup}
                disabled={selectedMembers.length === 0}
              >
                그룹 만들기 ({selectedMembers.length}명)
              </button>
            </div>
          )}
        </div>
      )}

      {/* 메시지 영역 */}
      <div className="flex-1 overflow-y-auto p-4">
        {currentMessages.length === 0 ? (
          <p className="py-8 text-center text-sm text-slate-500">
            {activeTab === "group" && !selectedGroupId
              ? "그룹을 선택하거나 만들어보세요."
              : "아직 메시지가 없습니다."}
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {currentMessages.map((msg, i) => (
              <ChatMessage
                key={`${msg.nickname}-${msg.ts}-${i}`}
                {...msg}
              />
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* 입력 폼 */}
      <div className="flex items-center gap-2 border-t border-slate-800 p-3">
        <div className="flex-1">
          <Input
            placeholder={
              activeTab === "whisper"
                ? "귓속말을 입력하세요..."
                : activeTab === "group"
                  ? "그룹 메시지를 입력하세요..."
                  : "메시지를 입력하세요..."
            }
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
          />
        </div>
        <Button
          variant="primary"
          size="md"
          onClick={handleSend}
          disabled={isSendDisabled}
          aria-label="메시지 전송"
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
