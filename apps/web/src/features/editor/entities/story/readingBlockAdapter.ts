import type { AdvanceBy, ReadingBgmMode, ReadingBlockType, ReadingLineDTO } from '../../readingApi';
import type { MediaType } from '../../mediaApi';

export interface ReadingParserCharacter {
  id: string;
  name: string;
}

export interface ReadingParserMedia {
  id: string;
  name: string;
  type: MediaType;
}

export interface ReadingParseIssue {
  lineNumber: number;
  kind: 'unknown-speaker' | 'unknown-media' | 'empty-directive';
  value: string;
}

export interface ReadingParseResult {
  blocks: ReadingLineDTO[];
  issues: ReadingParseIssue[];
}

export function parseReadingScriptToBlocks(
  input: string,
  options: {
    characters: ReadingParserCharacter[];
    media: ReadingParserMedia[];
  }
): ReadingParseResult {
  const issues: ReadingParseIssue[] = [];
  const blocks = input
    .split(/\r?\n/)
    .map((raw, index) => ({ raw: raw.trim(), lineNumber: index + 1 }))
    .filter((line) => line.raw.length > 0)
    .map(({ raw, lineNumber }, index): ReadingLineDTO => {
      const [rawHead, ...rest] = raw.split(/[:：]/);
      const head = rawHead.trim();
      const body = rest.join(':').trim();

      if (!head || rest.length === 0) {
        issues.push({ lineNumber, kind: 'empty-directive', value: raw });
        return dialogueBlock(index, '나레이션', raw, 'gm');
      }

      return parseDirectiveLine(index, lineNumber, head, body, raw, options, issues);
    });

  return { blocks, issues };
}

function parseDirectiveLine(
  index: number,
  lineNumber: number,
  head: string,
  body: string,
  raw: string,
  options: { characters: ReadingParserCharacter[]; media: ReadingParserMedia[] },
  issues: ReadingParseIssue[]
): ReadingLineDTO {
  if (head === '이미지') return parseImageDirective(index, lineNumber, body, options.media, issues);
  if (head === '영상') return parseVideoDirective(index, lineNumber, body, options.media, issues);
  if (head.toUpperCase() === 'BGM')
    return parseBgmDirective(index, lineNumber, body, options.media, issues);
  if (head.toUpperCase() === 'GM') return { Index: index, Type: 'gmNote', Text: body };
  return parseDialogueDirective(index, lineNumber, head, body || raw, options.characters, issues);
}

function parseImageDirective(
  index: number,
  lineNumber: number,
  body: string,
  media: ReadingParserMedia[],
  issues: ReadingParseIssue[]
): ReadingLineDTO {
  const found = findMedia(body, 'IMAGE', media);
  if (!found) issues.push({ lineNumber, kind: 'unknown-media', value: body });
  return mediaBlock(index, 'image', found?.id ?? '', 'gm', {
    Position: inferImagePosition(body),
    Size: inferImageSize(body),
  });
}

function parseVideoDirective(
  index: number,
  lineNumber: number,
  body: string,
  media: ReadingParserMedia[],
  issues: ReadingParseIssue[]
): ReadingLineDTO {
  const found = findMedia(body, 'VIDEO', media);
  if (!found) issues.push({ lineNumber, kind: 'unknown-media', value: body });
  return mediaBlock(index, 'video', found?.id ?? '', 'gm', {
    Autoplay: true,
    WaitUntilEnd: true,
  });
}

function parseBgmDirective(
  index: number,
  lineNumber: number,
  body: string,
  media: ReadingParserMedia[],
  issues: ReadingParseIssue[]
): ReadingLineDTO {
  const mode = inferBgmMode(body);
  const found = mode === 'stop' ? null : findMedia(body, 'BGM', media);
  if (mode !== 'stop' && !found) issues.push({ lineNumber, kind: 'unknown-media', value: body });
  return { Index: index, Type: 'bgm', Text: '', MediaID: found?.id ?? '', BGMMode: mode };
}

function parseDialogueDirective(
  index: number,
  lineNumber: number,
  speaker: string,
  text: string,
  characters: ReadingParserCharacter[],
  issues: ReadingParseIssue[]
): ReadingLineDTO {
  const character = characters.find((item) => item.name === speaker);
  if (!character && speaker !== '나레이션') {
    issues.push({ lineNumber, kind: 'unknown-speaker', value: speaker });
  }
  return dialogueBlock(
    index,
    speaker || '나레이션',
    text,
    character ? `role:${character.id}` : 'gm'
  );
}

export function normalizeReadingBlocks(lines: ReadingLineDTO[]): ReadingLineDTO[] {
  return lines.map((line, index) => {
    const type = normalizeBlockType(line.Type);
    const supportsVoiceAdvance = type === 'dialogue' && Boolean(line.VoiceMediaID);
    return {
      ...line,
      Index: index,
      Type: type,
      Text: line.Text ?? '',
      AdvanceBy: line.AdvanceBy === 'voice' && !supportsVoiceAdvance ? 'gm' : line.AdvanceBy,
    };
  });
}

export function isDialogueBlock(line: ReadingLineDTO): boolean {
  return normalizeBlockType(line.Type) === 'dialogue';
}

function dialogueBlock(
  index: number,
  speaker: string,
  text: string,
  advanceBy: AdvanceBy
): ReadingLineDTO {
  return {
    Index: index,
    Type: 'dialogue',
    Text: text,
    Speaker: speaker,
    AdvanceBy: advanceBy,
  };
}

function mediaBlock(
  index: number,
  type: Extract<ReadingBlockType, 'image' | 'video'>,
  mediaId: string,
  advanceBy: AdvanceBy,
  extras: Partial<ReadingLineDTO>
): ReadingLineDTO {
  return {
    Index: index,
    Type: type,
    Text: '',
    MediaID: mediaId,
    AdvanceBy: advanceBy,
    ...extras,
  };
}

function findMedia(
  name: string,
  type: MediaType,
  media: ReadingParserMedia[]
): ReadingParserMedia | null {
  const normalized = normalizeLookupName(name);
  if (!normalized) return null;
  return (
    media.find((item) => item.type === type && normalizeLookupName(item.name) === normalized) ??
    null
  );
}

function normalizeLookupName(value: string): string {
  const controlWords = [
    '반복',
    '1회',
    '한번',
    '정지',
    'loop',
    'once',
    'stop',
    'full',
    'large',
    'small',
    'left',
    'right',
    'center',
  ];
  let normalized = value;
  for (const word of controlWords) {
    normalized = normalized.replace(controlWordPattern(word), '$1');
  }
  return normalized.replace(/\s+/g, ' ').trim().toLowerCase();
}

function inferImagePosition(value: string): ReadingLineDTO['Position'] {
  if (hasControlWord(value, 'left')) return 'left';
  if (hasControlWord(value, 'right')) return 'right';
  if (hasControlWord(value, 'full')) return 'full';
  return 'center';
}

function inferImageSize(value: string): ReadingLineDTO['Size'] {
  if (hasControlWord(value, 'small')) return 'small';
  if (hasControlWord(value, 'large') || hasControlWord(value, 'full')) return 'large';
  return 'medium';
}

function inferBgmMode(value: string): ReadingBgmMode {
  if (hasControlWord(value, '정지') || hasControlWord(value, 'stop')) return 'stop';
  if (
    hasControlWord(value, '1회') ||
    hasControlWord(value, '한번') ||
    hasControlWord(value, 'once')
  )
    return 'once';
  return 'loop';
}

function normalizeBlockType(type: ReadingLineDTO['Type']): ReadingBlockType {
  return type ?? 'dialogue';
}

function hasControlWord(value: string, word: string): boolean {
  return controlWordPattern(word).test(value);
}

function controlWordPattern(word: string): RegExp {
  return new RegExp(`(^|[\\s_-])${escapeRegExp(word)}(?=$|[\\s_-])`, 'iu');
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
