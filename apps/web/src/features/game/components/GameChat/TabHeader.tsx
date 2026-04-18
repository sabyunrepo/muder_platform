import { MessageCircle, Lock, Users } from "lucide-react";
import type { TabType } from "./types";

interface TabHeaderProps {
  activeTab: TabType;
  onChange: (tab: TabType) => void;
}

export function TabHeader({ activeTab, onChange }: TabHeaderProps) {
  return (
    <div className="flex border-b border-slate-800">
      <button
        type="button"
        className={`flex flex-1 items-center justify-center gap-1.5 px-4 py-2.5 text-sm font-medium transition-colors ${
          activeTab === "all"
            ? "border-b-2 border-amber-500 text-amber-400"
            : "text-slate-400 hover:text-slate-200"
        }`}
        onClick={() => onChange("all")}
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
        onClick={() => onChange("whisper")}
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
        onClick={() => onChange("group")}
      >
        <Users className="h-3.5 w-3.5" />
        그룹
      </button>
    </div>
  );
}
