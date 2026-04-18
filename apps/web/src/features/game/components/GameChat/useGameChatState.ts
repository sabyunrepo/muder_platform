import { useState } from "react";
import type { WsEventType } from "@mmp/shared";
import { WsEventType as Events } from "@mmp/shared";
import { useWsEvent } from "@/hooks/useWsEvent";
import { useGameSessionStore as useGameStore } from "@/stores/gameSessionStore";
import { useModuleStore } from "@/stores/moduleStoreFactory";
import type { ChatMessageProps } from "../ChatMessage";
import {
  MAX_NICKNAME_LEN,
  MAX_TEXT_LEN,
  appendMessage,
  sanitizeChat,
} from "./types";
import type {
  ChatPayload,
  GroupChatData,
  GroupInfo,
  GroupMessagePayload,
  TabType,
  WhisperPayload,
} from "./types";

interface UseGameChatStateResult {
  activeTab: TabType;
  setActiveTab: (tab: TabType) => void;
  inputText: string;
  setInputText: (value: string) => void;
  whisperTarget: string;
  setWhisperTarget: (id: string) => void;
  selectedGroupId: string;
  setSelectedGroupId: (id: string) => void;
  isCreatingGroup: boolean;
  setIsCreatingGroup: (value: boolean) => void;
  selectedMembers: string[];
  toggleMember: (id: string) => void;
  resetSelectedMembers: () => void;
  currentMessages: ChatMessageProps[];
  otherPlayers: { id: string; nickname: string }[];
  groups: GroupInfo[];
  handleSend: () => void;
  handleKeyDown: (e: React.KeyboardEvent) => void;
  handleCreateGroup: () => void;
  isSendDisabled: boolean;
}

/** GameChat state + WS 이벤트 구독을 단일 hook으로 응집 */
export function useGameChatState(
  send: (type: WsEventType, payload: unknown) => void,
): UseGameChatStateResult {
  const [activeTab, setActiveTab] = useState<TabType>("all");
  const [messages, setMessages] = useState<ChatMessageProps[]>([]);
  const [whisperMessages, setWhisperMessages] = useState<ChatMessageProps[]>([]);
  const [inputText, setInputText] = useState("");
  const [whisperTarget, setWhisperTarget] = useState<string>("");

  const [selectedGroupId, setSelectedGroupId] = useState<string>("");
  const [groupMessages, setGroupMessages] = useState<Record<string, ChatMessageProps[]>>({});
  const [isCreatingGroup, setIsCreatingGroup] = useState(false);
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);

  const players = useGameStore((s) => s.players);
  const myPlayerId = useGameStore((s) => s.myPlayerId);

  const groupChatData = useModuleStore("group_chat", (s) => s.data as GroupChatData);
  const groups: GroupInfo[] = groupChatData.groups ?? [];

  const otherPlayers = players.filter((p) => p.id !== myPlayerId);

  const currentMessages =
    activeTab === "all"
      ? messages
      : activeTab === "whisper"
        ? whisperMessages
        : selectedGroupId
          ? (groupMessages[selectedGroupId] ?? [])
          : [];

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

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleCreateGroup = () => {
    if (selectedMembers.length === 0) return;
    send(Events.GAME_ACTION, { type: "chat:group_create", memberIds: selectedMembers });
    setIsCreatingGroup(false);
    setSelectedMembers([]);
  };

  const toggleMember = (id: string) => {
    setSelectedMembers((prev) =>
      prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id],
    );
  };

  const resetSelectedMembers = () => setSelectedMembers([]);

  const isSendDisabled =
    !inputText.trim() ||
    (activeTab === "whisper" && !whisperTarget) ||
    (activeTab === "group" && !selectedGroupId);

  return {
    activeTab,
    setActiveTab,
    inputText,
    setInputText,
    whisperTarget,
    setWhisperTarget,
    selectedGroupId,
    setSelectedGroupId,
    isCreatingGroup,
    setIsCreatingGroup,
    selectedMembers,
    toggleMember,
    resetSelectedMembers,
    currentMessages,
    otherPlayers,
    groups,
    handleSend,
    handleKeyDown,
    handleCreateGroup,
    isSendDisabled,
  };
}
