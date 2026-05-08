import type { ReadingBlockType, ReadingLineDTO } from '../../readingApi';
import type { MediaResponse } from '../../mediaApi';
import type { CharacterOption } from './readingBlockUiTypes';
import { BgmBlockFields } from './BgmBlockFields';
import { DialogueBlockFields } from './DialogueBlockFields';
import { ImageBlockFields } from './ImageBlockFields';
import { VideoBlockFields } from './VideoBlockFields';

export function ReadingBlockFields({
  type,
  line,
  characters,
  mediaById,
  themeId,
  onPatch,
}: {
  type: ReadingBlockType;
  line: ReadingLineDTO;
  characters: CharacterOption[];
  mediaById: Map<string, MediaResponse>;
  themeId: string;
  onPatch: (patchValue: Partial<ReadingLineDTO>) => void;
}) {
  const fieldProps = { line, characters, mediaById, themeId, onPatch };

  if (type === 'image') {
    return <ImageBlockFields {...fieldProps} />;
  }

  if (type === 'video') {
    return <VideoBlockFields {...fieldProps} />;
  }

  if (type === 'bgm') {
    return <BgmBlockFields {...fieldProps} />;
  }

  if (type === 'gmNote') {
    return (
      <p className="rounded border border-slate-700 bg-slate-800 px-3 py-2 text-xs text-slate-300">
        이전 버전의 GM 메모입니다. 저장하면 새 대본에서는 제거됩니다.
      </p>
    );
  }

  return <DialogueBlockFields {...fieldProps} />;
}
