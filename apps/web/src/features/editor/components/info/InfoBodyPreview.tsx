import { Edit3, Trash2 } from 'lucide-react';

import type { StoryInfoResponse } from '@/features/editor/storyInfoApi';
import { RichContentViewer } from '@/features/editor/components/content/RichContentViewer';

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
      <div className="space-y-4 rounded border border-slate-800 bg-slate-950 p-4">
        {error && (
          <div className="rounded border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
            {error}
          </div>
        )}

        <div className="flex flex-col gap-3 border-b border-slate-800 pb-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <p className="text-xs text-slate-500">정보</p>
            <h3 className="mt-1 break-words text-lg font-semibold text-slate-100">{info.title}</h3>
          </div>
          <button
            type="button"
            onClick={onEdit}
            className="inline-flex items-center justify-center gap-1.5 rounded border border-slate-700 px-3 py-2 text-sm text-slate-200 hover:border-amber-400 hover:text-amber-200"
          >
            <Edit3 className="h-4 w-4" />
            정보 수정
          </button>
        </div>

        <div role="region" aria-label="정보 본문 보기">
          <RichContentViewer themeId={themeId} markdown={info.body} />
        </div>

        <div className="flex items-center justify-between border-t border-slate-800 pt-3">
          <button
            type="button"
            onClick={onDelete}
            disabled={deletePending}
            className="flex items-center gap-1 rounded px-2 py-1 text-xs text-rose-400 hover:bg-rose-500/10"
          >
            <Trash2 className="h-3 w-3" />
            정보 삭제
          </button>
        </div>
      </div>
    </section>
  );
}
