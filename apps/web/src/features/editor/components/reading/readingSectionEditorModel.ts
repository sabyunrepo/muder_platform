import { Image as ImageIcon, Mic, Music, Video, type LucideIcon } from 'lucide-react';

import { isApiHttpError } from '@/lib/api-error';

import type {
  AdvanceBy,
  ReadingBlockType,
  ReadingLineDTO,
  ReadingSectionBgmMode,
  ReadingSectionResponse,
} from '../../readingApi';
import type { MediaResponse, MediaType } from '../../mediaApi';
import type { CharacterOption } from './readingBlockUiTypes';
import { normalizeReadingBlocks } from '../../entities/story/readingBlockAdapter';

export interface ReadingSectionDraft {
  name: string;
  bgmMediaId: string | null;
  bgmMode: ReadingSectionBgmMode;
  narratorCharacterId: string | null;
  lines: ReadingLineDTO[];
  sortOrder: number;
}

export interface ReadingSaveValidationIssue {
  lineIndex: number;
  message: string;
}

export const blockActions: Array<{
  type: ReadingBlockType;
  label: string;
  icon: LucideIcon;
}> = [
  { type: 'dialogue', label: '대사', icon: Mic },
  { type: 'image', label: '이미지', icon: ImageIcon },
  { type: 'video', label: '영상', icon: Video },
  { type: 'sfx', label: '효과음', icon: Music },
];

export function toDraft(section: ReadingSectionResponse): ReadingSectionDraft {
  return {
    name: section.name,
    bgmMediaId: section.bgmMediaId ?? null,
    bgmMode: section.bgmMode ?? 'loop',
    narratorCharacterId: section.narratorCharacterId ?? null,
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
  if (draft.bgmMode !== (section.bgmMode ?? 'loop')) return true;
  if ((draft.narratorCharacterId ?? null) !== (section.narratorCharacterId ?? null)) return true;
  if (draft.sortOrder !== section.sortOrder) return true;
  const savedLines = section.lines;
  if (draft.lines.length !== savedLines.length) return true;

  return draft.lines.some((draftLine, index) => {
    const savedLine = savedLines[index];
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
  if (type === 'sfx') {
    return { Index: index, Type: 'sfx', MediaID: '', BGMMode: 'once' };
  }
  if (type === 'bgm') {
    return { Index: index, Type: 'bgm', MediaID: '', BGMMode: 'loop' };
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

export function normalizeReadingLinesForSave(
  lines: ReadingLineDTO[],
  characters: CharacterOption[],
  narratorCharacterId: string | null
): ReadingLineDTO[] {
  return normalizeReadingBlocks(lines).map((line) => {
    const type = line.Type ?? 'dialogue';
    if (type !== 'dialogue') {
      return { ...line, AdvanceBy: 'gm' as const };
    }
    return {
      ...line,
      ImageMediaID: '',
      AdvanceBy: resolveDialogueAdvanceBy(line, characters, narratorCharacterId),
    };
  });
}

export function validateReadingLinesForSave(
  lines: ReadingLineDTO[]
): ReadingSaveValidationIssue[] {
  return lines.flatMap((line, index) => {
    const type = line.Type ?? 'dialogue';
    if (type === 'dialogue' || type === 'gmNote') return [];
    if ((type === 'sfx' || type === 'bgm') && line.BGMMode === 'stop') return [];
    if ((line.MediaID ?? '').trim() !== '') return [];
    return [
      {
        lineIndex: index,
        message: `${index + 1}번 ${getReadingBlockLabel(type)} 블록: ${getRequiredMediaMessage(
          type
        )}`,
      },
    ];
  });
}

export function getReadingSaveErrorMessage(error: unknown): string {
  const raw = error instanceof Error ? error.message : typeof error === 'string' ? error : '';
  const lineMatch = raw.match(/line\s+(\d+):\s+mediaId is required/i);
  if (lineMatch) {
    const lineNumber = Number(lineMatch[1]) + 1;
    return `${lineNumber}번 미디어 블록에 선택된 파일이 없습니다. 이미지, 영상, 효과음 블록은 파일을 선택해야 저장할 수 있습니다.`;
  }
  if (raw) return raw;
  return '읽기 대사를 저장하지 못했습니다. 입력 내용을 확인한 뒤 다시 시도해 주세요.';
}

function resolveDialogueAdvanceBy(
  line: ReadingLineDTO,
  characters: CharacterOption[],
  narratorCharacterId: string | null
): AdvanceBy {
  const speaker = line.Speaker ?? '';
  const speakerCharacter = characters.find((character) => character.name === speaker);
  if (speakerCharacter?.isPlayable) {
    return `role:${speakerCharacter.id}`;
  }
  if (narratorCharacterId) {
    return `role:${narratorCharacterId}`;
  }
  return 'gm';
}

function getReadingBlockLabel(type: ReadingBlockType): string {
  switch (type) {
    case 'image':
      return '이미지';
    case 'video':
      return '영상';
    case 'sfx':
    case 'bgm':
      return '효과음';
    case 'gmNote':
      return '메모';
    case 'dialogue':
    default:
      return '대사';
  }
}

function getRequiredMediaMessage(type: ReadingBlockType): string {
  switch (type) {
    case 'image':
      return '이미지를 선택해야 저장할 수 있습니다.';
    case 'video':
      return '영상을 선택해야 저장할 수 있습니다.';
    case 'sfx':
    case 'bgm':
      return '효과음을 선택해야 저장할 수 있습니다.';
    default:
      return '미디어를 선택해야 저장할 수 있습니다.';
  }
}
