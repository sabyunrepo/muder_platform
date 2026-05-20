import { AlertTriangle, XCircle, X } from "lucide-react";
import type { DesignWarning } from "../validation";
import type { EditorTab } from "../constants";
import { useEditorUI } from "../stores/editorUIStore";
import { editorDesignClassNames } from "@/features/editor/design-system/editorDesignTokens";

// ---------------------------------------------------------------------------
// Category → Tab mapping
// ---------------------------------------------------------------------------

const ERROR_TAB_MAP: Record<string, EditorTab> = {
  phases: "storyMap",
  modules: "design",
  clues: "clues",
  characters: "characters",
  clue_graph: "clues",
};

const ERROR_TAB_LABEL_MAP: Record<string, string> = {
  phases: "스토리 진행",
  modules: "게임 설계",
  clues: "단서 관리",
  characters: "등장인물 관리",
  clue_graph: "단서 관리",
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
      <div className="flex items-center justify-between rounded border border-[var(--mmp-editor-color-success)] bg-[var(--mmp-editor-color-tint-mint)] px-4 py-3">
        <span className="text-xs text-[var(--mmp-editor-color-success)]">
          검증 통과 — 문제가 없습니다
        </span>
        <button type="button" onClick={onClose} aria-label="닫기" className="text-[var(--mmp-editor-color-slate)] hover:text-[var(--mmp-editor-color-charcoal)]">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }

  return (
    <div className={editorDesignClassNames.panel}>
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[var(--mmp-editor-color-hairline)] px-4 py-2">
        <span className="text-xs font-medium text-[var(--mmp-editor-color-charcoal)]">
          검증 결과: {errors.length > 0 && `${errors.length}개 오류`}
          {errors.length > 0 && warns.length > 0 && ", "}
          {warns.length > 0 && `${warns.length}개 경고`}
        </span>
        <button type="button" onClick={onClose} aria-label="닫기" className="text-[var(--mmp-editor-color-slate)] hover:text-[var(--mmp-editor-color-charcoal)]">
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
              className="flex w-full items-start gap-2 px-4 py-2 text-left transition-colors hover:bg-[var(--mmp-editor-color-surface)]"
            >
              {w.type === "error" ? (
                <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--mmp-editor-color-error)]" />
              ) : (
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--mmp-editor-color-warning)]" />
              )}
              <div className="flex flex-col">
                <span className="text-xs text-[var(--mmp-editor-color-charcoal)]">{w.message}</span>
                <span className="text-[10px] text-[var(--mmp-editor-color-steel)]">
                  클릭하여 {ERROR_TAB_LABEL_MAP[w.category] ?? w.category} 탭으로 이동
                </span>
              </div>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
