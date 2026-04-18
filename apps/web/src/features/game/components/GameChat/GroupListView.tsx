import { Plus } from "lucide-react";
import type { GroupInfo } from "./types";

interface GroupListViewProps {
  groups: GroupInfo[];
  selectedGroupId: string;
  onSelectGroup: (id: string) => void;
  onStartCreate: () => void;
}

export function GroupListView({
  groups,
  selectedGroupId,
  onSelectGroup,
  onStartCreate,
}: GroupListViewProps) {
  return (
    <div className="px-3 py-2">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-slate-400">그룹 목록</span>
        <button
          type="button"
          className="flex items-center gap-1 rounded px-2 py-1 text-xs text-teal-400 hover:bg-slate-800 hover:text-teal-300 transition-colors"
          onClick={onStartCreate}
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
              onClick={() => onSelectGroup(g.id)}
            >
              <span className="font-medium">{g.name}</span>
              <span className="text-xs text-slate-500">{g.members.length}명</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
