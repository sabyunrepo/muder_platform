import { Music, X } from 'lucide-react';

import type { MediaResponse } from '../../mediaApi';
import type { ReadingSectionDraft } from './readingSectionEditorModel';

export function ReadingSectionBgmPanel({
  draft,
  selectedBgm,
  onOpenPicker,
  onClear,
  onModeChange,
}: {
  draft: ReadingSectionDraft;
  selectedBgm: MediaResponse | null;
  onOpenPicker: () => void;
  onClear: () => void;
  onModeChange: (mode: ReadingSectionDraft['bgmMode']) => void;
}) {
  return (
    <div className="flex flex-col gap-2 rounded border border-slate-800 bg-slate-900/60 px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <label className="text-xs font-medium text-slate-300">섹션 배경음악</label>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          {draft.bgmMediaId ? (
            <span className="inline-flex items-center gap-1 text-xs text-amber-300">
              <Music className="h-3 w-3" />
              {selectedBgm?.name ?? '(선택됨)'}
              <button
                type="button"
                onClick={onClear}
                aria-label="배경음악 제거"
                className="ml-1 text-amber-300 hover:text-amber-200"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ) : (
            <span className="text-xs text-slate-500">선택하면 이 섹션이 시작될 때 재생됩니다.</span>
          )}
          <button
            type="button"
            onClick={onOpenPicker}
            className="text-xs text-slate-400 underline hover:text-slate-200"
          >
            {draft.bgmMediaId ? '변경' : '배경음악 선택'}
          </button>
        </div>
      </div>
      <div className="inline-flex rounded border border-slate-700 bg-slate-950 p-0.5 sm:shrink-0">
        {(['loop', 'once'] as const).map((mode) => (
          <button
            key={mode}
            type="button"
            onClick={() => onModeChange(mode)}
            aria-pressed={draft.bgmMode === mode}
            className={`rounded px-3 py-1.5 text-xs ${
              draft.bgmMode === mode
                ? 'bg-amber-500 text-slate-950'
                : 'text-slate-300 hover:bg-slate-800'
            }`}
          >
            {mode === 'loop' ? '반복' : '1회'}
          </button>
        ))}
      </div>
    </div>
  );
}
