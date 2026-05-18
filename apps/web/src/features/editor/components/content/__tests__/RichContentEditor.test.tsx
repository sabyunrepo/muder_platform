import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import React, { useImperativeHandle, useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const { useMediaListMock } = vi.hoisted(() => ({
  useMediaListMock: vi.fn(),
}));

vi.mock('@/features/editor/mediaApi', () => ({
  useMediaList: (...args: unknown[]) => useMediaListMock(...args),
}));

vi.mock('../MediaEmbedPicker', () => ({
  MediaEmbedPicker: () => null,
}));

vi.mock('../MediaEmbedEditor', () => ({
  MediaEmbedEditor: () => null,
}));

vi.mock('@mdxeditor/editor', () => {
  const plugin = () => ({});
  const MDXEditor = React.forwardRef(
    (
      {
        markdown,
        onChange,
      }: {
        markdown: string;
        onChange: (markdown: string) => void;
      },
      ref
    ) => {
      const [value, setValue] = useState(markdown);
      useImperativeHandle(
        ref,
        () => ({
          getMarkdown: () => value,
          setMarkdown: setValue,
          insertMarkdown: (snippet: string) => {
            const next = `${value}${snippet}`;
            setValue(next);
            onChange(next);
          },
          focus: vi.fn(),
          getContentEditableHTML: () => value,
          getSelectionMarkdown: () => '',
        }),
        [onChange, value]
      );

      return (
        <div
          role="textbox"
          aria-label="mock markdown editor"
          contentEditable
          suppressContentEditableWarning
        >
          {value}
        </div>
      );
    }
  );

  return {
    MDXEditor,
    BlockTypeSelect: () => null,
    BoldItalicUnderlineToggles: () => null,
    CreateLink: () => null,
    ListsToggle: () => null,
    UndoRedo: () => null,
    headingsPlugin: plugin,
    jsxPlugin: plugin,
    linkPlugin: plugin,
    listsPlugin: plugin,
    markdownShortcutPlugin: plugin,
    quotePlugin: plugin,
    thematicBreakPlugin: plugin,
    toolbarPlugin: plugin,
  };
});

import { RichContentEditor } from '../RichContentEditor';
import { TRAILING_EMPTY_PARAGRAPH_MARKDOWN } from '../richContentTrailingParagraph';

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  document.getSelection()?.removeAllRanges();
});

describe('RichContentEditor', () => {
  it('preserves a trailing empty paragraph when Enter is pressed at the end', () => {
    useMediaListMock.mockReturnValue({ data: [] });
    const onChange = vi.fn();

    render(
      <RichContentEditor
        themeId="theme-1"
        markdown="첫 문장"
        onChange={onChange}
        pickerType={null}
        onOpenPicker={vi.fn()}
        onClosePicker={vi.fn()}
        ariaLabel="본문 작성기"
      />
    );

    const editor = screen.getByRole('textbox', { name: 'mock markdown editor' });
    const text = editor.firstChild;
    expect(text).not.toBeNull();

    const range = document.createRange();
    range.setStart(text!, editor.textContent?.length ?? 0);
    range.collapse(true);
    document.getSelection()?.removeAllRanges();
    document.getSelection()?.addRange(range);

    fireEvent.keyDown(editor, { key: 'Enter' });

    expect(onChange).toHaveBeenCalledWith(`첫 문장\n\n${TRAILING_EMPTY_PARAGRAPH_MARKDOWN}`);
  });
});
