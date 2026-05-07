import { useState } from 'react';
import { X, type LucideIcon } from 'lucide-react';

import type { MediaResponse, MediaType } from '../../mediaApi';
import { MediaPicker } from '../media/MediaPicker';

interface MediaControlProps {
  themeId: string;
  label: string;
  emptyLabel: string;
  removeLabel: string;
  pickerTitle: string;
  filterType: MediaType;
  selectedId?: string;
  selectedMedia?: MediaResponse | null;
  icon: LucideIcon;
  selectedClassName: string;
  onSelect: (media: MediaResponse) => void;
  onClear: () => void;
}

export function MediaControl({
  themeId,
  label,
  emptyLabel,
  removeLabel,
  pickerTitle,
  filterType,
  selectedId,
  selectedMedia,
  icon: Icon,
  selectedClassName,
  onSelect,
  onClear,
}: MediaControlProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="min-w-0">
      <p className="mb-1 text-xs text-slate-500">{label}</p>
      {selectedId ? (
        <span
          className={`inline-flex max-w-full items-center gap-1 rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs ${selectedClassName}`}
        >
          <Icon className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">{selectedMedia?.name ?? '선택됨'}</span>
          <button
            type="button"
            onClick={onClear}
            aria-label={removeLabel}
            className="shrink-0 hover:text-slate-50"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </span>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-1 rounded border border-slate-700 px-2 py-1 text-xs text-slate-300 hover:border-slate-500 hover:bg-slate-800"
        >
          <Icon className="h-3.5 w-3.5" />
          {emptyLabel}
        </button>
      )}
      <MediaPicker
        open={open}
        onClose={() => setOpen(false)}
        onSelect={onSelect}
        themeId={themeId}
        filterType={filterType}
        selectedId={selectedId}
        title={pickerTitle}
      />
    </div>
  );
}
