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


  it('사용 효과 설정은 제작자가 이해하는 문장으로 표시된다', () => {
    const onClose = vi.fn();
    render(<ClueForm themeId="theme-1" isOpen onClose={onClose} />);

    fireEvent.click(screen.getByText('고급 설정'));
    fireEvent.click(screen.getByLabelText('사용 가능한 단서'));

    expect(screen.getByText('다른 플레이어 단서 보기')).toBeDefined();
    expect(screen.getByText('다른 플레이어에게서 단서 가져오기')).toBeDefined();
    expect(screen.getByText('플레이어가 사용할 때 고르는 대상')).toBeDefined();
    expect(screen.getByText('사용하면 내 단서함에서 사라짐')).toBeDefined();
  });


  it('사용 효과를 정보 공개로 바꾸면 backend policy에 맞게 대상 없음으로 저장한다', () => {
    const onClose = vi.fn();
    render(<ClueForm themeId="theme-1" isOpen onClose={onClose} />);

    fireEvent.change(screen.getByLabelText('이름'), {
      target: { value: '정보 단서' },
    });
    fireEvent.click(screen.getByText('고급 설정'));
    fireEvent.click(screen.getByLabelText('사용 가능한 단서'));
    fireEvent.change(screen.getByLabelText('사용하면 일어나는 일'), {
      target: { value: 'reveal' },
    });

    fireEvent.submit(document.getElementById('clue-form')!);

    expect(createMutate).toHaveBeenCalledTimes(1);
    const [body] = createMutate.mock.calls[0];
    expect(body.use_effect).toBe('reveal');
    expect(body.use_target).toBe('self');
  });

  it('고급 설정의 공개/사라짐 라운드 입력이 payload에 포함된다', () => {
    const onClose = vi.fn();
    render(<ClueForm themeId="theme-1" isOpen onClose={onClose} />);

    fireEvent.change(screen.getByLabelText('이름'), {
      target: { value: '라운드 단서' },
    });
    fireEvent.click(screen.getByText('고급 설정'));
    fireEvent.change(screen.getByLabelText('공개 라운드'), {
      target: { value: '2' },
    });
    fireEvent.change(screen.getByLabelText('사라짐 라운드'), {
      target: { value: '4' },
    });

    fireEvent.submit(document.getElementById('clue-form')!);

    expect(createMutate).toHaveBeenCalledTimes(1);
    const [body] = createMutate.mock.calls[0];
    expect(body.reveal_round).toBe(2);
    expect(body.hide_round).toBe(4);
  });

  it('공개 > 사라짐 라운드 조합은 에러를 표시하고 mutate를 막는다', () => {
    const onClose = vi.fn();
    render(<ClueForm themeId="theme-1" isOpen onClose={onClose} />);

    fireEvent.change(screen.getByLabelText('이름'), {
      target: { value: '역전 단서' },
    });
    fireEvent.click(screen.getByText('고급 설정'));
    fireEvent.change(screen.getByLabelText('공개 라운드'), {
      target: { value: '5' },
    });
    fireEvent.change(screen.getByLabelText('사라짐 라운드'), {
      target: { value: '2' },
    });

    fireEvent.submit(document.getElementById('clue-form')!);

    expect(
      screen.getByText('공개 라운드는 사라짐 라운드보다 클 수 없습니다'),
    ).toBeDefined();
    expect(createMutate).not.toHaveBeenCalled();
  });

  it('edit 모드에서 기존 reveal_round/hide_round가 초기값으로 로드된다', () => {
    const onClose = vi.fn();
    const existing = {
      id: 'clue-rr',
      theme_id: 'theme-1',
      location_id: null,
      name: '기존 단서',
      description: null,
      image_url: null,
      is_common: false,
      level: 1,
      sort_order: 0,
      created_at: '2026-04-17T00:00:00Z',
      is_usable: false,
      use_effect: null,
      use_target: null,
      use_consumed: false,
      reveal_round: 3,
      hide_round: 7,
    };

    render(
      <ClueForm themeId="theme-1" clue={existing} isOpen onClose={onClose} />,
    );
    fireEvent.click(screen.getByText('고급 설정'));

    expect(
      (screen.getByLabelText('공개 라운드') as HTMLInputElement).value,
    ).toBe('3');
    expect(
      (screen.getByLabelText('사라짐 라운드') as HTMLInputElement).value,
    ).toBe('7');
  });
});
