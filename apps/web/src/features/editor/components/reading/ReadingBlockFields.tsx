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
      <textarea
        aria-label="GM 메모"
        className="min-h-20 w-full resize-y rounded border border-slate-700 bg-slate-800 px-3 py-2 text-sm leading-6 text-slate-100"
        value={line.Text ?? ''}
        onChange={(event) => onPatch({ Text: event.target.value })}
        placeholder="진행자만 보는 메모"
      />
    );
  }

  return <DialogueBlockFields {...fieldProps} />;
}
