import { Image as ImageIcon, Mic, Music, StickyNote, Video, type LucideIcon } from 'lucide-react';

import { isApiHttpError } from '@/lib/api-error';

import type { ReadingBlockType, ReadingLineDTO, ReadingSectionResponse } from '../../readingApi';
import type { MediaResponse, MediaType } from '../../mediaApi';

export interface ReadingSectionDraft {
  name: string;
  bgmMediaId: string | null;
  lines: ReadingLineDTO[];
  sortOrder: number;
}

export const blockActions: Array<{
  type: ReadingBlockType;
  label: string;
  icon: LucideIcon;
}> = [
  { type: 'dialogue', label: '대사', icon: Mic },
  { type: 'image', label: '이미지', icon: ImageIcon },
  { type: 'video', label: '영상', icon: Video },
  { type: 'bgm', label: 'BGM', icon: Music },
  { type: 'gmNote', label: 'GM 메모', icon: StickyNote },
];

export function toDraft(section: ReadingSectionResponse): ReadingSectionDraft {
  return {
    name: section.name,
    bgmMediaId: section.bgmMediaId ?? null,
    lines: section.lines.map((line) => ({ ...line })),
    sortOrder: section.sortOrder,
  };
}

export function isConflictError(err: unknown): boolean {
  if (!err) return false;
  if (isApiHttpError(err) && err.status === 409) return true;
  const msg = err instanceof Error ? err.message : typeof err === 'string' ? err : '';
  return /\b409\b/.test(msg) || msg.toLowerCase().includes('conflict');
}

export function isReadingDraftDirty(
  draft: ReadingSectionDraft,
  section: ReadingSectionResponse
): boolean {
  if (draft.name !== section.name) return true;
  if ((draft.bgmMediaId ?? null) !== (section.bgmMediaId ?? null)) return true;
  if (draft.sortOrder !== section.sortOrder) return true;
  if (draft.lines.length !== section.lines.length) return true;

  return draft.lines.some((draftLine, index) => {
    const savedLine = section.lines[index];
    return (
      draftLine.Index !== savedLine.Index ||
      draftLine.Text !== savedLine.Text ||
      (draftLine.Speaker ?? '') !== (savedLine.Speaker ?? '') ||
      (draftLine.VoiceMediaID ?? '') !== (savedLine.VoiceMediaID ?? '') ||
      (draftLine.ImageMediaID ?? '') !== (savedLine.ImageMediaID ?? '') ||
      (draftLine.AdvanceBy ?? '') !== (savedLine.AdvanceBy ?? '') ||
      (draftLine.Type ?? 'dialogue') !== (savedLine.Type ?? 'dialogue') ||
      (draftLine.MediaID ?? '') !== (savedLine.MediaID ?? '') ||
      (draftLine.Position ?? '') !== (savedLine.Position ?? '') ||
      (draftLine.Size ?? '') !== (savedLine.Size ?? '') ||
      (draftLine.Autoplay ?? false) !== (savedLine.Autoplay ?? false) ||
      (draftLine.WaitUntilEnd ?? false) !== (savedLine.WaitUntilEnd ?? false) ||
      (draftLine.BGMMode ?? '') !== (savedLine.BGMMode ?? '')
    );
  });
}

export function createBlock(type: ReadingBlockType, index: number): ReadingLineDTO {
  if (type === 'image') {
    return {
      Index: index,
      Type: type,
      MediaID: '',
      Position: 'center',
      Size: 'medium',
      AdvanceBy: 'gm',
    };
  }
  if (type === 'video') {
    return {
      Index: index,
      Type: type,
      MediaID: '',
      Autoplay: true,
      WaitUntilEnd: true,
      AdvanceBy: 'gm',
    };
  }
  if (type === 'bgm') {
    return { Index: index, Type: type, MediaID: '', BGMMode: 'loop' };
  }
  if (type === 'gmNote') {
    return { Index: index, Type: type, Text: '' };
  }
  return {
    Index: index,
    Type: 'dialogue',
    Text: '',
    Speaker: '나레이션',
    VoiceMediaID: '',
    ImageMediaID: '',
    AdvanceBy: 'gm',
  };
}

export function toParserMedia(media: MediaResponse): { id: string; name: string; type: MediaType } {
  return { id: media.id, name: media.name, type: media.type };
}
