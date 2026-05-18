import { useState } from "react";
import { FriendsList, ChatList, ChatRoom } from "@/features/social/components";
import { PageShell, Panel, SectionHeader } from "@/shared/components/ui";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type View = "chat" | "friends";

// ---------------------------------------------------------------------------
// SocialPage
// ---------------------------------------------------------------------------

export default function SocialPage() {
  const [view, setView] = useState<View>("chat");
  const [selectedRoomId, setSelectedRoomId] = useState<string | undefined>(undefined);

  return (
    <PageShell
      header={
        <SectionHeader
          title="소셜"
          description="친구와 채팅을 관리하고 함께 플레이할 준비를 합니다."
        />
      }
    >
      <Panel padding="none" className="mx-auto flex h-[calc(100vh-11rem)] min-h-[560px] w-full max-w-6xl flex-col overflow-hidden">
      <div className="flex border-b border-[var(--mmp-color-hairline)]">
        <button
          type="button"
          className={`px-6 py-3 text-sm font-medium transition-colors ${
            view === "chat"
              ? "border-b-2 border-[var(--mmp-color-primary)] text-[var(--mmp-color-primary)]"
              : "text-[var(--mmp-color-steel)] hover:text-[var(--mmp-color-ink)]"
          }`}
          onClick={() => setView("chat")}
        >
          채팅
        </button>
        <button
          type="button"
          className={`px-6 py-3 text-sm font-medium transition-colors ${
            view === "friends"
              ? "border-b-2 border-[var(--mmp-color-primary)] text-[var(--mmp-color-primary)]"
              : "text-[var(--mmp-color-steel)] hover:text-[var(--mmp-color-ink)]"
          }`}
          onClick={() => setView("friends")}
        >
          친구
        </button>
      </div>

      {/* Content */}
      {view === "friends" ? (
        <div className="flex-1 overflow-hidden bg-[var(--mmp-color-surface)]">
          <FriendsList />
        </div>
      ) : (
        <div className="flex flex-1 flex-col overflow-hidden md:flex-row">
          {/* Left: Chat list */}
          <div className="min-h-[360px] flex-shrink-0 border-b border-[var(--mmp-color-hairline)] bg-[var(--mmp-color-surface)] md:min-h-0 md:w-80 md:border-b-0 md:border-r">
            <ChatList
              onSelectRoom={setSelectedRoomId}
              selectedRoomId={selectedRoomId}
            />
          </div>

          {/* Right: Chat room or placeholder */}
          <div className="min-h-[360px] flex-1 bg-[var(--mmp-color-surface-soft)] md:min-h-0">
            {selectedRoomId ? (
              <ChatRoom roomId={selectedRoomId} />
            ) : (
              <div className="flex h-full items-center justify-center">
                <p className="text-sm text-[var(--mmp-color-steel)]">
                  채팅방을 선택하세요
                </p>
              </div>
            )}
          </div>
        </div>
      )}
      </Panel>
    </PageShell>
  );
}
