import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { Accordion } from '../Accordion';

const storage = new Map<string, string>();

beforeEach(() => {
  storage.clear();
  Object.defineProperty(window, 'localStorage', {
    configurable: true,
    value: {
      getItem: vi.fn((key: string) => storage.get(key) ?? null),
      setItem: vi.fn((key: string, value: string) => storage.set(key, value)),
      clear: vi.fn(() => storage.clear()),
      removeItem: vi.fn((key: string) => storage.delete(key)),
    },
  });
});

afterEach(() => {
  cleanup();
  try {
    window.localStorage.clear();
  } catch {
    // no-op: some tests intentionally make storage access throw
  }
});

describe('Accordion', () => {
  it('defaultOpen 항목을 처음부터 펼친다', () => {
    render(
      <Accordion
        items={[
          { id: 'base', title: '베이스', defaultOpen: true, children: <p>기본 필드</p> },
          { id: 'module', title: '모듈', children: <p>모듈 필드</p> },
        ]}
      />,
    );

    expect(screen.getByText('기본 필드')).toBeDefined();
    expect(screen.queryByText('모듈 필드')).toBeNull();
  });

  it('헤더 클릭으로 panel을 열고 닫는다', () => {
    render(
      <Accordion
        items={[{ id: 'module', title: '모듈', children: <p>모듈 필드</p> }]}
      />,
    );

    const button = screen.getByRole('button', { name: '모듈' });
    expect(button.getAttribute('aria-expanded')).toBe('false');

    fireEvent.click(button);
    expect(button.getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByText('모듈 필드')).toBeDefined();

    fireEvent.click(button);
    expect(button.getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByText('모듈 필드')).toBeNull();
  });

  it('forceOpen 항목은 닫히지 않는다', () => {
    render(
      <Accordion
        items={[{ id: 'base', title: '베이스', forceOpen: true, children: <p>항상 표시</p> }]}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: '베이스' }));
    expect(screen.getByText('항상 표시')).toBeDefined();
  });

  it('storageKey가 있으면 열린 항목을 localStorage에 저장하고 복원한다', () => {
    const items = [
      { id: 'module', title: '모듈', children: <p>모듈 필드</p> },
    ];
    const { unmount } = render(<Accordion storageKey="editor:test" items={items} />);

    fireEvent.click(screen.getByRole('button', { name: '모듈' }));
    expect(window.localStorage.getItem('editor:test')).toBe('["module"]');

    unmount();
    render(<Accordion storageKey="editor:test" items={items} />);
    expect(screen.getByText('모듈 필드')).toBeDefined();
  });

  it('storageKey가 바뀌면 저장된 열린 항목을 다시 읽는다', async () => {
    storage.set('editor:char-a', '["module"]');
    storage.set('editor:char-b', '["base"]');
    const items = [
      { id: 'base', title: '베이스', children: <p>기본 필드</p> },
      { id: 'module', title: '모듈', children: <p>모듈 필드</p> },
    ];

    const { rerender } = render(<Accordion storageKey="editor:char-a" items={items} />);
    expect(screen.getByText('모듈 필드')).toBeDefined();
    expect(screen.queryByText('기본 필드')).toBeNull();

    rerender(<Accordion storageKey="editor:char-b" items={items} />);

    await waitFor(() => {
      expect(screen.getByText('기본 필드')).toBeDefined();
      expect(screen.queryByText('모듈 필드')).toBeNull();
    });
  });

  it('localStorage 접근이 차단되어도 렌더링한다', () => {
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      get() {
        throw new DOMException('Access denied', 'SecurityError');
      },
    });

    expect(() =>
      render(
        <Accordion
          storageKey="editor:blocked"
          items={[{ id: 'base', title: '베이스', defaultOpen: true, children: <p>기본 필드</p> }]}
        />,
      ),
    ).not.toThrow();
    expect(screen.getByText('기본 필드')).toBeDefined();
  });

  it('localStorage 저장이 실패해도 토글 상태를 유지한다', () => {
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      value: {
        getItem: vi.fn(() => null),
        setItem: vi.fn(() => {
          throw new DOMException('Quota exceeded', 'QuotaExceededError');
        }),
        clear: vi.fn(),
        removeItem: vi.fn(),
      },
    });

    render(
      <Accordion
        storageKey="editor:quota"
        items={[{ id: 'module', title: '모듈', children: <p>모듈 필드</p> }]}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: '모듈' }));
    expect(screen.getByText('모듈 필드')).toBeDefined();
  });
});
