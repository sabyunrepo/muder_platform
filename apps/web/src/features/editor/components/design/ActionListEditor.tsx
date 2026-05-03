import { Plus, Trash2 } from "lucide-react";
import type { PhaseAction } from "../../flowTypes";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ACTION_TYPES = [
  { value: "broadcast", label: "브로드캐스트" },
  { value: "enable_voting", label: "투표 활성화" },
  { value: "disable_voting", label: "투표 비활성화" },
  { value: "enable_chat", label: "채팅 활성화" },
  { value: "disable_chat", label: "채팅 비활성화" },
  { value: "play_bgm", label: "BGM 재생" },
  { value: "stop_bgm", label: "BGM 정지" },
];

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ActionListEditorProps {
  label: string;
  actions: PhaseAction[];
  onChange: (actions: PhaseAction[]) => void;
  hiddenTypes?: string[];
}

// ---------------------------------------------------------------------------
// ActionListEditor — onEnter / onExit 액션 편집 UI
// ---------------------------------------------------------------------------

export function ActionListEditor({
  label,
  actions,
  onChange,
  hiddenTypes = [],
}: ActionListEditorProps) {
  const visibleActions = actions
    .map((action, index) => ({ action, index }))
    .filter(({ action }) => !hiddenTypes.includes(action.type));
  const handleAdd = () => {
    onChange([...actions, { id: crypto.randomUUID(), type: "broadcast" }]);
  };

  const handleRemove = (index: number) => {
    onChange(actions.filter((_, i) => i !== index));
  };

  const handleTypeChange = (index: number, type: string) => {
    const next = actions.map((a, i) =>
      i === index ? { ...a, type } : a,
    );
    onChange(next);
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-medium text-slate-400">{label}</span>
        <button
          type="button"
          onClick={handleAdd}
          className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] text-slate-400 transition-colors hover:bg-slate-800 hover:text-amber-400"
        >
          <Plus className="h-3 w-3" />
          추가
        </button>
      </div>

      {visibleActions.length === 0 && (
        <p className="text-[10px] text-slate-600">액션 없음</p>
      )}

      {visibleActions.map(({ action, index: idx }) => (
        <div
          key={action.id ?? idx}
          className="flex items-center gap-1.5 rounded border border-slate-700 bg-slate-900 px-2 py-1.5"
        >
          <select
            value={action.type}
            onChange={(e) => handleTypeChange(idx, e.target.value)}
            className="flex-1 bg-transparent text-xs text-slate-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/60 focus-visible:ring-inset"
          >
            {ACTION_TYPES.map((at) => (
              <option key={at.value} value={at.value}>
                {at.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => handleRemove(idx)}
            className="text-slate-500 transition-colors hover:text-red-400"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      ))}
    </div>
  );
}
