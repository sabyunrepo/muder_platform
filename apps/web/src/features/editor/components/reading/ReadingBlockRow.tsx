import {
  ArrowDown,
  ArrowUp,
  GripVertical,
  Image as ImageIcon,
  Mic,
  Music,
  Trash2,
  Video,
  type LucideIcon,
} from 'lucide-react';

import type { ReadingLineDTO, ReadingBlockType } from '../../readingApi';
import type { MediaResponse } from '../../mediaApi';
import { ReadingBlockFields } from './ReadingBlockFields';
import type { CharacterOption } from './readingBlockUiTypes';

export interface ReadingBlockRowProps {
  themeId: string;
  line: ReadingLineDTO;
  index: number;
  totalCount: number;
  characters: CharacterOption[];
  mediaById: Map<string, MediaResponse>;
  dragging: boolean;
  onChange: (line: ReadingLineDTO) => void;
  onDelete: () => void;
  onMove: (from: number, to: number) => void;
  onDragStart: () => void;
  onDragEnd: () => void;
}

const blockMeta: Record<ReadingBlockType, { label: string; icon: LucideIcon; className: string }> =
  {
    dialogue: {
      label: '대사',
      icon: Mic,
      className: 'border-amber-500/30 bg-amber-500/5 text-amber-200',
    },
    image: {
      label: '이미지',
      icon: ImageIcon,
      className: 'border-sky-500/30 bg-sky-500/5 text-sky-200',
    },
    video: {
      label: '영상',
      icon: Video,
      className: 'border-violet-500/30 bg-violet-500/5 text-violet-200',
    },
    bgm: {
      label: '효과음',
      icon: Music,
      className: 'border-emerald-500/30 bg-emerald-500/5 text-emerald-200',
    },
    gmNote: {
      label: '레거시 메모',
      icon: Mic,
      className: 'border-slate-500/30 bg-slate-800/70 text-slate-200',
    },
  };

export function ReadingBlockRow({
  themeId,
  line,
  index,
  totalCount,
  characters,
  mediaById,
  dragging,
  onChange,
  onDelete,
  onMove,
  onDragStart,
  onDragEnd,
}: ReadingBlockRowProps) {
  const type = line.Type ?? 'dialogue';
  const meta = blockMeta[type];
  const Icon = meta.icon;

  function patch(patchValue: Partial<ReadingLineDTO>) {
    onChange({ ...line, ...patchValue });
  }

  return (
    <article
      draggable
      onDragStart={(event) => {
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('text/plain', String(index));
        onDragStart();
      }}
      onDragOver={(event) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
      }}
      onDrop={(event) => {
        event.preventDefault();
        const from = Number(event.dataTransfer.getData('text/plain'));
        if (Number.isInteger(from)) onMove(from, index);
      }}
      onDragEnd={onDragEnd}
      className={`rounded border p-3 transition ${
        dragging ? 'border-amber-300/70 bg-slate-800/90' : 'border-slate-700 bg-slate-900'
      }`}
    >
      <div className="grid gap-3 md:grid-cols-[auto_minmax(0,1fr)_auto] md:items-start">
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="cursor-grab rounded p-1 text-slate-500 hover:bg-slate-800 hover:text-slate-300"
            aria-label={`${index + 1}번 블록 드래그`}
          >
            <GripVertical className="h-4 w-4" />
          </button>
          <span className="w-6 text-right font-mono text-xs text-slate-500">{index + 1}</span>
          <span
            className={`inline-flex items-center gap-1 rounded border px-2 py-1 text-xs ${meta.className}`}
          >
            <Icon className="h-3.5 w-3.5" />
            {meta.label}
          </span>
        </div>

        <div className="min-w-0 space-y-3">
          <ReadingBlockFields
            type={type}
            line={line}
            characters={characters}
            mediaById={mediaById}
            themeId={themeId}
            onPatch={patch}
          />
        </div>

        <div className="flex items-center justify-end gap-1">
          <button
            type="button"
            onClick={() => onMove(index, index - 1)}
            disabled={index === 0}
            aria-label="블록 위로 이동"
            className="rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-slate-100 disabled:cursor-not-allowed disabled:text-slate-700"
          >
            <ArrowUp className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => onMove(index, index + 1)}
            disabled={index >= totalCount - 1}
            aria-label="블록 아래로 이동"
            className="rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-slate-100 disabled:cursor-not-allowed disabled:text-slate-700"
          >
            <ArrowDown className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={onDelete}
            aria-label="블록 삭제"
            className="rounded p-1 text-rose-400 hover:bg-rose-500/10 hover:text-rose-300"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>
    </article>
  );
}
