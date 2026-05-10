import { useEffect, useRef } from 'react';
import { Mic } from 'lucide-react';

import { MediaControl } from './MediaControl';
import type { BlockFieldProps } from './readingBlockFieldProps';

export function DialogueBlockFields({
  line,
  characters,
  mediaById,
  themeId,
  onPatch,
}: BlockFieldProps) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = 'auto';
    textarea.style.height = `${textarea.scrollHeight}px`;
  }, [line.Text]);

  return (
    <>
      <div className="grid gap-2 md:grid-cols-[10rem_minmax(0,1fr)] md:items-start">
        <select
          aria-label="화자"
          className="h-9 rounded border border-slate-700 bg-slate-800 px-2 text-sm text-slate-100"
          value={line.Speaker ?? ''}
          onChange={(event) => onPatch({ Speaker: event.target.value })}
        >
          <option value="">화자 선택</option>
          <option value="나레이션">나레이션</option>
          {characters.map((character) => (
            <option key={character.id} value={character.name}>
              {character.name}
            </option>
          ))}
        </select>
        <textarea
          ref={textareaRef}
          aria-label="대사 본문"
          rows={1}
          className="min-h-9 w-full resize-none overflow-hidden rounded border border-slate-700 bg-slate-800 px-3 py-2 text-sm leading-5 text-slate-100"
          value={line.Text ?? ''}
          onChange={(event) => onPatch({ Text: event.target.value })}
          placeholder="대사 또는 지문"
        />
      </div>
      <div className="grid gap-2">
        <MediaControl
          themeId={themeId}
          label="음성"
          emptyLabel="음성 선택"
          removeLabel="음성 제거"
          pickerTitle="음성 선택"
          filterType="VOICE"
          selectedId={line.VoiceMediaID}
          selectedMedia={mediaById.get(line.VoiceMediaID ?? '') ?? null}
          icon={Mic}
          selectedClassName="text-amber-300"
          onSelect={(media) => onPatch({ VoiceMediaID: media.id })}
          onClear={() => onPatch({ VoiceMediaID: '' })}
        />
      </div>
    </>
  );
}
