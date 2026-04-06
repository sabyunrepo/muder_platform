import { useState } from "react";
import { FriendsList, ChatList, ChatRoom } from "@/features/social/components";

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
    <div className="mx-auto flex h-[calc(100vh-4rem)] max-w-6xl flex-col">
      {/* Top tab bar */}
      <div className="flex border-b border-slate-700">
        <button
          type="button"
          className={`px-6 py-3 text-sm font-medium transition-colors ${
            view === "chat"
              ? "border-b-2 border-amber-500 text-amber-400"
              : "text-slate-400 hover:text-slate-200"
          }`}
          onClick={() => setView("chat")}
        >
          채팅
        </button>
        <button
          type="button"
          className={`px-6 py-3 text-sm font-medium transition-colors ${
            view === "friends"
              ? "border-b-2 border-amber-500 text-amber-400"
              : "text-slate-400 hover:text-slate-200"
          }`}
          onClick={() => setView("friends")}
        >
          친구
        </button>
      </div>

      {/* Content */}
      {view === "friends" ? (
        <div className="flex-1 overflow-hidden rounded-b-xl border-x border-b border-slate-700 bg-slate-950">
          <FriendsList />
        </div>
      ) : (
        <div className="flex flex-1 overflow-hidden rounded-b-xl border-x border-b border-slate-700">
          {/* Left: Chat list */}
          <div className="w-80 flex-shrink-0 border-r border-slate-700 bg-slate-950">
            <ChatList
              onSelectRoom={setSelectedRoomId}
              selectedRoomId={selectedRoomId}
            />
          </div>

          {/* Right: Chat room or placeholder */}
          <div className="flex-1 bg-slate-900">
            {selectedRoomId ? (
              <ChatRoom roomId={selectedRoomId} />
            ) : (
              <div className="flex h-full items-center justify-center">
                <p className="text-sm text-slate-500">
                  채팅방을 선택하세요
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
