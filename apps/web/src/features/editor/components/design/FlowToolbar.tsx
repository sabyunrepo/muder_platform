import { useState, useRef, useEffect } from "react";
import { Plus, Save, ChevronDown } from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface FlowToolbarProps {
  onAddNode: (type: string) => void;
  onSave: () => void;
  isSaving: boolean;
}

interface NodeOption {
  type: string;
  label: string;
  description: string;
}

const NODE_OPTIONS: NodeOption[] = [
  { type: "phase", label: "페이즈", description: "게임 단계" },
  { type: "branch", label: "분기", description: "조건 분기" },
  { type: "ending", label: "엔딩", description: "게임 종료" },
];

// ---------------------------------------------------------------------------
// FlowToolbar
// ---------------------------------------------------------------------------

export function FlowToolbar({ onAddNode, onSave, isSaving }: FlowToolbarProps) {
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const handleSelect = (type: string) => {
    onAddNode(type);
    setOpen(false);
  };

  return (
    <div className="flex shrink-0 items-center gap-2 border-b border-slate-800 bg-slate-900 px-4 py-2">
      {/* Add node dropdown */}
      <div className="relative" ref={dropdownRef}>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex items-center gap-1.5 rounded border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs text-slate-300 transition-colors hover:border-amber-500 hover:text-amber-400"
        >
          <Plus className="h-3.5 w-3.5" />
          노드 추가
          <ChevronDown className="h-3 w-3" />
        </button>

        {open && (
          <div className="absolute left-0 top-full z-50 mt-1 w-40 rounded border border-slate-700 bg-slate-800 py-1 shadow-lg">
            {NODE_OPTIONS.map((opt) => (
              <button
                key={opt.type}
                type="button"
                onClick={() => handleSelect(opt.type)}
                className="flex w-full flex-col px-3 py-2 text-left transition-colors hover:bg-slate-700"
              >
                <span className="text-xs font-medium text-slate-200">
                  {opt.label}
                </span>
                <span className="text-[10px] text-slate-500">
                  {opt.description}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="flex-1" />

      {/* Save button */}
      <button
        type="button"
        onClick={onSave}
        disabled={isSaving}
        className="flex items-center gap-1.5 rounded border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs text-slate-300 transition-colors hover:border-amber-500 hover:text-amber-400 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <Save className="h-3.5 w-3.5" />
        {isSaving ? "저장 중..." : "저장"}
      </button>
    </div>
  );
}
