import { useState } from "react";
import { ChevronRight, Plus } from "lucide-react";

import { useEditorCharacters } from "../../api";
import {
  useCreateReadingSection,
  useReadingSections,
} from "../../readingApi";
import { ReadingSectionEditor } from "./ReadingSectionEditor";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ReadingSectionListProps {
  themeId: string;
}

// ---------------------------------------------------------------------------
// ReadingSectionList
// ---------------------------------------------------------------------------

export function ReadingSectionList({ themeId }: ReadingSectionListProps) {
  const { data: sections = [], isLoading } = useReadingSections(themeId);
  const { data: characters = [] } = useEditorCharacters(themeId);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);

  const createMutation = useCreateReadingSection(themeId);

  // Reduce characters to the minimal {id,name} shape used by editor children.
  const characterOptions = characters.map((c) => ({ id: c.id, name: c.name }));

  async function handleAdd() {
    setCreateError(null);
    const maxSort =
      sections.length > 0 ? Math.max(...sections.map((s) => s.sortOrder)) : -1;
    try {
      const created = await createMutation.mutateAsync({
        name: "새 리딩 섹션",
        lines: [],
        sortOrder: maxSort + 1,
      });
      setExpandedId(created.id);
    } catch (err) {
      setCreateError(
        err instanceof Error ? err.message : "섹션 추가에 실패했습니다",
      );
    }
  }

  if (isLoading) {
    return (
      <div className="py-6 text-center text-xs text-slate-500">
        불러오는 중...
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-slate-200">리딩 섹션</h3>
        <button
          type="button"
          onClick={handleAdd}
          disabled={createMutation.isPending}
          className="flex items-center gap-1 rounded bg-amber-500 px-3 py-1 text-xs font-medium text-slate-900 hover:bg-amber-400 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-500"
        >
          <Plus className="h-3 w-3" />
          섹션 추가
        </button>
      </div>

      {createError && (
        <div className="rounded border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
          {createError}
        </div>
      )}

      {sections.length === 0 ? (
        <p className="py-8 text-center text-sm text-slate-500">
          리딩 섹션이 없습니다. "섹션 추가" 버튼으로 시작하세요.
        </p>
      ) : (
        sections.map((section) => {
          const expanded = expandedId === section.id;
          return (
            <div
              key={section.id}
              className="overflow-hidden rounded border border-slate-700 bg-slate-800"
            >
              <button
                type="button"
                onClick={() => setExpandedId(expanded ? null : section.id)}
                aria-expanded={expanded}
                className="flex w-full items-center justify-between p-3 text-left transition-colors hover:bg-slate-700/50"
              >
                <div className="flex items-center gap-2">
                  <ChevronRight
                    className={`h-4 w-4 text-slate-400 transition-transform ${
                      expanded ? "rotate-90" : ""
                    }`}
                  />
                  <span className="text-sm font-medium text-slate-200">
                    {section.name}
                  </span>
                  <span className="text-xs text-slate-500">
                    {section.lines.length}줄
                  </span>
                </div>
              </button>
              {expanded && (
                <div className="border-t border-slate-700 p-3">
                  <ReadingSectionEditor
                    themeId={themeId}
                    section={section}
                    characters={characterOptions}
                    onDeleted={() => setExpandedId(null)}
                  />
                </div>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}
