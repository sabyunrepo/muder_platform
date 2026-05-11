import { Image as ImageIcon } from 'lucide-react';

import type { ReadingLineDTO } from '../../readingApi';
import { MediaControl } from './MediaControl';
import { SelectField } from './SelectField';
import type { BlockFieldProps } from './readingBlockFieldProps';

export function ImageBlockFields({ line, mediaById, themeId, onPatch }: BlockFieldProps) {
  return (
    <>
      <MediaControl
        themeId={themeId}
        label="이미지"
        emptyLabel="이미지 선택"
        removeLabel="이미지 제거"
        pickerTitle="이미지 선택"
        filterType="IMAGE"
        selectedId={line.MediaID}
        selectedMedia={mediaById.get(line.MediaID ?? '') ?? null}
        icon={ImageIcon}
        selectedClassName="text-sky-300"
        onSelect={(media) => onPatch({ MediaID: media.id })}
        onClear={() => onPatch({ MediaID: '' })}
      />
      <div className="grid gap-2 sm:grid-cols-2">
        <SelectField
          label="위치"
          value={line.Position ?? 'center'}
          onChange={(value) => onPatch({ Position: value as ReadingLineDTO['Position'] })}
          options={[
            ['left', '왼쪽'],
            ['center', '중앙'],
            ['right', '오른쪽'],
            ['full', '전체'],
          ]}
        />
        <SelectField
          label="크기"
          value={line.Size ?? 'medium'}
          onChange={(value) => onPatch({ Size: value as ReadingLineDTO['Size'] })}
          options={[
            ['small', '작게'],
            ['medium', '보통'],
            ['large', '크게'],
          ]}
        />
      </div>
    </>
  );
}
