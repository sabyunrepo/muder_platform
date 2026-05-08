import { Music } from 'lucide-react';

import { MediaControl } from './MediaControl';
import type { BlockFieldProps } from './readingBlockFieldProps';

export function BgmBlockFields({ line, mediaById, themeId, onPatch }: BlockFieldProps) {
  return (
    <div className="grid gap-2">
      <MediaControl
        themeId={themeId}
        label="효과음"
        emptyLabel="효과음 선택"
        removeLabel="효과음 제거"
        pickerTitle="효과음 선택"
        filterType="SFX"
        selectedId={line.MediaID}
        selectedMedia={mediaById.get(line.MediaID ?? '') ?? null}
        icon={Music}
        selectedClassName="text-emerald-300"
        onSelect={(media) => onPatch({ MediaID: media.id, BGMMode: 'once' })}
        onClear={() => onPatch({ MediaID: '', BGMMode: 'once' })}
      />
    </div>
  );
}
