import { useCallback } from "react";
import { Spinner } from "@/shared/components/ui";
import { useEditorTheme } from "@/features/editor/api";
import { useEditorClues } from "@/features/editor/editorClueApi";
import { validateGameDesign } from "@/features/editor/validation";
import { EditorLayout } from "./EditorLayout";

// ---------------------------------------------------------------------------
// FullPage helpers
// ---------------------------------------------------------------------------

function FullPageSpinner() {
  return (
    <div className="flex h-screen items-center justify-center bg-slate-950">
      <Spinner size="lg" />
    </div>
  );
}

function FullPageError({ message }: { message: string }) {
  return (
    <div className="flex h-screen items-center justify-center bg-slate-950">
      <p className="text-sm text-red-400">{message}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ThemeEditor
// ---------------------------------------------------------------------------

interface ThemeEditorProps {
  themeId: string;
}

export function ThemeEditor({ themeId }: ThemeEditorProps) {
  const { data: theme, isLoading, isError } = useEditorTheme(themeId);
  const { data: clues } = useEditorClues(themeId);

  const handleValidate = useCallback(() => {
    if (!theme) return [];
    const cfg = (theme.config_json ?? {}) as Record<string, unknown>;
    const clueCount = clues?.length ?? 0;
    // Character count from config_json.characters array
    const chars = cfg.characters;
    const charCount = Array.isArray(chars) ? chars.length : 0;
    return validateGameDesign(cfg, clueCount, charCount);
  }, [theme, clues]);

  if (isLoading) return <FullPageSpinner />;
  if (isError || !theme) return <FullPageError message="테마를 찾을 수 없습니다" />;

  return <EditorLayout theme={theme} themeId={themeId} onValidate={handleValidate} />;
}
