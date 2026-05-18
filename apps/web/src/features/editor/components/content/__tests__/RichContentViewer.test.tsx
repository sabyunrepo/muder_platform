import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const { useMediaListMock } = vi.hoisted(() => ({
  useMediaListMock: vi.fn(),
}));

vi.mock('@/features/editor/mediaApi', () => ({
  useMediaList: (...args: unknown[]) => useMediaListMock(...args),
}));

import { RichContentViewer } from '../RichContentViewer';

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('RichContentViewer', () => {
  it('renders markdown blockquotes, emphasis, dividers, and strong text as formatted content', () => {
    useMediaListMock.mockReturnValue({ data: [] });

    const { container } = render(
      <RichContentViewer
        themeId="theme-1"
        markdown={[
          '> *2008년 7월 28일 저녁, 비가 내리는 명우 홀리데이 호텔 2층 식당.*',
          '',
          '> *7시 10분, 일행은 자리를 잡았다.*',
          '',
          '---',
          '',
          '**고동(顾东):** 송 사장님',
        ].join('\n')}
      />,
    );

    const blockquotes = container.querySelectorAll('blockquote');
    expect(blockquotes).toHaveLength(2);
    expect(blockquotes[0]?.querySelector('em')?.textContent).toBe(
      '2008년 7월 28일 저녁, 비가 내리는 명우 홀리데이 호텔 2층 식당.',
    );
    expect(container.querySelector('hr')).not.toBeNull();
    expect(screen.getByText('고동(顾东):')).toHaveProperty('tagName', 'STRONG');
    expect(container).toHaveProperty(
      'textContent',
      expect.not.stringContaining('> *2008년'),
    );
  });

  it('renders legacy escaped markdown markers as formatted content', () => {
    useMediaListMock.mockReturnValue({ data: [] });

    const { container } = render(
      <RichContentViewer
        themeId="theme-1"
        markdown={[
          '\\> \\*2008년 7월 28일 저녁, 비가 내리는 명우 홀리데이 호텔 2층 식당.\\*',
          '',
          '\\---',
          '',
          '\\*\\*고동(顾东):\\*\\* 송 사장님',
        ].join('\n')}
      />,
    );

    expect(container.querySelector('blockquote')).not.toBeNull();
    expect(container.querySelector('blockquote em')?.textContent).toBe(
      '2008년 7월 28일 저녁, 비가 내리는 명우 홀리데이 호텔 2층 식당.',
    );
    expect(container.querySelector('hr')).not.toBeNull();
    expect(screen.getByText('고동(顾东):')).toHaveProperty('tagName', 'STRONG');
    expect(container).toHaveProperty(
      'textContent',
      expect.not.stringContaining('\\> \\*2008년'),
    );
  });

  it('preserves escaped formatting markers inside fenced code blocks', () => {
    useMediaListMock.mockReturnValue({ data: [] });

    const { container } = render(
      <RichContentViewer
        themeId="theme-1"
        markdown={[
          '\\> \\*2008년 7월 28일 저녁\\*',
          '',
          '```',
          '\\*literal\\*',
          '```',
        ].join('\n')}
      />,
    );

    expect(container.querySelector('blockquote em')?.textContent).toBe('2008년 7월 28일 저녁');
    expect(container.querySelector('code')?.textContent?.trim()).toBe('\\*literal\\*');
  });

  it('renders encoded trailing empty paragraphs as line breaks', () => {
    useMediaListMock.mockReturnValue({ data: [] });

    const { container } = render(
      <RichContentViewer themeId="theme-1" markdown={['첫 문장', '', '<br />'].join('\n')} />
    );

    expect(screen.getByText('첫 문장')).not.toBeNull();
    expect(container.querySelector('br')).not.toBeNull();
  });
});
