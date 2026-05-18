import { Edit3, Trash2 } from 'lucide-react';

import type { StoryInfoResponse } from '@/features/editor/storyInfoApi';
import { RichContentViewer } from '@/features/editor/components/content/RichContentViewer';
import { editorDesignClassNames } from '@/features/editor/design-system/editorDesignTokens';

export function InfoBodyPreview({
  themeId,
  info,
  error,
  deletePending,
  onEdit,
  onDelete,
}: {
  themeId: string;
  info: StoryInfoResponse;
  error: string | null;
  deletePending: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <section className="min-h-full">
      <div className={`space-y-4 p-4 ${editorDesignClassNames.panel}`}>
        {error && (
          <div className={`px-3 py-2 text-xs ${editorDesignClassNames.errorPanel}`}>
            {error}
          </div>
        )}

        <div className="flex flex-col gap-3 border-b border-[var(--mmp-editor-color-hairline)] pb-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <p className="text-xs text-[var(--mmp-editor-color-slate)]">정보</p>
            <h3 className="mt-1 break-words text-lg font-semibold text-[var(--mmp-editor-color-charcoal)]">{info.title}</h3>
          </div>
          <button
            type="button"
            onClick={onEdit}
            className={`inline-flex items-center justify-center gap-1.5 px-3 py-2 ${editorDesignClassNames.secondaryAction}`}
          >
            <Edit3 className="h-4 w-4" />
            정보 수정
          </button>
        </div>

        <div role="region" aria-label="정보 본문 보기">
          <RichContentViewer themeId={themeId} markdown={info.body} />
        </div>

        <div className="flex items-center justify-between border-t border-[var(--mmp-editor-color-hairline)] pt-3">
          <button
            type="button"
            onClick={onDelete}
            disabled={deletePending}
            className={`flex items-center gap-1 px-2 py-1 text-xs ${editorDesignClassNames.dangerAction}`}
          >
            <Trash2 className="h-3 w-3" />
            정보 삭제
          </button>
        </div>
      </div>
    </section>
  );
}
