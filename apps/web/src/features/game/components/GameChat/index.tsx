import { TabHeader } from "./TabHeader";
import { WhisperTargetSelect } from "./WhisperTargetSelect";
import { GroupSidebar } from "./GroupSidebar";
import { MessageComposer } from "./MessageComposer";
import { MessageList } from "./MessageList";
import { useGameChatState } from "./useGameChatState";
import type { GameChatProps } from "./types";

/**
 * GameChat — 게임 세션 내 채팅 UI (전체/귓속말/그룹 3-tab).
 *
 * 상태·WS 이벤트 구독은 `useGameChatState` 훅에 응집되어 있고, 이 컴포넌트는
 * 탭/입력/리스트/그룹 사이드바 등 서브 컴포넌트 합성만 담당한다.
 */
export function GameChat({ send, fullWidth = false }: GameChatProps) {
  const s = useGameChatState(send);

  return (
    <div className={`flex flex-col bg-slate-900 ${fullWidth ? "h-full" : "h-full rounded-xl border border-slate-800"}`}>
      <TabHeader activeTab={s.activeTab} onChange={s.setActiveTab} />

      {s.activeTab === "whisper" && (
        <WhisperTargetSelect
          value={s.whisperTarget}
          onChange={s.setWhisperTarget}
          options={s.otherPlayers}
        />
      )}

      {s.activeTab === "group" && (
        <GroupSidebar
          groups={s.groups}
          selectedGroupId={s.selectedGroupId}
          onSelectGroup={s.setSelectedGroupId}
          isCreatingGroup={s.isCreatingGroup}
          onStartCreate={() => s.setIsCreatingGroup(true)}
          onCancelCreate={() => {
            s.setIsCreatingGroup(false);
            s.resetSelectedMembers();
          }}
          selectedMembers={s.selectedMembers}
          onToggleMember={s.toggleMember}
          onCreateGroup={s.handleCreateGroup}
          otherPlayers={s.otherPlayers}
        />
      )}

      <MessageList
        messages={s.currentMessages}
        activeTab={s.activeTab}
        selectedGroupId={s.selectedGroupId}
      />

      <MessageComposer
        activeTab={s.activeTab}
        value={s.inputText}
        onChange={s.setInputText}
        onKeyDown={s.handleKeyDown}
        onSend={s.handleSend}
        disabled={s.isSendDisabled}
      />
    </div>
  );
}
