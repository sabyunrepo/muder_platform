import { describe, expect, it } from 'vitest';

import {
  insertMediaEmbedParagraph,
  moveMediaEmbedBlock,
  moveMediaEmbedBlockTo,
  type MediaEmbedAttributes,
} from '../mediaEmbedMarkdown';

const first: MediaEmbedAttributes = {
  mediaId: 'image-1',
  type: 'image',
  align: 'center',
  width: 'medium',
};

const second: MediaEmbedAttributes = {
  mediaId: 'image-2',
  type: 'image',
  align: 'left',
  width: 'large',
};

const firstSnippet = '<MediaEmbed mediaId="image-1" type="image" align="center" width="medium" />';
const secondSnippet = '<MediaEmbed mediaId="image-2" type="image" align="left" width="large" />';

describe('mediaEmbedMarkdown helpers', () => {
  it('adds an editable spacing point before or after a media block without changing the embed', () => {
    expect(insertMediaEmbedParagraph(`A\n\n${firstSnippet}\n\nB`, first, 'before')).toBe(
      `A\n\n\n\n${firstSnippet}\n\nB`
    );

    expect(insertMediaEmbedParagraph(`A\n\n${firstSnippet}\n\nB`, first, 'after')).toBe(
      `A\n\n${firstSnippet}\n\n\n\nB`
    );
  });

  it('moves a media block up or down across neighboring media blocks', () => {
    const markdown = [firstSnippet, '', 'caption', '', secondSnippet].join('\n');

    expect(moveMediaEmbedBlock(markdown, second, 'up')).toBe(
      [secondSnippet, '', 'caption', '', firstSnippet].join('\n')
    );

    expect(moveMediaEmbedBlock(markdown, first, 'down')).toBe(
      [secondSnippet, '', 'caption', '', firstSnippet].join('\n')
    );
  });

  it('drops a dragged media block before or after a target media block', () => {
    const markdown = [firstSnippet, '', 'caption', '', secondSnippet].join('\n');

    expect(moveMediaEmbedBlockTo(markdown, first, second, 'after')).toBe(
      ['', '', 'caption', '', secondSnippet, '', firstSnippet, '', ''].join('\n')
    );

    expect(moveMediaEmbedBlockTo(markdown, second, first, 'before')).toBe(
      ['', '', secondSnippet, '', firstSnippet, '', 'caption', '', ''].join('\n')
    );
  });

  it('keeps markdown unchanged when the target cannot be found', () => {
    const markdown = `A\n\n${firstSnippet}`;
    expect(moveMediaEmbedBlock(markdown, second, 'up')).toBe(markdown);
    expect(insertMediaEmbedParagraph(markdown, second, 'after')).toBe(markdown);
  });
});
