import { Suspense, useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router";
import { ArrowLeft, ChevronRight } from "lucide-react";
import { Spinner } from "@/shared/components/ui";
import type { EditorThemeResponse } from "@/features/editor/api";
import { useEditorUI } from "@/features/editor/stores/editorUIStore";
import { SaveIndicator } from "./SaveIndicator";
import { EditorTabNav } from "./EditorTabNav";
import { TabContent } from "./TabContent";
import { ValidationPanel } from "./ValidationPanel";
import type { DesignWarning } from "@/features/editor/validation";
import type { SaveStatus } from "@/features/editor/hooks/useAutoSave";

// ---------------------------------------------------------------------------
// EditorLayout
// ---------------------------------------------------------------------------

interface EditorLayoutProps {
  theme: EditorThemeResponse;
  themeId: string;
  saveStatus?: SaveStatus;
  lastSaved?: Date | null;
  onSave?: () => void;
  onRetry?: () => void;
  onPublish?: () => void;
  onValidate?: () => DesignWarning[];
  validationWarnings?: DesignWarning[];
}

export function EditorLayout({
  theme,
  themeId,
  saveStatus = "idle",
  lastSaved,
  onSave,
  onRetry,
  onPublish,
  onValidate,
  validationWarnings: externalWarnings,
}: EditorLayoutProps) {
  const navigate = useNavigate();
  const { activeTab } = useEditorUI();
  const [validationResult, setValidationResult] = useState<DesignWarning[] | null>(null);

  const activeModules = useMemo(() => {
    const cfg = theme.config_json as Record<string, unknown> | undefined;
    const mods = cfg?.modules;
    return Array.isArray(mods) ? (mods as string[]) : [];
  }, [theme.config_json]);

  const handleValidate = () => {
    if (onValidate) {
      const result = onValidate();
      setValidationResult(result);
    }
  };

  // Save on Ctrl+S / Cmd+S
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        onSave?.();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onSave]);

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-slate-950 text-slate-100">
      {/* ── Top bar ── */}
      <header className="sticky top-0 z-50 flex h-12 shrink-0 items-center gap-3 border-b border-slate-800 bg-slate-900 px-3">
        <button
          type="button"
          onClick={() => navigate("/editor")}
          className="rounded-sm p-1.5 text-slate-500 transition-colors hover:bg-slate-800 hover:text-slate-200"
          aria-label="에디터 목록으로 돌아가기"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>

        <div className="h-5 w-px bg-slate-800" />

        <div className="flex min-w-0 flex-1 items-center gap-2">
          <span className="shrink-0 text-xs text-slate-600">에디터</span>
          <ChevronRight className="h-3.5 w-3.5 shrink-0 text-slate-700" />
          <span className="truncate text-sm font-mono font-medium text-slate-200">
            {theme.title}
          </span>
          <span className="shrink-0 rounded-sm bg-slate-800 px-1.5 py-0.5 text-[10px] font-mono text-slate-500">
            {theme.status}
          </span>
        </div>

        <SaveIndicator
          status={saveStatus}
          lastSaved={lastSaved}
          onRetry={onRetry}
        />

        <div className="h-5 w-px bg-slate-800" />

        <button
          type="button"
          onClick={handleValidate}
          className="h-7 rounded-sm border border-slate-700 px-3 text-xs font-medium text-slate-300 transition-colors hover:border-slate-500"
        >
          검증
        </button>
        <button
          type="button"
          onClick={onPublish}
          disabled={theme.status === "PUBLISHED"}
          className="h-7 rounded-sm bg-amber-600 px-3 text-xs font-medium text-white transition-colors hover:bg-amber-500 disabled:cursor-not-allowed disabled:opacity-40"
        >
          출판
        </button>
      </header>

      {/* ── Tab nav ── */}
      <EditorTabNav activeModules={activeModules} />

      {/* ── Validation panel ── */}
      {(validationResult ?? externalWarnings) && (
        <div className="shrink-0 border-b border-slate-800 px-3 py-2">
          <ValidationPanel
            warnings={validationResult ?? externalWarnings ?? []}
            onClose={() => setValidationResult(null)}
          />
        </div>
      )}

      {/* ── Content ── */}
      <div
        role="tabpanel"
        id={`tabpanel-${activeTab}`}
        aria-labelledby={`tab-${activeTab}`}
        className="flex-1 overflow-y-auto"
      >
        <Suspense
          fallback={
            <div className="flex items-center justify-center py-12">
              <Spinner />
            </div>
          }
        >
          <TabContent tab={activeTab} theme={theme} themeId={themeId} />
        </Suspense>
      </div>
    </div>
  );
}
