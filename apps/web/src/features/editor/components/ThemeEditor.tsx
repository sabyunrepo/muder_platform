import { useCallback } from "react";
import { Spinner } from "@/shared/components/ui";
import { useEditorTheme } from "@/features/editor/api";
import { useEditorClues } from "@/features/editor/editorClueApi";
import { validateGameDesign, validateClueGraph } from "@/features/editor/validation";
import { useClueEdges } from "@/features/editor/clueEdgeApi";
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

function FullPageError({ message, detail }: { message: string; detail?: string }) {
  return (
    <div className="flex h-screen items-center justify-center bg-slate-950 px-6 text-center">
      <div className="max-w-md space-y-2">
        <p className="text-sm font-medium text-red-300">{message}</p>
        {detail && <p className="text-sm leading-6 text-slate-400">{detail}</p>}
      </div>
    </div>
  );
}

const uuidLikeRe =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function buildThemeLoadError(themeId: string) {
  if (uuidLikeRe.test(themeId)) {
    return {
      message: "테마를 찾을 수 없습니다",
      detail: "삭제됐거나 현재 계정에 편집 권한이 없는 테마일 수 있습니다.",
    };
  }
  return {
    message: "샘플 또는 slug 테마를 찾을 수 없습니다",
    detail:
      "이 주소는 UUID가 아닌 slug로 열린 주소입니다. 로컬 샘플이라면 e2e-test-theme seed가 적용됐는지 확인하세요.",
  };
}

// ---------------------------------------------------------------------------
// ThemeEditor
// ---------------------------------------------------------------------------

interface ThemeEditorProps {
  themeId: string;
  routeSegment?: string;
}

export function ThemeEditor({ themeId, routeSegment }: ThemeEditorProps) {
  const { data: theme, isLoading, isError } = useEditorTheme(themeId);
  const resolvedThemeId = theme?.id ?? "";
  const { data: clues } = useEditorClues(resolvedThemeId);
  const { data: clueEdgeGroups } = useClueEdges(resolvedThemeId);

  const handleValidate = useCallback(() => {
    if (!theme) return [];
    const cfg = (theme.config_json ?? {}) as Record<string, unknown>;
    const clueCount = clues?.length ?? 0;
    // Character count from config_json.characters array
    const chars = cfg.characters;
    const charCount = Array.isArray(chars) ? chars.length : 0;
    const gameWarnings = validateGameDesign(cfg, clueCount, charCount);
    // Phase 20 PR-6: flatten edge groups (N sources × 1 target) into the
    // legacy (sourceId, targetId, mode) shape validateClueGraph still accepts.
    const flatRelations = (clueEdgeGroups ?? []).flatMap((g) =>
      g.sources.map((src) => ({
        sourceId: src,
        targetId: g.targetId,
        mode: g.mode,
      })),
    );
    const graphWarnings = validateClueGraph(
      flatRelations,
      (clues ?? []).map((c) => ({ id: c.id, name: c.name })),
    );
    return [...gameWarnings, ...graphWarnings];
  }, [theme, clues, clueEdgeGroups]);

  if (isLoading) return <FullPageSpinner />;
  if (isError || !theme) {
    const errorCopy = buildThemeLoadError(themeId);
    return <FullPageError message={errorCopy.message} detail={errorCopy.detail} />;
  }

  return (
    <EditorLayout
      theme={theme}
      themeId={resolvedThemeId}
      routeSegment={routeSegment}
      onValidate={handleValidate}
    />
  );
}
