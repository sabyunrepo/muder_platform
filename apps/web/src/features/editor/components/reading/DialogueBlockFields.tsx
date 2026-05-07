import { Image as ImageIcon, Mic } from 'lucide-react';

import { AdvanceField } from './AdvanceField';
import { MediaControl } from './MediaControl';
import type { BlockFieldProps } from './readingBlockFieldProps';

export function DialogueBlockFields({
  line,
  characters,
  mediaById,
  themeId,
  onPatch,
}: BlockFieldProps) {
  return (
    <>
      <div className="grid gap-2 md:grid-cols-[11rem_minmax(0,1fr)]">
        <select
          aria-label="화자"
          className="rounded border border-slate-700 bg-slate-800 px-2 py-2 text-sm text-slate-100"
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
          aria-label="대사 본문"
          className="min-h-20 w-full resize-y rounded border border-slate-700 bg-slate-800 px-3 py-2 text-sm leading-6 text-slate-100"
          value={line.Text ?? ''}
          onChange={(event) => onPatch({ Text: event.target.value })}
          placeholder="대사 또는 지문"
        />
      </div>
      <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_12rem]">
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
          onSelect={(media) => onPatch({ VoiceMediaID: media.id, AdvanceBy: 'voice' })}
          onClear={() =>
            onPatch({
              VoiceMediaID: '',
              AdvanceBy: line.AdvanceBy === 'voice' ? 'gm' : line.AdvanceBy,
            })
          }
        />
        <MediaControl
          themeId={themeId}
          label="이미지"
          emptyLabel="이미지 선택"
          removeLabel="이미지 제거"
          pickerTitle="이미지 선택"
          filterType="IMAGE"
          selectedId={line.ImageMediaID}
          selectedMedia={mediaById.get(line.ImageMediaID ?? '') ?? null}
          icon={ImageIcon}
          selectedClassName="text-sky-300"
          onSelect={(media) => onPatch({ ImageMediaID: media.id })}
          onClear={() => onPatch({ ImageMediaID: '' })}
        />
        <AdvanceField
          line={line}
          characters={characters}
          onChange={onPatch}
          allowVoice={Boolean(line.VoiceMediaID)}
        />
      </div>
    </>
  );
}
