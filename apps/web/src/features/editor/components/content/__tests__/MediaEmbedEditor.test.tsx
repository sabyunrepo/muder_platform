import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it, vi } from 'vitest';

const { removeMock, updateMock } = vi.hoisted(() => ({
  removeMock: vi.fn(),
  updateMock: vi.fn(),
}));

vi.mock('@mdxeditor/editor', () => ({
  useLexicalNodeRemove: () => removeMock,
  useMdastNodeUpdater: () => updateMock,
}));

vi.mock('@/features/editor/mediaApi', () => ({
  useMediaDownloadUrl: () => ({ data: null, isLoading: false, isError: false }),
}));

import { MediaEmbedEditor } from '../MediaEmbedEditor';
import type { MediaEmbedAttributes } from '../mediaEmbedMarkdown';

const attrs: MediaEmbedAttributes = {
  mediaId: 'image-1',
  type: 'image',
  align: 'center',
  width: 'medium',
};

const mdastNode = {
  attributes: [
    { name: 'mediaId', value: attrs.mediaId },
    { name: 'type', value: attrs.type },
    { name: 'align', value: attrs.align },
    { name: 'width', value: attrs.width },
  ],
};

const media = [
  {
    id: 'image-1',
    name: '포스터',
    type: 'IMAGE',
    source_type: 'URL',
    url: 'https://example.test/poster.png',
  },
] as const;

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function renderEditor(overrides: Partial<Parameters<typeof MediaEmbedEditor>[0]> = {}) {
  return render(
    <MediaEmbedEditor
      mdastNode={mdastNode}
      media={[...media]}
      onRequestReplace={vi.fn()}
      onInsertParagraph={vi.fn()}
      onMove={vi.fn()}
      onDropOn={vi.fn()}
      {...overrides}
    />
  );
}

describe('MediaEmbedEditor', () => {
  it('exposes a selectable media block with paragraph insertion controls', () => {
    const onInsertParagraph = vi.fn();
    renderEditor({ onInsertParagraph });

    fireEvent.click(screen.getByRole('button', { name: '미디어 위에 문단 추가' }));
    fireEvent.click(screen.getByRole('button', { name: '미디어 아래에 문단 추가' }));

    expect(screen.getByRole('group', { name: '포스터 미디어 블록' })).toBeInTheDocument();
    expect(onInsertParagraph).toHaveBeenNthCalledWith(1, attrs, 'before');
    expect(onInsertParagraph).toHaveBeenNthCalledWith(2, attrs, 'after');
  });

  it('uses Enter and modifier arrow keys for keyboard media block editing', () => {
    const onInsertParagraph = vi.fn();
    const onMove = vi.fn();
    renderEditor({ onInsertParagraph, onMove });

    const block = screen.getByRole('group', { name: '포스터 미디어 블록' });
    fireEvent.keyDown(block, { key: 'Enter' });
    fireEvent.keyDown(block, { key: 'Enter', shiftKey: true });
    fireEvent.keyDown(block, { key: 'ArrowUp', metaKey: true });
    fireEvent.keyDown(block, { key: 'ArrowDown', ctrlKey: true });

    expect(onInsertParagraph).toHaveBeenNthCalledWith(1, attrs, 'after');
    expect(onInsertParagraph).toHaveBeenNthCalledWith(2, attrs, 'before');
    expect(onMove).toHaveBeenNthCalledWith(1, attrs, 'up');
    expect(onMove).toHaveBeenNthCalledWith(2, attrs, 'down');
  });

  it('does not treat nested control Enter presses as figure-level shortcuts', () => {
    const onInsertParagraph = vi.fn();
    const onMove = vi.fn();
    renderEditor({ onInsertParagraph, onMove });

    fireEvent.keyDown(screen.getByRole('button', { name: '보통' }), { key: 'Enter' });
    fireEvent.keyDown(screen.getByRole('button', { name: '포스터 위로 이동' }), {
      key: 'ArrowUp',
      metaKey: true,
    });

    expect(onInsertParagraph).not.toHaveBeenCalled();
    expect(onMove).not.toHaveBeenCalled();
  });

  it('accepts a dragged media block and reports the drop direction', () => {
    const onDropOn = vi.fn();
    renderEditor({ onDropOn });

    const block = screen.getByRole('group', { name: '포스터 미디어 블록' });
    const data = new Map<string, string>();
    const dataTransfer = {
      types: ['application/x-mmp-media-embed'],
      effectAllowed: '',
      dropEffect: '',
      setData: (type: string, value: string) => data.set(type, value),
      getData: (type: string) => data.get(type) ?? '',
    };

    fireEvent.dragStart(block, { dataTransfer });
    fireEvent.drop(block, { dataTransfer, clientY: -1 });

    expect(onDropOn).toHaveBeenCalledWith(attrs, attrs, 'after');
  });

  it('uses icon-only width controls instead of visible M and L text', () => {
    renderEditor();

    expect(screen.queryByText('M')).not.toBeInTheDocument();
    expect(screen.queryByText('L')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '보통' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '크게' })).toBeInTheDocument();
  });
});
