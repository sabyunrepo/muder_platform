import { describe, expect, it } from 'vitest';

import {
  appendTrailingEmptyParagraph,
  isCollapsedSelectionAtEndOfElement,
  isPlainEnterKey,
  normalizeTrailingEmptyParagraphInput,
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

  it('removes the empty paragraph marker once the user types real content on that line', () => {
    expect(normalizeTrailingEmptyParagraphInput(`첫 문장\n\n${TRAILING_EMPTY_PARAGRAPH_MARKDOWN}`)).toBe(
      `첫 문장\n\n${TRAILING_EMPTY_PARAGRAPH_MARKDOWN}`
    );
    expect(normalizeTrailingEmptyParagraphInput(`첫 문장\n\n${TRAILING_EMPTY_PARAGRAPH_MARKDOWN}다음 문장`)).toBe(
      '첫 문장\n\n다음 문장'
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

  it('treats MDXEditor empty paragraphs as the editable end', () => {
    const element = document.createElement('div');
    element.contentEditable = 'true';
    element.innerHTML = '<p dir="auto"><br></p>';
    document.body.appendChild(element);

    const range = document.createRange();
    range.setStart(element, element.childNodes.length);
    range.collapse(true);
    document.getSelection()?.removeAllRanges();
    document.getSelection()?.addRange(range);

    expect(isCollapsedSelectionAtEndOfElement(element)).toBe(true);

    element.remove();
  });

  it('does not treat the end of a middle paragraph as the editable end', () => {
    const element = document.createElement('div');
    element.contentEditable = 'true';
    element.innerHTML =
      '<p dir="auto"><span data-lexical-text="true">첫 문장</span></p><p dir="auto"><span data-lexical-text="true">둘째 문장</span></p>';
    document.body.appendChild(element);

    const firstParagraphText = element.querySelector('p')?.textContent;
    const firstTextNode = element.querySelector('p span')?.firstChild;
    expect(firstTextNode).not.toBeNull();

    const range = document.createRange();
    range.setStart(firstTextNode!, firstParagraphText?.length ?? 0);
    range.collapse(true);
    document.getSelection()?.removeAllRanges();
    document.getSelection()?.addRange(range);

    expect(isCollapsedSelectionAtEndOfElement(element)).toBe(false);

    element.remove();
  });

  it('still detects the end of the last editor paragraph', () => {
    const element = document.createElement('div');
    element.contentEditable = 'true';
    element.innerHTML =
      '<p dir="auto"><span data-lexical-text="true">첫 문장</span></p><p dir="auto"><span data-lexical-text="true">둘째 문장</span></p>';
    document.body.appendChild(element);

    const lastParagraph = element.querySelectorAll('p')[1];
    const lastTextNode = lastParagraph?.querySelector('span')?.firstChild;
    expect(lastParagraph).not.toBeUndefined();
    expect(lastTextNode).not.toBeNull();

    const range = document.createRange();
    range.setStart(lastTextNode!, lastParagraph!.textContent?.length ?? 0);
    range.collapse(true);
    document.getSelection()?.removeAllRanges();
    document.getSelection()?.addRange(range);

    expect(isCollapsedSelectionAtEndOfElement(element)).toBe(true);

    element.remove();
  });
});
