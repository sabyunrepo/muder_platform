import { X, Check } from "lucide-react";

interface GroupCreateViewProps {
  otherPlayers: { id: string; nickname: string }[];
  selectedMembers: string[];
  onToggleMember: (id: string) => void;
  onCancelCreate: () => void;
  onCreateGroup: () => void;
}

export function GroupCreateView({
  otherPlayers,
  selectedMembers,
  onToggleMember,
  onCancelCreate,
  onCreateGroup,
}: GroupCreateViewProps) {
  return (
    <div className="px-3 py-2">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-slate-400">멤버 선택</span>
        <button
          type="button"
          className="text-slate-500 hover:text-slate-300 transition-colors"
          onClick={onCancelCreate}
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
            onClick={() => onToggleMember(p.id)}
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
        onClick={onCreateGroup}
        disabled={selectedMembers.length === 0}
      >
        그룹 만들기 ({selectedMembers.length}명)
      </button>
    </div>
  );
}
