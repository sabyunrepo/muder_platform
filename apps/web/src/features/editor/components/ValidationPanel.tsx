import { AlertTriangle, XCircle, X } from "lucide-react";
import type { DesignWarning } from "../validation";
import type { EditorTab } from "../constants";
import { useEditorUI } from "../stores/editorUIStore";

// ---------------------------------------------------------------------------
// Category → Tab mapping
// ---------------------------------------------------------------------------

const ERROR_TAB_MAP: Record<string, EditorTab> = {
  phases: "design",
  modules: "design",
  clues: "clues",
  characters: "characters",
};

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ValidationPanelProps {
  warnings: DesignWarning[];
  onClose: () => void;
}

// ---------------------------------------------------------------------------
// ValidationPanel — 검증 결과 + 에러 클릭 → 탭 이동
// ---------------------------------------------------------------------------

export function ValidationPanel({ warnings, onClose }: ValidationPanelProps) {
  const { setActiveTab } = useEditorUI();

  const errors = warnings.filter((w) => w.type === "error");
  const warns = warnings.filter((w) => w.type === "warning");

  const handleClick = (warning: DesignWarning) => {
    const tab = ERROR_TAB_MAP[warning.category];
    if (tab) {
      setActiveTab(tab);
      onClose();
    }
  };

  if (warnings.length === 0) {
    return (
      <div className="flex items-center justify-between rounded border border-emerald-800 bg-emerald-950/30 px-4 py-3">
        <span className="text-xs text-emerald-400">
          검증 통과 — 문제가 없습니다
        </span>
        <button type="button" onClick={onClose} aria-label="닫기" className="text-slate-500 hover:text-slate-300">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }

  return (
    <div className="rounded border border-slate-700 bg-slate-900">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-800 px-4 py-2">
        <span className="text-xs font-medium text-slate-300">
          검증 결과: {errors.length > 0 && `${errors.length}개 오류`}
          {errors.length > 0 && warns.length > 0 && ", "}
          {warns.length > 0 && `${warns.length}개 경고`}
        </span>
        <button type="button" onClick={onClose} aria-label="닫기" className="text-slate-500 hover:text-slate-300">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Items */}
      <ul className="max-h-48 overflow-y-auto py-1">
        {warnings.map((w, i) => (
          <li key={`${w.type}-${w.category}-${i}`}>
            <button
              type="button"
              onClick={() => handleClick(w)}
              className="flex w-full items-start gap-2 px-4 py-2 text-left transition-colors hover:bg-slate-800"
            >
              {w.type === "error" ? (
                <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-400" />
              ) : (
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-400" />
              )}
              <div className="flex flex-col">
                <span className="text-xs text-slate-300">{w.message}</span>
                <span className="text-[10px] text-slate-600">
                  클릭하여 {ERROR_TAB_MAP[w.category] ?? w.category} 탭으로 이동
                </span>
              </div>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
