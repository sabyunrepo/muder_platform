import type { AdvanceBy, ReadingBlockType, ReadingLineDTO } from '../../readingApi';
import type { MediaResponse } from '../../mediaApi';
import type { CharacterOption } from './readingBlockUiTypes';

export const readingPreviewVoiceDurationMs = 2600;
export const readingPreviewVideoDurationMs = 1800;
export const readingPreviewEffectSoundAdvanceDelayMs = 500;

export function getReadingPreviewBlockType(line: ReadingLineDTO): ReadingBlockType {
  return line.Type ?? 'dialogue';
}

export function getReadingPreviewAdvanceLabel(
  advanceBy: AdvanceBy | undefined,
  characters: CharacterOption[]
): string {
  if (advanceBy === 'voice') return '음성 종료 후 계속';
  if (advanceBy?.startsWith('role:')) {
    const characterId = advanceBy.slice('role:'.length);
    return `${characters.find((character) => character.id === characterId)?.name ?? '선택 캐릭터'} 계속`;
  }
  return '방장 계속';
}

export function getReadingPreviewWaitMediaId(line: ReadingLineDTO): string | null {
  const type = getReadingPreviewBlockType(line);
  if (type === 'dialogue' && line.AdvanceBy === 'voice' && line.VoiceMediaID) {
    return line.VoiceMediaID;
  }
  if (type === 'video' && line.WaitUntilEnd && line.MediaID) {
    return line.MediaID;
  }
  return null;
}

export function getReadingPreviewActiveBgm(
  bgmMediaId: string | null | undefined,
  bgmMode: 'loop' | 'once',
  mediaById: Map<string, MediaResponse>
): string {
  if (!bgmMediaId) return '배경음악 없음';
  return `${getReadingPreviewMediaLabel(bgmMediaId, mediaById)} ${bgmMode === 'once' ? '1회' : '반복'}`;
}

export function getReadingPreviewMediaLabel(
  mediaId: string | undefined,
  mediaById: Map<string, MediaResponse>
): string {
  if (!mediaId) return '미디어 미선택';
  return mediaById.get(mediaId)?.name ?? '삭제된 미디어';
}

export function getReadingPreviewMediaUrl(
  mediaId: string | undefined,
  mediaById: Map<string, MediaResponse>
): string | undefined {
  if (!mediaId) return undefined;
  const media = mediaById.get(mediaId);
  return media?.url;
}
