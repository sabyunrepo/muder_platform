import { useState } from 'react';
import { Image as ImageIcon, Mic, Music, Video, X, type LucideIcon } from 'lucide-react';

import type { AdvanceBy, ReadingBlockType, ReadingLineDTO } from '../../readingApi';
import type { MediaResponse, MediaType } from '../../mediaApi';
import { MediaPicker } from '../media/MediaPicker';
import type { CharacterOption } from './readingBlockUiTypes';

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
  if (type === 'image') {
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
        <div className="grid gap-2 sm:grid-cols-3">
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
          <AdvanceField line={line} characters={characters} onChange={onPatch} />
        </div>
      </>
    );
  }

  if (type === 'video') {
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
          <AdvanceField line={line} characters={characters} onChange={onPatch} compact />
        </div>
      </>
    );
  }

  if (type === 'bgm') {
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
        <AdvanceField line={line} characters={characters} onChange={onPatch} />
      </div>
    </>
  );
}

function MediaControl({
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

function AdvanceField({
  line,
  characters,
  onChange,
  compact = false,
}: {
  line: ReadingLineDTO;
  characters: CharacterOption[];
  onChange: (patch: Partial<ReadingLineDTO>) => void;
  compact?: boolean;
}) {
  const advanceBy = line.AdvanceBy ?? 'gm';
  const mode = advanceBy.startsWith('role:') ? 'role' : advanceBy === 'voice' ? 'voice' : 'gm';
  const roleId = advanceBy.startsWith('role:') ? advanceBy.slice('role:'.length) : '';

  function setMode(nextMode: string) {
    if (nextMode === 'role') {
      onChange({ AdvanceBy: characters[0] ? (`role:${characters[0].id}` as AdvanceBy) : '' });
      return;
    }
    onChange({ AdvanceBy: nextMode as AdvanceBy });
  }

  return (
    <div className={compact ? 'flex items-center gap-2' : 'min-w-0'}>
      {!compact && <p className="mb-1 text-xs text-slate-500">진행</p>}
      <select
        aria-label="진행 방식"
        className="rounded border border-slate-700 bg-slate-800 px-2 py-1 text-xs text-slate-100"
        value={mode}
        onChange={(event) => setMode(event.target.value)}
      >
        <option value="gm">방장</option>
        <option value="voice">음성 자동</option>
        <option value="role">역할 지정</option>
      </select>
      {mode === 'role' && (
        <select
          aria-label="진행 역할"
          className="rounded border border-slate-700 bg-slate-800 px-2 py-1 text-xs text-slate-100"
          value={roleId}
          onChange={(event) => onChange({ AdvanceBy: `role:${event.target.value}` as AdvanceBy })}
        >
          {characters.length === 0 && <option value="">역할 없음</option>}
          {characters.map((character) => (
            <option key={character.id} value={character.id}>
              {character.name}
            </option>
          ))}
        </select>
      )}
    </div>
  );
}

function SelectField({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: Array<[string, string]>;
  onChange: (value: string) => void;
}) {
  return (
    <label className="min-w-0 text-xs text-slate-500">
      <span className="mb-1 block">{label}</span>
      <select
        className="w-full rounded border border-slate-700 bg-slate-800 px-2 py-1 text-xs text-slate-100"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        {options.map(([optionValue, optionLabel]) => (
          <option key={optionValue} value={optionValue}>
            {optionLabel}
          </option>
        ))}
      </select>
    </label>
  );
}
