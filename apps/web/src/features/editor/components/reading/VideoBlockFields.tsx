import { Video } from 'lucide-react';

import { MediaControl } from './MediaControl';
import type { BlockFieldProps } from './readingBlockFieldProps';

export function VideoBlockFields({ line, mediaById, themeId, onPatch }: BlockFieldProps) {
  return (
    <>
      <MediaControl
        themeId={themeId}
        label="영상"
        emptyLabel="영상 선택"
        removeLabel="영상 제거"
        pickerTitle="영상 선택"
        filterType="VIDEO"
        selectedId={line.MediaID}
        selectedMedia={mediaById.get(line.MediaID ?? '') ?? null}
        icon={Video}
        selectedClassName="text-violet-300"
        onSelect={(media) => onPatch({ MediaID: media.id })}
        onClear={() => onPatch({ MediaID: '' })}
      />
      <div className="flex flex-wrap gap-3 text-xs text-slate-300">
        <label className="inline-flex items-center gap-2">
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-slate-600 bg-slate-900"
            checked={line.Autoplay ?? true}
            onChange={(event) => onPatch({ Autoplay: event.target.checked })}
          />
          자동재생
        </label>
        <label className="inline-flex items-center gap-2">
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-slate-600 bg-slate-900"
            checked={line.WaitUntilEnd ?? true}
            onChange={(event) => onPatch({ WaitUntilEnd: event.target.checked })}
          />
          종료 후 다음 진행
        </label>
      </div>
    </>
  );
}
