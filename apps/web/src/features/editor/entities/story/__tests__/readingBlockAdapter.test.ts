import { describe, expect, it } from 'vitest';

import {
  isDialogueBlock,
  normalizeReadingBlocks,
  parseReadingScriptToBlocks,
} from '../readingBlockAdapter';

const characters = [
  { id: 'char-1', name: '변상훈' },
  { id: 'char-2', name: '윤서연' },
];

const media = [
  { id: 'image-1', name: '저택 전경', type: 'IMAGE' as const },
  { id: 'video-1', name: 'CCTV 01', type: 'VIDEO' as const },
  { id: 'bgm-1', name: '심문 테마', type: 'BGM' as const },
  { id: 'sfx-1', name: '문 닫히는 소리', type: 'SFX' as const },
];

describe('parseReadingScriptToBlocks', () => {
  it('parses dialogue, media, and effect sound blocks into API-compatible lines', () => {
    const result = parseReadingScriptToBlocks(
      [
        '나레이션: 모두 눈을 감아주세요.',
        '이미지: 저택 전경 large',
        '변상훈: 저는 아무것도 보지 못했습니다.',
        '영상: CCTV 01',
        '효과음: 문 닫히는 소리',
        'GM: 진행자만 보는 메모',
      ].join('\n'),
      { characters, media }
    );

    expect(result.issues).toEqual([]);
    expect(result.blocks).toMatchObject([
      {
        Index: 0,
        Type: 'dialogue',
        Speaker: '나레이션',
        Text: '모두 눈을 감아주세요.',
        AdvanceBy: 'gm',
      },
      {
        Index: 1,
        Type: 'image',
        MediaID: 'image-1',
        Position: 'center',
        Size: 'large',
        AdvanceBy: 'gm',
      },
      {
        Index: 2,
        Type: 'dialogue',
        Speaker: '변상훈',
        Text: '저는 아무것도 보지 못했습니다.',
        AdvanceBy: 'role:char-1',
      },
      {
        Index: 3,
        Type: 'video',
        MediaID: 'video-1',
        Autoplay: true,
        WaitUntilEnd: true,
        AdvanceBy: 'gm',
      },
      { Index: 4, Type: 'bgm', MediaID: 'sfx-1', BGMMode: 'once' },
      { Index: 5, Type: 'dialogue', Speaker: '나레이션', Text: '진행자만 보는 메모' },
    ]);
  });

  it('records unresolved speaker and media names instead of inventing IDs', () => {
    const result = parseReadingScriptToBlocks(
      ['모르는사람: 알리바이가 있습니다.', '이미지: 없는 사진', '효과음: 없는 소리'].join('\n'),
      { characters, media }
    );

    expect(result.blocks[0]).toMatchObject({
      Type: 'dialogue',
      Speaker: '모르는사람',
      AdvanceBy: 'gm',
    });
    expect(result.blocks[1]).toMatchObject({ Type: 'image', MediaID: '' });
    expect(result.blocks[2]).toMatchObject({ Type: 'bgm', MediaID: '', BGMMode: 'once' });
    expect(result.issues).toEqual([
      { lineNumber: 1, kind: 'unknown-speaker', value: '모르는사람' },
      { lineNumber: 2, kind: 'unknown-media', value: '없는 사진' },
      { lineNumber: 3, kind: 'unknown-media', value: '없는 소리' },
    ]);
  });

  it('does not strip directive words embedded inside media names', () => {
    const result = parseReadingScriptToBlocks(
      ['이미지: leftover_theme', '영상: fullscreen_bg', '효과음: stopper_sfx'].join('\n'),
      {
        characters,
        media: [
          ...media,
          { id: 'image-leftover', name: 'leftover_theme', type: 'IMAGE' as const },
          { id: 'video-fullscreen', name: 'fullscreen_bg', type: 'VIDEO' as const },
          { id: 'sfx-stopper', name: 'stopper_sfx', type: 'SFX' as const },
        ],
      }
    );

    expect(result.issues).toEqual([]);
    expect(result.blocks).toMatchObject([
      { Type: 'image', MediaID: 'image-leftover', Position: 'center', Size: 'medium' },
      { Type: 'video', MediaID: 'video-fullscreen' },
      { Type: 'bgm', MediaID: 'sfx-stopper', BGMMode: 'once' },
    ]);
  });
});

describe('normalizeReadingBlocks', () => {
  it('keeps legacy lines as dialogue blocks and rewrites indices', () => {
    const normalized = normalizeReadingBlocks([
      { Index: 99, Text: 'legacy', Speaker: '나레이션', AdvanceBy: 'gm' },
      { Index: 42, Type: 'gmNote', Text: 'note' },
    ]);

    expect(normalized[0]).toMatchObject({ Index: 0, Type: 'dialogue' });
    expect(normalized[1]).toMatchObject({ Index: 1, Type: 'gmNote' });
    expect(isDialogueBlock(normalized[0])).toBe(true);
    expect(isDialogueBlock(normalized[1])).toBe(false);
  });
});
