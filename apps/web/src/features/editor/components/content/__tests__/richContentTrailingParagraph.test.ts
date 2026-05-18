import { describe, expect, it } from 'vitest';

import {
  appendTrailingEmptyParagraph,
  isCollapsedSelectionAtEndOfElement,
  isPlainEnterKey,
  TRAILING_EMPTY_PARAGRAPH_MARKDOWN,
} from '../richContentTrailingParagraph';

describe('richContentTrailingParagraph', () => {
  it('encodes a trailing empty paragraph as markdown content that survives trimming', () => {
    expect(appendTrailingEmptyParagraph('첫 문장')).toBe(
      `첫 문장\n\n${TRAILING_EMPTY_PARAGRAPH_MARKDOWN}`
    );
    expect(appendTrailingEmptyParagraph('첫 문장\n\n')).toBe(
      `첫 문장\n\n${TRAILING_EMPTY_PARAGRAPH_MARKDOWN}`
    );
  });

  it('handles only unmodified Enter presses', () => {
    expect(isPlainEnterKey(new KeyboardEvent('keydown', { key: 'Enter' }))).toBe(true);
    expect(isPlainEnterKey(new KeyboardEvent('keydown', { key: 'Enter', shiftKey: true }))).toBe(
      false
    );
    expect(isPlainEnterKey(new KeyboardEvent('keydown', { key: 'a' }))).toBe(false);
  });

  it('detects a collapsed caret at the end of editable content', () => {
    const element = document.createElement('div');
    element.textContent = '첫 문장';
    document.body.appendChild(element);

    const text = element.firstChild;
    expect(text).not.toBeNull();

    const range = document.createRange();
    range.setStart(text!, element.textContent.length);
    range.collapse(true);
    document.getSelection()?.removeAllRanges();
    document.getSelection()?.addRange(range);

    expect(isCollapsedSelectionAtEndOfElement(element)).toBe(true);

    range.setStart(text!, 1);
    range.collapse(true);
    document.getSelection()?.removeAllRanges();
    document.getSelection()?.addRange(range);

    expect(isCollapsedSelectionAtEndOfElement(element)).toBe(false);

    element.remove();
  });
});
