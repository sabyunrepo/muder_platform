import { useState, useRef, useEffect } from "react";
import { Plus, Save, ChevronDown, LayoutTemplate, Play } from "lucide-react";
import { ConfirmDialog } from "@/shared/components/ui";
import { FLOW_PRESETS, createPresetFlow } from "../../hooks/flowPresets";
import type { Node, Edge } from "@xyflow/react";
import { editorDesignClassNames } from "@/features/editor/design-system/editorDesignTokens";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface FlowToolbarProps {
  onAddScene: () => void;
  onSave: () => void;
  isSaving: boolean;
  onApplyPreset?: (nodes: Node[], edges: Edge[]) => void;
  hasNodes?: boolean;
  onToggleOrderReview?: () => void;
  isOrderReviewing?: boolean;
}

// ---------------------------------------------------------------------------
// FlowToolbar
// ---------------------------------------------------------------------------

export function FlowToolbar({
  onAddScene,
  onSave,
  isSaving,
  onApplyPreset,
  hasNodes,
  onToggleOrderReview,
  isOrderReviewing,
}: FlowToolbarProps) {
  const [presetOpen, setPresetOpen] = useState(false);
  const [pendingPresetId, setPendingPresetId] = useState<string | null>(null);
  const presetRef = useRef<HTMLDivElement>(null);
  const pendingPreset = FLOW_PRESETS.find((preset) => preset.id === pendingPresetId) ?? null;

  function applyPresetFromTemplate(preset: (typeof FLOW_PRESETS)[number]) {
    const flow = createPresetFlow(preset);
    onApplyPreset?.(flow.nodes, flow.edges);
    setPresetOpen(false);
  }

  // Close dropdowns on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (presetRef.current && !presetRef.current.contains(e.target as globalThis.Node)) {
        setPresetOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <div className={`flex shrink-0 items-center gap-2 px-4 py-2 ${editorDesignClassNames.topBar}`}>
      <button
        type="button"
        onClick={onAddScene}
        className={`flex items-center gap-1.5 px-3 py-1.5 text-xs ${editorDesignClassNames.secondaryAction}`}
      >
        <Plus className="h-3.5 w-3.5" />
        장면 추가
      </button>

      {/* Preset dropdown */}
      {onApplyPreset && (
        <div className="relative" ref={presetRef}>
          <button
            type="button"
            onClick={() => setPresetOpen((v) => !v)}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs ${editorDesignClassNames.secondaryAction}`}
          >
            <LayoutTemplate className="h-3.5 w-3.5" />
            프리셋
            <ChevronDown className="h-3 w-3" />
          </button>

          {presetOpen && (
            <div className={`absolute left-0 top-full z-50 mt-1 w-52 py-1 ${editorDesignClassNames.panel}`}>
              {FLOW_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => {
                    if (hasNodes) {
                      setPendingPresetId(preset.id);
                      setPresetOpen(false);
                      return;
                    }
                    applyPresetFromTemplate(preset);
                  }}
                  className="flex w-full flex-col px-3 py-2 text-left transition-colors hover:bg-[var(--mmp-editor-color-surface)]"
                >
                  <span className="text-xs font-medium text-[var(--mmp-editor-color-charcoal)]">
                    {preset.label}
                  </span>
                  <span className="text-[10px] text-[var(--mmp-editor-color-slate)]">
                    {preset.description}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Order review toggle */}
      {onToggleOrderReview && (
        <button
          type="button"
          onClick={onToggleOrderReview}
          className={`flex items-center gap-1.5 px-3 py-1.5 text-xs transition-colors ${
            isOrderReviewing
              ? editorDesignClassNames.listItemActive
              : editorDesignClassNames.secondaryAction
          }`}
        >
          <Play className="h-3.5 w-3.5" />
          순서 점검
        </button>
      )}

      <div className="flex-1" />

      {/* Save button */}
      <button
        type="button"
        onClick={onSave}
        disabled={isSaving}
        className={`flex items-center gap-1.5 px-3 py-1.5 text-xs disabled:cursor-not-allowed disabled:opacity-50 ${editorDesignClassNames.secondaryAction}`}
      >
        <Save className="h-3.5 w-3.5" />
        {isSaving ? "저장 중..." : "저장"}
      </button>
      <ConfirmDialog
        isOpen={pendingPreset != null}
        title="기존 흐름을 대체할까요?"
        description="현재 장면 흐름이 프리셋으로 바뀝니다."
        confirmLabel="프리셋 적용"
        tone="warning"
        onCancel={() => setPendingPresetId(null)}
        onConfirm={() => {
          if (!pendingPreset) return;
          applyPresetFromTemplate(pendingPreset);
          setPendingPresetId(null);
        }}
      />
    </div>
  );
}
