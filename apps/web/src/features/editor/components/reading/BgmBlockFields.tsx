import { Music } from 'lucide-react';

import type { ReadingLineDTO } from '../../readingApi';
import { MediaControl } from './MediaControl';
import { SelectField } from './SelectField';
import type { BlockFieldProps } from './readingBlockFieldProps';

export function BgmBlockFields({ line, mediaById, themeId, onPatch }: BlockFieldProps) {
  return (
    <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_12rem]">
      <MediaControl
        themeId={themeId}
        label="BGM"
        emptyLabel="BGM 선택"
        removeLabel="BGM 제거"
        pickerTitle="BGM 선택"
        filterType="BGM"
        selectedId={line.MediaID}
        selectedMedia={mediaById.get(line.MediaID ?? '') ?? null}
        icon={Music}
        selectedClassName="text-emerald-300"
        onSelect={(media) => onPatch({ MediaID: media.id, BGMMode: line.BGMMode ?? 'loop' })}
        onClear={() => onPatch({ MediaID: '' })}
      />
      <SelectField
        label="동작"
        value={line.BGMMode ?? 'loop'}
        onChange={(value) => onPatch({ BGMMode: value as ReadingLineDTO['BGMMode'] })}
        options={[
          ['loop', '반복'],
          ['once', '1회'],
          ['stop', '정지'],
        ]}
      />
    </div>
  );
}
