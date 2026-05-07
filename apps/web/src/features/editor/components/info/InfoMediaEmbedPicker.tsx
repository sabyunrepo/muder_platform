import { Image, Video, X } from 'lucide-react';

import type { MediaResponse, MediaType } from '@/features/editor/mediaApi';
import { MediaPicker } from '../media/MediaPicker';

export function InfoMediaEmbedPicker({
  themeId,
  pickerType,
  onOpen,
  onClose,
  onSelect,
}: {
  themeId: string;
  pickerType: MediaType | null;
  onOpen: (type: MediaType) => void;
  onClose: () => void;
  onSelect: (media: MediaResponse) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={() => onOpen('IMAGE')}
        className="inline-flex items-center gap-1.5 rounded border border-slate-700 px-2.5 py-1.5 text-xs text-slate-200 hover:border-amber-400 hover:text-amber-200"
      >
        <Image className="h-3.5 w-3.5" />
        이미지 삽입
      </button>
      <button
        type="button"
        onClick={() => onOpen('VIDEO')}
        className="inline-flex items-center gap-1.5 rounded border border-slate-700 px-2.5 py-1.5 text-xs text-slate-200 hover:border-amber-400 hover:text-amber-200"
      >
        <Video className="h-3.5 w-3.5" />
        영상 삽입
      </button>
      {pickerType && (
        <button
          type="button"
          onClick={onClose}
          className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-200"
        >
          <X className="h-3.5 w-3.5" />
          선택 닫기
        </button>
      )}
      <MediaPicker
        open={pickerType !== null}
        onClose={onClose}
        onSelect={onSelect}
        themeId={themeId}
        filterType={pickerType ?? undefined}
        title={pickerType === 'VIDEO' ? '정보 영상 선택' : '정보 이미지 선택'}
      />
    </div>
  );
}
