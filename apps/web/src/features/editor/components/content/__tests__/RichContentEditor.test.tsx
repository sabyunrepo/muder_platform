import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import React, { useImperativeHandle, useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const { mdxEditorMountMock, mdxEditorRenderMarkdownMock, setMarkdownMock, useMediaListMock } =
  vi.hoisted(() => ({
    mdxEditorMountMock: vi.fn(),
    mdxEditorRenderMarkdownMock: vi.fn(),
    setMarkdownMock: vi.fn(),
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
      mdxEditorRenderMarkdownMock(markdown);
      const [value, setValue] = useState(markdown);
      React.useEffect(() => {
        mdxEditorMountMock();
      }, []);
      useImperativeHandle(
        ref,
        () => ({
          getMarkdown: () => value,
          setMarkdown: (nextMarkdown: string) => {
            setMarkdownMock(nextMarkdown);
            setValue(nextMarkdown);
          },
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
          onInput={(event) => {
            const next = event.currentTarget.textContent ?? '';
            setValue(next);
            onChange(next);
          }}
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

  it('does not feed same-document parent markdown changes back into MDXEditor during active editing', () => {
    useMediaListMock.mockReturnValue({ data: [] });
    const onChangeSpy = vi.fn();

    function ControlledEditor() {
      const [markdown, setMarkdown] = useState('첫 문장');
      return (
        <RichContentEditor
          themeId="theme-1"
          documentIdentity="doc-1"
          markdown={markdown}
          onChange={(nextMarkdown) => {
            onChangeSpy(nextMarkdown);
            setMarkdown(nextMarkdown);
          }}
          pickerType={null}
          onOpenPicker={vi.fn()}
          onClosePicker={vi.fn()}
          ariaLabel="본문 작성기"
        />
      );
    }

    render(<ControlledEditor />);

    const editor = screen.getByRole('textbox', { name: 'mock markdown editor' });
    setMarkdownMock.mockClear();
    mdxEditorRenderMarkdownMock.mockClear();

    editor.textContent = '첫 문장 추가';
    fireEvent.input(editor);

    expect(onChangeSpy).toHaveBeenCalledWith('첫 문장 추가');
    expect(editor).toHaveTextContent('첫 문장 추가');
    expect(setMarkdownMock).not.toHaveBeenCalled();
    expect(mdxEditorRenderMarkdownMock).not.toHaveBeenCalledWith('첫 문장 추가');
  });

  it('applies external markdown when editing is not active', () => {
    useMediaListMock.mockReturnValue({ data: [] });
    const onChange = vi.fn();
    const { rerender } = render(
      <RichContentEditor
        themeId="theme-1"
        documentIdentity="doc-1"
        markdown="첫 문장"
        onChange={onChange}
        pickerType={null}
        onOpenPicker={vi.fn()}
        onClosePicker={vi.fn()}
        ariaLabel="본문 작성기"
      />
    );

    setMarkdownMock.mockClear();

    rerender(
      <RichContentEditor
        themeId="theme-1"
        documentIdentity="doc-1"
        markdown="서버에서 바뀐 문장"
        onChange={onChange}
        pickerType={null}
        onOpenPicker={vi.fn()}
        onClosePicker={vi.fn()}
        ariaLabel="본문 작성기"
      />
    );

    expect(setMarkdownMock).toHaveBeenCalledWith('서버에서 바뀐 문장');
  });

  it('remounts with the new initial markdown when document identity changes', () => {
    useMediaListMock.mockReturnValue({ data: [] });
    const onChange = vi.fn();
    const { rerender } = render(
      <RichContentEditor
        themeId="theme-1"
        documentIdentity="doc-1"
        markdown="첫 문서"
        onChange={onChange}
        pickerType={null}
        onOpenPicker={vi.fn()}
        onClosePicker={vi.fn()}
        ariaLabel="본문 작성기"
      />
    );

    mdxEditorMountMock.mockClear();

    rerender(
      <RichContentEditor
        themeId="theme-1"
        documentIdentity="doc-2"
        markdown="둘째 문서"
        onChange={onChange}
        pickerType={null}
        onOpenPicker={vi.fn()}
        onClosePicker={vi.fn()}
        ariaLabel="본문 작성기"
      />
    );

    expect(mdxEditorMountMock).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('textbox', { name: 'mock markdown editor' })).toHaveTextContent(
      '둘째 문서'
    );
  });
});
