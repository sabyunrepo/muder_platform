import { describe, it, expect, vi, afterEach, beforeEach, beforeAll } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';

// jsdom lacks URL.createObjectURL / revokeObjectURL
beforeAll(() => {
  if (!('createObjectURL' in URL)) {
    (URL as unknown as { createObjectURL: (f: File) => string }).createObjectURL = () =>
      'blob:mock';
  }
  if (!('revokeObjectURL' in URL)) {
    (URL as unknown as { revokeObjectURL: (u: string) => void }).revokeObjectURL = () => {};
  }
});

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

const {
  useCreateClueMock,
  useUpdateClueMock,
  useMediaListMock,
  toastSuccessMock,
  toastErrorMock,
} = vi.hoisted(() => ({
  useCreateClueMock: vi.fn(),
  useUpdateClueMock: vi.fn(),
  useMediaListMock: vi.fn(),
  toastSuccessMock: vi.fn(),
  toastErrorMock: vi.fn(),
}));

vi.mock('sonner', () => ({
  toast: { success: toastSuccessMock, error: toastErrorMock },
}));

vi.mock('@/features/editor/api', () => ({
  useCreateClue: () => useCreateClueMock(),
  useUpdateClue: () => useUpdateClueMock(),
}));

vi.mock('@/features/editor/mediaApi', () => ({
  useMediaList: () => useMediaListMock(),
}));

vi.mock('@/features/editor/components/media/MediaPicker', () => ({
  MediaPicker: ({
    open,
    filterType,
    selectedId,
    onSelect,
  }: {
    open: boolean;
    filterType?: string;
    selectedId?: string | null;
    onSelect: (media: { id: string; name: string; type: string }) => void;
  }) =>
    open ? (
      <div>
        <span>filter:{filterType}</span>
        <span>selected:{selectedId ?? 'none'}</span>
        <button
          type="button"
          onClick={() => onSelect({ id: 'image-1', name: '증거 사진', type: 'IMAGE' })}
        >
          증거 사진 선택
        </button>
      </div>
    ) : null,
}));

vi.mock('@/shared/components/ui/Modal', () => ({
  Modal: ({
    isOpen,
    children,
    footer,
    title,
  }: {
    isOpen: boolean;
    children: React.ReactNode;
    footer: React.ReactNode;
    title: string;
  }) =>
    isOpen ? (
      <div role="dialog" aria-label={title}>
        {children}
        {footer}
      </div>
    ) : null,
}));

vi.mock('@/shared/components/ui/Button', () => ({
  Button: ({
    children,
    onClick,
    type,
    form,
    disabled,
  }: {
    children: React.ReactNode;
    onClick?: () => void;
    type?: 'button' | 'submit';
    form?: string;
    disabled?: boolean;
  }) => (
    <button type={type ?? 'button'} form={form} onClick={onClick} disabled={disabled}>
      {children}
    </button>
  ),
}));

vi.mock('@/shared/components/ui/Input', () => ({
  Input: ({
    label,
    value,
    onChange,
    error,
    ...rest
  }: {
    label?: string;
    value: string | number;
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    error?: string;
    [key: string]: unknown;
  }) => (
    <label>
      {label}
      <input
        aria-label={label}
        value={value}
        onChange={onChange}
        {...(rest as Record<string, unknown>)}
      />
      {error && <span role="alert">{error}</span>}
    </label>
  ),
}));

// ---------------------------------------------------------------------------
// Imports after mocks
// ---------------------------------------------------------------------------

import { ClueForm } from '../ClueForm';

// ---------------------------------------------------------------------------
// Test setup
// ---------------------------------------------------------------------------

afterEach(cleanup);

describe('ClueForm', () => {
  let createMutate: ReturnType<typeof vi.fn>;
  let updateMutate: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    createMutate = vi.fn();
    updateMutate = vi.fn();
    useCreateClueMock.mockReturnValue({ mutate: createMutate, isPending: false });
    useUpdateClueMock.mockReturnValue({ mutate: updateMutate, isPending: false });
    useMediaListMock.mockReturnValue({
      data: [{ id: 'image-1', name: '증거 사진', type: 'IMAGE' }],
      isLoading: false,
    });
    toastSuccessMock.mockReset();
    toastErrorMock.mockReset();
  });

  it('create 모드에서 이름 입력 후 저장하면 useCreateClue.mutate가 호출된다', () => {
    const onClose = vi.fn();
    render(<ClueForm themeId="theme-1" isOpen onClose={onClose} />);

    const nameInput = screen.getByLabelText('이름') as HTMLInputElement;
    fireEvent.change(nameInput, { target: { value: '증거물' } });

    fireEvent.submit(document.getElementById('clue-form')!);

    expect(createMutate).toHaveBeenCalledTimes(1);
    const [body] = createMutate.mock.calls[0];
    expect(body.name).toBe('증거물');
    expect(body.is_usable).toBe(false);
  });

  it('단서 생성 폼에서는 중복 고급 설정 블록을 렌더링하지 않는다', () => {
    const onClose = vi.fn();
    render(<ClueForm themeId="theme-1" isOpen onClose={onClose} />);

    expect(screen.queryByRole('button', { name: '고급 설정' })).toBeNull();
    expect(screen.queryByText('공개 단서 (모든 플레이어 공유)')).toBeNull();
    expect(screen.queryByText('라운드 스케줄')).toBeNull();
    expect(screen.queryByText('사용 가능한 단서')).toBeNull();
  });

  it('미디어 관리의 IMAGE 항목을 단서 이미지로 선택한다', () => {
    const onClose = vi.fn();

    render(<ClueForm themeId="theme-1" isOpen onClose={onClose} />);

    fireEvent.change(screen.getByLabelText('이름'), {
      target: { value: 'with-image' },
    });
    fireEvent.click(screen.getByRole('button', { name: '단서 이미지 선택' }));
    expect(screen.getByText('filter:IMAGE')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: '증거 사진 선택' }));
    fireEvent.submit(document.getElementById('clue-form')!);

    expect(createMutate).toHaveBeenCalledTimes(1);
    const [body] = createMutate.mock.calls[0];
    expect(body.image_media_id).toBe('image-1');
    expect(body.image_url).toBe('');
  });

  it('edit 모드에서 이미지 제거 시 media id와 legacy URL을 함께 비운다', () => {
    const onClose = vi.fn();
    const existing = {
      id: 'clue-with-image',
      theme_id: 'theme-1',
      location_id: null,
      name: '이미지 단서',
      description: null,
      image_url: 'https://cdn.example/legacy-clue.webp',
      image_media_id: 'image-1',
      is_common: false,
      level: 1,
      sort_order: 0,
      created_at: '2026-04-15T00:00:00Z',
      is_usable: false,
      use_effect: null,
      use_target: null,
      use_consumed: false,
    };

    render(
      <ClueForm themeId="theme-1" clue={existing} isOpen onClose={onClose} />,
    );

    fireEvent.click(screen.getByRole('button', { name: '제거' }));
    fireEvent.submit(document.getElementById('clue-form')!);

    expect(updateMutate).toHaveBeenCalledTimes(1);
    const [args] = updateMutate.mock.calls[0];
    expect(args.body.image_media_id).toBeNull();
    expect(args.body.image_url).toBe('');
  });

  it('edit 모드에서 이름만 수정하면 기존 media id와 legacy URL을 보존한다', () => {
    const onClose = vi.fn();
    const existing = {
      id: 'clue-with-image',
      theme_id: 'theme-1',
      location_id: null,
      name: '이미지 단서',
      description: null,
      image_url: 'https://cdn.example/legacy-clue.webp',
      image_media_id: 'image-1',
      is_common: false,
      level: 1,
      sort_order: 0,
      created_at: '2026-04-15T00:00:00Z',
      is_usable: false,
      use_effect: null,
      use_target: null,
      use_consumed: false,
    };

    render(
      <ClueForm themeId="theme-1" clue={existing} isOpen onClose={onClose} />,
    );

    fireEvent.change(screen.getByLabelText('이름'), {
      target: { value: '이름만 변경' },
    });
    fireEvent.submit(document.getElementById('clue-form')!);

    expect(updateMutate).toHaveBeenCalledTimes(1);
    const [args] = updateMutate.mock.calls[0];
    expect(args.body.name).toBe('이름만 변경');
    expect(args.body.image_media_id).toBe('image-1');
    expect(args.body.image_url).toBe('https://cdn.example/legacy-clue.webp');
  });

  it('edit 모드에서는 useUpdateClue.mutate가 호출된다', () => {
    const onClose = vi.fn();
    const existing = {
      id: 'clue-99',
      theme_id: 'theme-1',
      location_id: null,
      name: '기존 단서',
      description: null,
      image_url: null,
      is_common: false,
      level: 1,
      sort_order: 0,
      created_at: '2026-04-15T00:00:00Z',
      is_usable: false,
      use_effect: null,
      use_target: null,
      use_consumed: false,
    };

    render(
      <ClueForm themeId="theme-1" clue={existing} isOpen onClose={onClose} />,
    );

    fireEvent.submit(document.getElementById('clue-form')!);

    expect(updateMutate).toHaveBeenCalledTimes(1);
    const [args] = updateMutate.mock.calls[0];
    expect(args.clueId).toBe('clue-99');
    expect(args.body.name).toBe('기존 단서');
  });

  it('이름이 비어있으면 검증 에러를 표시하고 mutate는 호출되지 않는다', () => {
    const onClose = vi.fn();
    render(<ClueForm themeId="theme-1" isOpen onClose={onClose} />);

    fireEvent.submit(document.getElementById('clue-form')!);

    expect(screen.getByRole('alert').textContent).toContain('이름은 필수');
    expect(createMutate).not.toHaveBeenCalled();
  });

  it('edit 모드에서 기존 고급 설정 값을 보존해 저장한다', () => {
    const onClose = vi.fn();
    const existing = {
      id: 'clue-rr',
      theme_id: 'theme-1',
      location_id: null,
      name: '기존 단서',
      description: null,
      image_url: null,
      level: 1,
      sort_order: 0,
      created_at: '2026-04-17T00:00:00Z',
      is_common: true,
      is_usable: true,
      use_effect: 'reveal' as const,
      use_target: 'self' as const,
      use_consumed: true,
      reveal_round: 3,
      hide_round: 7,
    };

    render(
      <ClueForm themeId="theme-1" clue={existing} isOpen onClose={onClose} />,
    );

    fireEvent.submit(document.getElementById('clue-form')!);

    expect(updateMutate).toHaveBeenCalledTimes(1);
    const [args] = updateMutate.mock.calls[0];
    expect(args.body).toMatchObject({
      is_common: true,
      is_usable: true,
      use_effect: 'reveal',
      use_target: 'self',
      use_consumed: true,
      reveal_round: 3,
      hide_round: 7,
    });
  });
});
