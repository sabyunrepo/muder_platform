import { useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { Spinner } from "@/shared/components/ui";
import { useEditorTheme } from "@/features/editor/api";
import { useEditorClues } from "@/features/editor/editorClueApi";
import { validateGameDesign, validateClueGraph } from "@/features/editor/validation";
import { api } from "@/services/api";
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

interface ClueRelation {
  id: string;
  sourceId: string;
  targetId: string;
  mode: string;
}

export function ThemeEditor({ themeId }: ThemeEditorProps) {
  const { data: theme, isLoading, isError } = useEditorTheme(themeId);
  const { data: clues } = useEditorClues(themeId);
  const { data: clueRelations } = useQuery<ClueRelation[]>({
    queryKey: ["clue-relations", themeId],
    queryFn: () => api.get<ClueRelation[]>(`/v1/editor/themes/${themeId}/clue-relations`),
    enabled: !!themeId,
  });

  const handleValidate = useCallback(() => {
    if (!theme) return [];
    const cfg = (theme.config_json ?? {}) as Record<string, unknown>;
    const clueCount = clues?.length ?? 0;
    // Character count from config_json.characters array
    const chars = cfg.characters;
    const charCount = Array.isArray(chars) ? chars.length : 0;
    const gameWarnings = validateGameDesign(cfg, clueCount, charCount);
    const graphWarnings = validateClueGraph(
      clueRelations ?? [],
      (clues ?? []).map((c) => ({ id: c.id, name: c.name })),
    );
    return [...gameWarnings, ...graphWarnings];
  }, [theme, clues, clueRelations]);

  if (isLoading) return <FullPageSpinner />;
  if (isError || !theme) return <FullPageError message="테마를 찾을 수 없습니다" />;

  return <EditorLayout theme={theme} themeId={themeId} onValidate={handleValidate} />;
}
